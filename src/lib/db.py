from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence, Tuple

import psycopg2
import psycopg2.extras


RAW_COLUMNS: List[str] = [
    "doc_id",
    "edinet_code",
    "sec_code",
    "jcn",
    "company_name",
    "fund_code",
    "submission_date",
    "ope_date_time",
    "doc_type_code",
    "ordinance_code",
    "form_code",
    "doc_description",
    "issuer_edinet_code",
    "subject_edinet_code",
    "subsidiary_edinet_code",
    "period_start",
    "period_end",
    "fiscal_year",
    "accounting_standard",
    "is_consolidated",
    "is_amended",
    "parent_doc_id",
    "withdrawal_status",
    "doc_info_edit_status",
    "disclosure_status",
    "xbrl_flag",
    "pdf_flag",
    "attach_doc_flag",
    "english_doc_flag",
    "csv_flag",
    "legal_status",
    "api_version",
    "doclist_json_path",
    "fetch_status",
]


def get_conn(db_cfg: Dict[str, Any]):
    return psycopg2.connect(
        host=db_cfg.get("host"),
        port=db_cfg.get("port"),
        dbname=db_cfg.get("name"),
        user=db_cfg.get("user"),
        password=db_cfg.get("password"),
    )


def upsert_raw_edinet_documents(conn, rows: Iterable[Dict[str, Any]]) -> int:
    rows = list(rows)
    if not rows:
        return 0

    values = [[r.get(col) for col in RAW_COLUMNS] for r in rows]

    insert_cols = ", ".join(RAW_COLUMNS)
    update_cols = ", ".join([f"{c}=EXCLUDED.{c}" for c in RAW_COLUMNS if c != "doc_id"])

    sql = f"""
        INSERT INTO raw.edinet_document ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id) DO UPDATE SET {update_cols}
    """

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
    conn.commit()
    return len(rows)


def insert_raw_file(
    conn,
    doc_id: str,
    file_type: str,
    path: str,
    size_bytes: int | None = None,
    sha256: str | None = None,
) -> None:
    sql = """
        INSERT INTO raw.edinet_file (doc_id, file_type, path, size_bytes, sha256)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id, file_type, path, size_bytes, sha256))
    conn.commit()


def upsert_staging_contexts(conn, rows: Sequence[Dict[str, Any]]) -> None:
    if not rows:
        return
    cols = [
        "doc_id",
        "context_ref",
        "period_type",
        "period_start",
        "period_end",
        "instant_date",
        "entity_identifier",
        "is_consolidated",
        "dimensions",
        "context_hash",
    ]
    values = []
    for r in rows:
        row = []
        for c in cols:
            val = r.get(c)
            if c == "dimensions" and val is not None:
                val = psycopg2.extras.Json(val)
            row.append(val)
        values.append(row)
    insert_cols = ", ".join(cols)
    sql = f"""
        INSERT INTO staging.context ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id, context_ref) DO UPDATE
        SET period_type = EXCLUDED.period_type,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            instant_date = EXCLUDED.instant_date,
            entity_identifier = EXCLUDED.entity_identifier,
            is_consolidated = EXCLUDED.is_consolidated,
            dimensions = EXCLUDED.dimensions,
            context_hash = EXCLUDED.context_hash
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
    conn.commit()


def upsert_staging_units(conn, rows: Sequence[Dict[str, Any]]) -> None:
    if not rows:
        return
    cols = ["doc_id", "unit_ref", "measures", "unit_hash"]
    values = []
    for r in rows:
        row = []
        for c in cols:
            val = r.get(c)
            if c == "measures" and val is not None:
                val = psycopg2.extras.Json(val)
            row.append(val)
        values.append(row)
    insert_cols = ", ".join(cols)
    sql = f"""
        INSERT INTO staging.unit ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id, unit_ref) DO UPDATE
        SET measures = EXCLUDED.measures,
            unit_hash = EXCLUDED.unit_hash
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
    conn.commit()


def load_context_map(conn, doc_id: str, refs: Sequence[str]) -> Dict[str, int]:
    if not refs:
        return {}
    sql = """
        SELECT context_ref, id
        FROM staging.context
        WHERE doc_id = %s AND context_ref = ANY(%s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id, list(refs)))
        return {r[0]: r[1] for r in cur.fetchall()}


def load_unit_map(conn, doc_id: str, refs: Sequence[str]) -> Dict[str, int]:
    if not refs:
        return {}
    sql = """
        SELECT unit_ref, id
        FROM staging.unit
        WHERE doc_id = %s AND unit_ref = ANY(%s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (doc_id, list(refs)))
        return {r[0]: r[1] for r in cur.fetchall()}


def upsert_staging_facts(conn, rows: Sequence[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    cols = [
        "doc_id",
        "concept_qname",
        "concept_namespace",
        "concept_name",
        "context_id",
        "unit_id",
        "value_numeric",
        "value_text",
        "unit_ref_normalized",  # Issue #3: Unit正規化
        "value_normalized",      # Issue #3: Unit正規化
        "decimals",
        "is_nil",
        "fact_hash",
    ]
    values = [[r.get(c) for c in cols] for r in rows]
    insert_cols = ", ".join(cols)
    sql = f"""
        INSERT INTO staging.fact ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id, fact_hash) DO UPDATE
        SET value_numeric = EXCLUDED.value_numeric,
            value_text = EXCLUDED.value_text,
            unit_ref_normalized = EXCLUDED.unit_ref_normalized,
            value_normalized = EXCLUDED.value_normalized,
            decimals = EXCLUDED.decimals,
            is_nil = EXCLUDED.is_nil,
            context_id = EXCLUDED.context_id,
            unit_id = EXCLUDED.unit_id
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
    conn.commit()
    return len(rows)


def upsert_staging_concept_hierarchy(conn, rows: Sequence[Dict[str, Any]]) -> int:
    """
    Issue #2: Concept階層構造を staging.concept_hierarchy テーブルに保存

    Args:
        conn: DB接続
        rows: Concept 階層関係のリスト
              [{"doc_id": "...", "child_concept_name": "...", "parent_concept_name": "...", "hierarchy_level": ...}, ...]

    Returns:
        挿入/更新件数
    """
    if not rows:
        return 0

    cols = [
        "doc_id",
        "child_concept_name",
        "parent_concept_name",
        "hierarchy_level",
    ]
    values = [[r.get(c) for c in cols] for r in rows]
    insert_cols = ", ".join(cols)
    sql = f"""
        INSERT INTO staging.concept_hierarchy ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id, child_concept_name) DO UPDATE
        SET parent_concept_name = EXCLUDED.parent_concept_name,
            hierarchy_level = EXCLUDED.hierarchy_level
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values, page_size=500)
    conn.commit()
    return len(rows)
