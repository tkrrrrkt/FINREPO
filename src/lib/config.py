from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

import yaml


def load_config(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    # Environment overrides (minimal)
    api_key = os.getenv("EDINET_API_KEY")
    if api_key:
        cfg.setdefault("edinet", {})["api_key"] = api_key

    db_pass = os.getenv("EDINET_DB_PASSWORD")
    if db_pass:
        cfg.setdefault("db", {})["password"] = db_pass

    return cfg
