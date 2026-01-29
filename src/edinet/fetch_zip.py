from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.config import load_config
from lib.db import get_conn, insert_raw_file
from lib.edinet_client import fetch_document_zip
from lib.logger import log_jsonl


def slugify(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"\s+", "-", name)
    name = re.sub(r"[^a-z0-9\\-]", "", name)
    return name or "unknown"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def select_targets(conn, limit: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT doc_id, sec_code, company_name, submission_date
        FROM raw.edinet_document
        WHERE zip_path IS NULL
          AND doc_type_code = '120'
          AND xbrl_flag = 1
          AND withdrawal_status = 0
          AND disclosure_status IN (0, 3)
          AND legal_status IN (1, 2)
          AND doc_info_edit_status <> 1
        ORDER BY submission_date ASC
        LIMIT %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (limit,))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def update_zip_path(conn, doc_id: str, zip_path: str) -> None:
    sql = """
        UPDATE raw.edinet_document
        SET zip_path = %s,
            extracted_path = %s,
            fetch_status = 'zip_downloaded'
        WHERE doc_id = %s
    """
    with conn.cursor() as cur:
        extract_path = str(Path(zip_path).parent / "extracted")
        cur.execute(sql, (zip_path, extract_path, doc_id))
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="src/config/config.yaml")
    parser.add_argument("--limit", type=int, default=1000)
    args = parser.parse_args()

    cfg = load_config(args.config)
    edinet_cfg = cfg.get("edinet", {})
    db_cfg = cfg.get("db", {})
    paths_cfg = cfg.get("paths", {})

    base_url = edinet_cfg.get("base_url")
    api_key = edinet_cfg.get("api_key")
    if not base_url or not api_key:
        raise SystemExit("Missing edinet.base_url or edinet.api_key in config")

    raw_root = Path(paths_cfg.get("raw_root", "data/raw/edinet"))
    log_root = Path(paths_cfg.get("log_root", "data/logs/edinet"))
    rate_limit_sec = float(edinet_cfg.get("rate_limit_sec", 2))

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"run_{run_id}.jsonl"
    doc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"doc_{datetime.now():%Y%m%d}.jsonl"

    log_jsonl(run_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "run_start",
        "run_id": run_id,
        "mode": "zip_download",
    })

    conn = get_conn(db_cfg)
    try:
        targets = select_targets(conn, args.limit)
        last_call = 0.0
        for t in targets:
            now = time.time()
            wait = rate_limit_sec - (now - last_call)
            if wait > 0:
                time.sleep(wait)

            doc_id = t["doc_id"]
            sec_code = t.get("sec_code") or ""
            company_slug = slugify(t.get("company_name") or "")
            submission_date = t.get("submission_date")
            if not submission_date:
                # fallback to today if missing
                submission_date = datetime.now().date()

            out_dir = raw_root / f"{submission_date:%Y/%m/%d}" / f"{doc_id}_{sec_code}_{company_slug}"
            out_dir.mkdir(parents=True, exist_ok=True)
            zip_path = out_dir / "document.zip"

            data = fetch_document_zip(base_url, api_key, doc_id, doc_type=1)
            last_call = time.time()

            zip_path.write_bytes(data)
            update_zip_path(conn, doc_id, str(zip_path))
            insert_raw_file(conn, doc_id, "zip", str(zip_path), len(data), sha256_bytes(data))

            log_jsonl(doc_log, {
                "ts": datetime.now().isoformat(),
                "level": "INFO",
                "event": "zip_downloaded",
                "run_id": run_id,
                "doc_id": doc_id,
                "sec_code": sec_code,
                "status": "success",
                "size_bytes": len(data),
                "sha256": sha256_bytes(data),
            })
    finally:
        conn.close()

    log_jsonl(run_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "run_end",
        "run_id": run_id,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
