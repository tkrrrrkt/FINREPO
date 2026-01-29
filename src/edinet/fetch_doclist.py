from __future__ import annotations

import argparse
import hashlib
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
import sys
from typing import Any, Dict, Iterable, List

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.config import load_config
from lib.db import get_conn, insert_raw_file, upsert_raw_edinet_documents
from lib.edinet_client import fetch_doclist
from lib.logger import log_jsonl


def parse_date(date_str: str | None):
    if not date_str:
        return None
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def parse_dt(dt_str: str | None):
    if not dt_str:
        return None
    return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")


def to_int(val: Any):
    if val is None:
        return None
    try:
        return int(str(val).strip())
    except Exception:
        return None


def build_date_list(start: str, end: str) -> List[str]:
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    dates = []
    cur = s
    while cur <= e:
        dates.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return dates


def qc_eval(r: Dict[str, Any]) -> List[str]:
    reasons: List[str] = []
    if (r.get("docTypeCode") or "").strip() != "120":
        reasons.append("not_annual_report")
    if to_int(r.get("xbrlFlag")) != 1:
        reasons.append("xbrl_missing")
    if to_int(r.get("withdrawalStatus")) in (1, 2):
        reasons.append("withdrawn")
    if to_int(r.get("docInfoEditStatus")) == 1:
        reasons.append("docinfo_edit_event")
    if to_int(r.get("disclosureStatus")) in (1, 2):
        reasons.append("non_disclosure")
    if to_int(r.get("legalStatus")) not in (1, 2):
        reasons.append("legal_status_invalid")
    return reasons


def map_result_to_row(
    r: Dict[str, Any],
    doclist_path: str,
    fetch_status: str,
    default_submission_date: str,
) -> Dict[str, Any]:
    period_end = parse_date(r.get("periodEnd"))
    fiscal_year = period_end.year if period_end else None
    submission_date = parse_date((r.get("submitDateTime") or "")[:10])
    if submission_date is None:
        submission_date = parse_date(default_submission_date)
    return {
        "doc_id": (r.get("docID") or "").strip(),
        "edinet_code": (r.get("edinetCode") or "").strip() or None,
        "sec_code": (r.get("secCode") or "").strip() or None,
        "jcn": (r.get("JCN") or "").strip() or None,
        "company_name": (r.get("filerName") or "").strip() or None,
        "fund_code": (r.get("fundCode") or "").strip() or None,
        "submission_date": submission_date,
        "ope_date_time": parse_dt(r.get("opeDateTime")),
        "doc_type_code": (r.get("docTypeCode") or "").strip() or None,
        "ordinance_code": (r.get("ordinanceCode") or "").strip() or None,
        "form_code": (r.get("formCode") or "").strip() or None,
        "doc_description": (r.get("docDescription") or "").strip() or None,
        "issuer_edinet_code": (r.get("issuerEdinetCode") or "").strip() or None,
        "subject_edinet_code": (r.get("subjectEdinetCode") or "").strip() or None,
        "subsidiary_edinet_code": (r.get("subsidiaryEdinetCode") or "").strip() or None,
        "period_start": parse_date(r.get("periodStart")),
        "period_end": period_end,
        "fiscal_year": fiscal_year,
        "accounting_standard": None,
        "is_consolidated": None,
        "is_amended": False,
        "parent_doc_id": (r.get("parentDocID") or "").strip() or None,
        "withdrawal_status": to_int(r.get("withdrawalStatus")),
        "doc_info_edit_status": to_int(r.get("docInfoEditStatus")),
        "disclosure_status": to_int(r.get("disclosureStatus")),
        "xbrl_flag": to_int(r.get("xbrlFlag")),
        "pdf_flag": to_int(r.get("pdfFlag")),
        "attach_doc_flag": to_int(r.get("attachDocFlag")),
        "english_doc_flag": to_int(r.get("englishDocFlag")),
        "csv_flag": to_int(r.get("csvFlag")),
        "legal_status": to_int(r.get("legalStatus")),
        "api_version": "v2",
        "doclist_json_path": doclist_path,
        "fetch_status": fetch_status,
    }


def save_doclist_json(doclist: Dict[str, Any], raw_root: Path, date_str: str) -> Path:
    date = datetime.strptime(date_str, "%Y-%m-%d")
    out_dir = raw_root / f"{date:%Y/%m/%d}"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "doclist.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(doclist, f, ensure_ascii=False, indent=2)
    return out_path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="src/config/config.yaml")
    parser.add_argument("--date", help="single date (YYYY-MM-DD)")
    parser.add_argument("--date-from", dest="date_from", help="start date (YYYY-MM-DD)")
    parser.add_argument("--date-to", dest="date_to", help="end date (YYYY-MM-DD)")
    args = parser.parse_args()

    cfg = load_config(args.config)
    edinet_cfg = cfg.get("edinet", {})
    db_cfg = cfg.get("db", {})
    paths_cfg = cfg.get("paths", {})

    base_url = edinet_cfg.get("base_url")
    api_key = edinet_cfg.get("api_key")
    if not base_url or not api_key:
        raise SystemExit("Missing edinet.base_url or edinet.api_key in config")

    if args.date:
        dates = [args.date]
    else:
        dr = edinet_cfg.get("date_range", {})
        start = args.date_from or dr.get("from")
        end = args.date_to or dr.get("to")
        if not start or not end:
            raise SystemExit("date range is required")
        dates = build_date_list(start, end)

    raw_root = Path(paths_cfg.get("raw_root", "data/raw/edinet"))
    log_root = Path(paths_cfg.get("log_root", "data/logs/edinet"))
    rate_limit_sec = float(edinet_cfg.get("rate_limit_sec", 2))
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"run_{run_id}.jsonl"
    doc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"doc_{datetime.now():%Y%m%d}.jsonl"
    qc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"qc_{datetime.now():%Y%m%d}.jsonl"

    log_jsonl(run_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "run_start",
        "run_id": run_id,
        "mode": "doclist",
        "date_range": {"from": dates[0], "to": dates[-1]},
    })

    conn = get_conn(db_cfg)
    total = 0
    try:
        last_call = 0.0
        for d in dates:
            now = time.time()
            wait = rate_limit_sec - (now - last_call)
            if wait > 0:
                time.sleep(wait)
            doclist = fetch_doclist(base_url, api_key, d, doc_type=2)
            last_call = time.time()
            doclist_path = save_doclist_json(doclist, raw_root, d)
            doclist_size = doclist_path.stat().st_size
            doclist_sha = sha256_file(doclist_path)
            results = doclist.get("results", []) or []

            rows = []
            for r in results:
                reasons = qc_eval(r)
                fetch_status = "listed" if not reasons else "excluded"
                rows.append(map_result_to_row(r, str(doclist_path), fetch_status, d))

                if reasons:
                    log_jsonl(qc_log, {
                        "ts": datetime.now().isoformat(),
                        "level": "WARN",
                        "event": "qc_fail",
                        "run_id": run_id,
                        "doc_id": (r.get("docID") or "").strip(),
                        "qc_status": "fail",
                        "qc_reason": reasons,
                    })
            total += upsert_raw_edinet_documents(conn, rows)

            for r in rows:
                insert_raw_file(
                    conn,
                    r.get("doc_id"),
                    "doclist_json",
                    str(doclist_path),
                    doclist_size,
                    doclist_sha,
                )

            for r in rows:
                log_jsonl(doc_log, {
                    "ts": datetime.now().isoformat(),
                    "level": "INFO",
                    "event": "doc_listed",
                    "run_id": run_id,
                    "doc_id": r.get("doc_id"),
                    "edinet_code": r.get("edinet_code"),
                    "sec_code": r.get("sec_code"),
                    "status": "listed",
                    "date": d,
                })
    finally:
        conn.close()

    log_jsonl(run_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "run_end",
        "run_id": run_id,
        "documents": total,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
