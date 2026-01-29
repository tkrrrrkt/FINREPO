from __future__ import annotations

import argparse
import hashlib
from datetime import datetime
from pathlib import Path
import sys
from typing import Any, Dict, List, Tuple

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.config import load_config
from lib.db import get_conn
from lib.logger import log_jsonl


def upsert_company(conn, doc_id: str) -> None:
    """
    優先順位: JCN → EDINETコード → 証券コード+社名
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT edinet_code, sec_code, jcn, company_name
            FROM raw.edinet_document
            WHERE doc_id = %s
            """,
            (doc_id,),
        )
        row = cur.fetchone()
        if not row:
            return
        edinet_code, sec_code, jcn, company_name = row

        if jcn:
            cur.execute(
                """
                UPDATE core.company
                SET edinet_code = %s,
                    sec_code = %s,
                    company_name = %s
                WHERE jcn = %s
                """,
                (edinet_code, sec_code, company_name, jcn),
            )
            if cur.rowcount == 0:
                cur.execute(
                    """
                    INSERT INTO core.company (edinet_code, sec_code, jcn, company_name)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (edinet_code) DO UPDATE
                    SET sec_code = EXCLUDED.sec_code,
                        jcn = EXCLUDED.jcn,
                        company_name = EXCLUDED.company_name
                    """,
                    (edinet_code, sec_code, jcn, company_name),
                )
        elif edinet_code:
            cur.execute(
                """
                INSERT INTO core.company (edinet_code, sec_code, jcn, company_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (edinet_code) DO UPDATE
                SET sec_code = EXCLUDED.sec_code,
                    jcn = EXCLUDED.jcn,
                    company_name = EXCLUDED.company_name
                """,
                (edinet_code, sec_code, jcn, company_name),
            )
        else:
            cur.execute(
                """
                SELECT company_id FROM core.company
                WHERE sec_code = %s AND company_name = %s
                """,
                (sec_code, company_name),
            )
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO core.company (edinet_code, sec_code, jcn, company_name)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (edinet_code, sec_code, jcn, company_name),
                )


def upsert_document(conn, doc_id: str) -> None:
    sql = """
        INSERT INTO core.document (
            doc_id, company_id, doc_type_code, submission_date, period_start, period_end,
            fiscal_year, accounting_standard, is_consolidated, is_amended, parent_doc_id, source_doc_id
        )
        SELECT
            r.doc_id,
            c.company_id,
            r.doc_type_code,
            r.submission_date,
            r.period_start,
            r.period_end,
            r.fiscal_year,
            r.accounting_standard,
            NULL::boolean as is_consolidated,
            r.is_amended,
            r.parent_doc_id,
            r.doc_id as source_doc_id
        FROM raw.edinet_document r
        JOIN core.company c
          ON (c.jcn IS NOT NULL AND c.jcn = r.jcn)
          OR (c.jcn IS NULL AND c.edinet_code = r.edinet_code)
        WHERE r.doc_id = %s
        ON CONFLICT (doc_id) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            doc_type_code = EXCLUDED.doc_type_code,
            submission_date = EXCLUDED.submission_date,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            fiscal_year = EXCLUDED.fiscal_year,
            accounting_standard = EXCLUDED.accounting_standard,
            parent_doc_id = EXCLUDED.parent_doc_id
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id,))


def upsert_concepts(conn, doc_id: str) -> None:
    sql = """
        INSERT INTO core.concept (namespace, element_name, label_ja, label_en, data_type, period_type, balance_type, is_standard)
        SELECT DISTINCT
            concept_namespace,
            concept_name,
            NULL::text AS label_ja,
            NULL::text AS label_en,
            NULL::text AS data_type,
            NULL::text AS period_type,
            NULL::text AS balance_type,
            CASE
                WHEN concept_namespace IN ('jpdei_cor','jpcrp_cor','jppfs_cor','jpigp_cor','ifrs-full')
                THEN TRUE
                ELSE FALSE
            END AS is_standard
        FROM staging.fact
        WHERE doc_id = %s
        ON CONFLICT (namespace, element_name) DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id,))


def upsert_contexts(conn, doc_id: str) -> None:
    sql = """
        INSERT INTO core.context (
            document_id, context_key, period_type, period_start, period_end, instant_date,
            entity_identifier, is_consolidated, dimensions
        )
        SELECT
            d.document_id,
            c.context_ref,
            c.period_type,
            c.period_start,
            c.period_end,
            c.instant_date,
            c.entity_identifier,
            c.is_consolidated,
            c.dimensions
        FROM staging.context c
        JOIN core.document d ON d.doc_id = c.doc_id
        WHERE c.doc_id = %s
        ON CONFLICT (document_id, context_key) DO UPDATE
        SET period_type = EXCLUDED.period_type,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            instant_date = EXCLUDED.instant_date,
            entity_identifier = EXCLUDED.entity_identifier,
            is_consolidated = EXCLUDED.is_consolidated,
            dimensions = EXCLUDED.dimensions
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id,))


def upsert_units(conn, doc_id: str) -> None:
    sql = """
        INSERT INTO core.unit (unit_key, measures)
        SELECT DISTINCT
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(u.measures->'numerator') m
                    WHERE m = 'iso4217:JPY'
                ) THEN 'JPY'
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(u.measures->'numerator') m
                    WHERE m LIKE 'iso4217:%%'
                ) THEN 'CURRENCY_OTHER'
                WHEN jsonb_array_length(u.measures->'denominator') = 0
                     AND jsonb_array_length(u.measures->'numerator') = 1
                THEN (u.measures->'numerator'->>0)
                ELSE 'OTHER'
            END AS unit_key,
            u.measures
        FROM staging.unit u
        WHERE u.doc_id = %s
        ON CONFLICT (unit_key) DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id,))


def load_facts(conn, doc_id: str) -> int:
    # preload context map
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cx.context_key, cx.context_id, cx.period_end, cx.is_consolidated
            FROM core.context cx
            JOIN core.document d ON d.document_id = cx.document_id
            WHERE d.doc_id = %s
            """,
            (doc_id,),
        )
        context_map = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    # preload unit map
    with conn.cursor() as cur:
        cur.execute("SELECT unit_key, unit_id FROM core.unit")
        unit_map = {r[0]: r[1] for r in cur.fetchall()}

    sql = """
        SELECT
            f.concept_qname,
            f.concept_namespace,
            f.concept_name,
            f.value_numeric,
            f.value_text,
            f.decimals,
            f.is_nil,
            sc.context_ref,
            su.measures,
            d.document_id,
            d.company_id,
            d.accounting_standard
        FROM staging.fact f
        JOIN staging.context sc ON sc.id = f.context_id
        LEFT JOIN staging.unit su ON su.id = f.unit_id
        JOIN core.document d ON d.doc_id = f.doc_id
        WHERE f.doc_id = %s
    """
    rows = []
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id,))
        rows = cur.fetchall()

    insert_rows = []
    for (
        concept_qname,
        concept_namespace,
        concept_name,
        value_numeric,
        value_text,
        decimals,
        is_nil,
        context_ref,
        measures,
        document_id,
        company_id,
        accounting_standard,
    ) in rows:
        ctx = context_map.get(context_ref)
        if not ctx:
            continue
        context_id, period_end, is_consolidated = ctx

        unit_key = "OTHER"
        if measures:
            nums = measures.get("numerator") or []
            dens = measures.get("denominator") or []
            if any(m == "iso4217:JPY" for m in nums):
                unit_key = "JPY"
            elif any(str(m).startswith("iso4217:") for m in nums):
                unit_key = "CURRENCY_OTHER"
            elif len(dens) == 0 and len(nums) == 1:
                unit_key = str(nums[0])
        else:
            unit_key = ""

        # exclude non-JPY currency only
        if unit_key == "CURRENCY_OTHER":
            continue

        unit_id = unit_map.get(unit_key) if unit_key else None
        fact_hash = hashlib.sha256(
            f"{doc_id}|{concept_qname}|{context_ref}|{unit_key}".encode("utf-8")
        ).hexdigest()

        insert_rows.append(
            (
                document_id,
                company_id,
                concept_namespace,
                concept_name,
                context_id,
                unit_id,
                value_numeric,
                value_text,
                decimals,
                is_nil,
                fact_hash,
                period_end,
                is_consolidated,
                accounting_standard,
            )
        )

    if not insert_rows:
        return 0

    insert_sql = """
        INSERT INTO core.financial_fact (
            document_id, company_id, concept_id, context_id, unit_id,
            value_numeric, value_text, decimals, is_nil, fact_hash,
            period_end, is_consolidated, accounting_standard
        )
        SELECT
            %s, %s, c.concept_id, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s
        FROM core.concept c
        WHERE c.namespace = %s AND c.element_name = %s
        ON CONFLICT (document_id, fact_hash) DO UPDATE
        SET value_numeric = EXCLUDED.value_numeric,
            value_text = EXCLUDED.value_text,
            decimals = EXCLUDED.decimals,
            is_nil = EXCLUDED.is_nil
    """
    with conn.cursor() as cur:
        for r in insert_rows:
            (
                document_id,
                company_id,
                concept_namespace,
                concept_name,
                context_id,
                unit_id,
                value_numeric,
                value_text,
                decimals,
                is_nil,
                fact_hash,
                period_end,
                is_consolidated,
                accounting_standard,
            ) = r
            cur.execute(
                insert_sql,
                (
                    document_id,
                    company_id,
                    context_id,
                    unit_id,
                    value_numeric,
                    value_text,
                    decimals,
                    is_nil,
                    fact_hash,
                    period_end,
                    is_consolidated,
                    accounting_standard,
                    concept_namespace,
                    concept_name,
                ),
            )
    return len(insert_rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="src/config/config.yaml")
    parser.add_argument("--doc-id", required=True)
    args = parser.parse_args()

    cfg = load_config(args.config)
    db_cfg = cfg.get("db", {})
    paths_cfg = cfg.get("paths", {})

    log_root = Path(paths_cfg.get("log_root", "data/logs/edinet"))
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    doc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"doc_{datetime.now():%Y%m%d}.jsonl"

    conn = get_conn(db_cfg)
    try:
        upsert_company(conn, args.doc_id)
        upsert_document(conn, args.doc_id)
        upsert_concepts(conn, args.doc_id)
        upsert_contexts(conn, args.doc_id)
        upsert_units(conn, args.doc_id)
        count = load_facts(conn, args.doc_id)
        conn.commit()
    finally:
        conn.close()

    log_jsonl(doc_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "load_core",
        "run_id": run_id,
        "doc_id": args.doc_id,
        "facts_loaded": count,
        "status": "success",
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
