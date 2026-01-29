from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.config import load_config
from lib.db import get_conn
from lib.logger import log_jsonl
from edinet.load_core import upsert_company, upsert_concepts, upsert_contexts, upsert_document, upsert_units, load_facts


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
        # Run core load (same as load_core.py)
        upsert_company(conn, args.doc_id)
        upsert_document(conn, args.doc_id)
        upsert_concepts(conn, args.doc_id)
        upsert_contexts(conn, args.doc_id)
        upsert_units(conn, args.doc_id)
        facts_loaded = load_facts(conn, args.doc_id)
        conn.commit()

        # Basic verification
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM raw.edinet_document WHERE doc_id=%s", (args.doc_id,))
            raw_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM staging.fact WHERE doc_id=%s", (args.doc_id,))
            staging_fact = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM core.document WHERE doc_id=%s", (args.doc_id,))
            core_doc = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*)
                FROM core.financial_fact f
                JOIN core.document d ON d.document_id = f.document_id
                WHERE d.doc_id = %s
                """,
                (args.doc_id,),
            )
            core_fact = cur.fetchone()[0]
    finally:
        conn.close()

    status = "success"
    reasons = []
    if raw_count == 0:
        status = "fail"
        reasons.append("raw_missing")
    if staging_fact == 0:
        status = "warn" if status != "fail" else status
        reasons.append("staging_fact_empty")
    if core_doc == 0:
        status = "fail"
        reasons.append("core_document_missing")
    if core_fact == 0:
        status = "warn" if status != "fail" else status
        reasons.append("core_fact_empty")

    log_jsonl(doc_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO" if status == "success" else "WARN",
        "event": "verify_load_core",
        "run_id": run_id,
        "doc_id": args.doc_id,
        "status": status,
        "reasons": reasons,
        "counts": {
            "raw": raw_count,
            "staging_fact": staging_fact,
            "core_document": core_doc,
            "core_fact": core_fact,
            "facts_loaded": facts_loaded,
        },
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
