from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Optional

sys.path.append(str(Path(__file__).resolve().parents[1]))

from lib.config import load_config
from lib.concept_mapper import mapper as concept_mapper, FinancialMetric
from lib.unit_normalizer import normalizer as unit_normalizer
from lib.concept_hierarchy import ConceptHierarchyExtractor  # Issue #2
from lib.db import (
    get_conn,
    load_context_map,
    load_unit_map,
    upsert_staging_concept_hierarchy,
    upsert_staging_contexts,
    upsert_staging_facts,
    upsert_staging_units,
)
from lib.logger import log_jsonl


def extract_zip(zip_path: Path, extract_dir: Path) -> None:
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)


def find_xbrl_file(extract_dir: Path) -> Optional[Path]:
    public_dir = extract_dir / "XBRL" / "PublicDoc"
    if not public_dir.exists():
        return None

    # Prefer .xbrl instance (most stable for parsing)
    xbrl_files = sorted(public_dir.glob("*.xbrl"))
    if xbrl_files:
        return xbrl_files[0]

    # Fallback: IXBRL manifest if exists
    manifest = public_dir / "manifest_PublicDoc.xml"
    if manifest.exists():
        return manifest

    # Fallback: iXBRL (.htm) - prefer header file if present
    htm_files = sorted(public_dir.glob("*.htm"))
    if htm_files:
        for f in htm_files:
            if "header" in f.name.lower():
                return f
        return htm_files[0]

    return None


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def to_decimal(val: Any) -> Optional[Decimal]:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return None


def build_context_hash(rec: Dict[str, Any]) -> str:
    payload = json.dumps(
        {
            "period_type": rec.get("period_type"),
            "period_start": str(rec.get("period_start") or ""),
            "period_end": str(rec.get("period_end") or ""),
            "instant_date": str(rec.get("instant_date") or ""),
            "entity_identifier": rec.get("entity_identifier"),
            "is_consolidated": rec.get("is_consolidated"),
            "dimensions": rec.get("dimensions") or {},
        },
        ensure_ascii=True,
        sort_keys=True,
    )
    return sha256_text(payload)


def normalize_dims(dims: Dict[Any, Any]) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for axis_qname, member_qname in dims.items():
        axis = str(axis_qname)
        member = str(member_qname)
        normalized[axis] = member
    return dict(sorted(normalized.items(), key=lambda x: x[0]))


def infer_consolidated(dims: Dict[str, str]) -> Optional[bool]:
    """
    連結/単体フラグの推定ルール:
    1. Dimension内の member から Consolidated/NonConsolidated キーワードを検出
    2. キーワードが見つからない場合は None を返す
    3. 呼び出し側で document type や context ID パターンから推測可能

    Bug #1 Fix:
    - 各 member を文字列に変換して検索 (str(member))
    - NonConsolidated/Separate = False (単体財務)
    - Consolidated = True (連結財務)
    """
    if not dims:
        return None

    # Dimension内のメンバーをチェック
    for axis, member in dims.items():
        member_str = str(member).lower()  # 大文字小文字を統一

        # 単体（非連結）の判定
        if "nonconsolidated" in member_str or "separate" in member_str:
            return False

        # 連結の判定
        if "consolidated" in member_str:
            return True

    # キーワードが見つからない場合
    return None


def parse_with_arelle(xbrl_path: Path, doc_id: str) -> Dict[str, Any]:
    try:
        from arelle import Cntlr  # type: ignore
    except Exception as exc:
        raise RuntimeError("Arelle is not installed. Install arelle-release.") from exc

    cntlr = Cntlr.Cntlr(logFileName="logToPrint")
    model_xbrl = cntlr.modelManager.load(str(xbrl_path))

    contexts = []
    for _, ctx in model_xbrl.contexts.items():
        period_type = None
        period_start = None
        period_end = None
        instant_date = None
        if ctx.isInstantPeriod:
            period_type = "instant"
            instant_date = ctx.instantDatetime.date()
            period_end = instant_date
        elif ctx.isStartEndPeriod:
            period_type = "duration"
            period_start = ctx.startDatetime.date()
            period_end = ctx.endDatetime.date()

        entity_identifier = None
        try:
            scheme, identifier = ctx.entityIdentifier
            entity_identifier = f"{scheme}|{identifier}"
        except Exception:
            entity_identifier = None

        dims = normalize_dims(ctx.qnameDims)
        is_consolidated = infer_consolidated(dims)
        rec = {
            "doc_id": doc_id,
            "context_ref": ctx.id,
            "period_type": period_type,
            "period_start": period_start,
            "period_end": period_end,
            "instant_date": instant_date,
            "entity_identifier": entity_identifier,
            "is_consolidated": is_consolidated,
            "dimensions": dims or None,
        }
        rec["context_hash"] = build_context_hash(rec)
        contexts.append(rec)

    units = []
    for unit in model_xbrl.units.values():
        measures = {"numerator": [], "denominator": []}
        for m in unit.measures[0]:
            measures["numerator"].append(str(m))
        for m in unit.measures[1]:
            measures["denominator"].append(str(m))
        rec = {
            "doc_id": doc_id,
            "unit_ref": unit.id,
            "measures": measures,
            "unit_hash": sha256_text(json.dumps(measures, ensure_ascii=True, sort_keys=True)),
        }
        units.append(rec)

    # Issue #2: Concept階層構造を抽出
    hierarchy_extractor = ConceptHierarchyExtractor()
    concept_relations = hierarchy_extractor.extract_from_model_xbrl(model_xbrl)
    concept_hierarchy = [
        {
            "doc_id": doc_id,
            "child_concept_name": rel.child_concept_name,
            "parent_concept_name": rel.parent_concept_name,
            "hierarchy_level": rel.hierarchy_level,
        }
        for rel in concept_relations
    ]

    return {"contexts": contexts, "units": units, "facts": model_xbrl.facts, "concept_hierarchy": concept_hierarchy}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="src/config/config.yaml")
    parser.add_argument("--doc-id", required=True)
    args = parser.parse_args()

    cfg = load_config(args.config)
    db_cfg = cfg.get("db", {})
    paths_cfg = cfg.get("paths", {})

    raw_root = Path(paths_cfg.get("raw_root", "data/raw/edinet"))
    log_root = Path(paths_cfg.get("log_root", "data/logs/edinet"))
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    doc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"doc_{datetime.now():%Y%m%d}.jsonl"

    conn = get_conn(db_cfg)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT zip_path FROM raw.edinet_document WHERE doc_id = %s",
                (args.doc_id,),
            )
            row = cur.fetchone()
            if not row or not row[0]:
                raise SystemExit(f"zip_path not found for doc_id={args.doc_id}")
            zip_path = Path(row[0])
    finally:
        conn.close()

    extract_dir = zip_path.parent / "extracted"
    if not extract_dir.exists():
        extract_zip(zip_path, extract_dir)

    xbrl_file = find_xbrl_file(extract_dir)
    if not xbrl_file:
        raise SystemExit("XBRL/PublicDoc not found")

    # Parse with Arelle
    parsed = parse_with_arelle(xbrl_file, args.doc_id)

    # QC checks (warn/fail)
    qc_cfg = cfg.get("qc", {})
    min_days = int(qc_cfg.get("duration_days_min", 330))
    max_days = int(qc_cfg.get("duration_days_max", 400))
    qc_reasons = []
    qc_warn = []

    if not parsed["contexts"]:
        qc_reasons.append("no_contexts")
    if not parsed["facts"]:
        qc_reasons.append("no_facts")

    # consolidated flag check
    if parsed["contexts"]:
        if all(c.get("is_consolidated") is None for c in parsed["contexts"]):
            qc_warn.append("consolidation_flag_missing")

    # duration length check
    for c in parsed["contexts"]:
        if c.get("period_type") == "duration" and c.get("period_start") and c.get("period_end"):
            days = (c["period_end"] - c["period_start"]).days
            if days < min_days or days > max_days:
                qc_warn.append("duration_out_of_range")
                break

    qc_log = log_root / datetime.now().strftime("%Y/%m/%d") / f"qc_{datetime.now():%Y%m%d}.jsonl"
    if qc_reasons:
        log_jsonl(qc_log, {
            "ts": datetime.now().isoformat(),
            "level": "WARN",
            "event": "qc_fail",
            "run_id": run_id,
            "doc_id": args.doc_id,
            "qc_status": "fail",
            "qc_reason": qc_reasons,
        })
        raise SystemExit(f"QC failed: {qc_reasons}")

    if qc_warn:
        log_jsonl(qc_log, {
            "ts": datetime.now().isoformat(),
            "level": "WARN",
            "event": "qc_warn",
            "run_id": run_id,
            "doc_id": args.doc_id,
            "qc_status": "warn",
            "qc_reason": sorted(set(qc_warn)),
        })

    # Insert into staging
    conn = get_conn(db_cfg)
    try:
        upsert_staging_contexts(conn, parsed["contexts"])
        upsert_staging_units(conn, parsed["units"])

        # Issue #2: Concept階層構造を保存
        if parsed.get("concept_hierarchy"):
            upsert_staging_concept_hierarchy(conn, parsed["concept_hierarchy"])

        context_map = load_context_map(conn, args.doc_id, [c["context_ref"] for c in parsed["contexts"]])
        unit_map = load_unit_map(conn, args.doc_id, [u["unit_ref"] for u in parsed["units"]])

        facts_map: Dict[str, Dict[str, Any]] = {}
        dup_count = 0
        conflict_count = 0
        for f in parsed["facts"]:
            concept_qname = str(f.qname)
            concept_namespace = f.qname.prefix
            concept_name = f.qname.localName
            context_ref = f.contextID
            unit_ref = f.unitID or ""

            if not context_ref:
                continue

            context_id = context_map.get(context_ref)
            unit_id = unit_map.get(unit_ref) if unit_ref else None
            if not context_id:
                continue

            # Bug #7 Fix: Handle nil values properly
            # If is_nil=true, set values to None regardless of computed values
            if f.isNil:
                value_numeric = None
                value_text = None
            else:
                # Bug #4 Fix: xValue from Arelle already includes decimal normalization
                value_numeric = to_decimal(f.xValue) if f.isNumeric else None
                value_text = None if f.isNumeric else (f.value or None)

            # Issue #3 Fix: Unit正規化
            unit_ref_normalized, value_normalized = unit_normalizer.normalize(
                unit_ref, value_numeric
            )

            fact_hash = sha256_text(f"{args.doc_id}|{concept_qname}|{context_ref}|{unit_ref}")

            row = {
                "doc_id": args.doc_id,
                "concept_qname": concept_qname,
                "concept_namespace": concept_namespace,
                "concept_name": concept_name,
                "context_id": context_id,
                "unit_id": unit_id,
                "value_numeric": value_numeric,
                "value_text": value_text,
                "unit_ref_normalized": unit_ref_normalized,
                "value_normalized": value_normalized,
                "decimals": f.decimals,
                "is_nil": f.isNil,
                "fact_hash": fact_hash,
            }

            existing = facts_map.get(fact_hash)
            if existing:
                dup_count += 1
                if (
                    existing.get("value_numeric") != row.get("value_numeric")
                    or existing.get("value_text") != row.get("value_text")
                    or existing.get("decimals") != row.get("decimals")
                    or existing.get("is_nil") != row.get("is_nil")
                ):
                    conflict_count += 1
                continue

            facts_map[fact_hash] = row

        facts_rows = list(facts_map.values())
        if dup_count:
            log_jsonl(qc_log, {
                "ts": datetime.now().isoformat(),
                "level": "WARN",
                "event": "fact_dedup",
                "run_id": run_id,
                "doc_id": args.doc_id,
                "dup_count": dup_count,
                "conflict_count": conflict_count,
            })

        upsert_staging_facts(conn, facts_rows)
    finally:
        conn.close()

    log_jsonl(doc_log, {
        "ts": datetime.now().isoformat(),
        "level": "INFO",
        "event": "parse_xbrl_staging",
        "run_id": run_id,
        "doc_id": args.doc_id,
        "xbrl_path": str(xbrl_file),
        "status": "success",
    })

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
