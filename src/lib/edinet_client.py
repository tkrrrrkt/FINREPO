from __future__ import annotations

from typing import Any, Dict

import requests


def fetch_doclist(base_url: str, api_key: str, date_str: str, doc_type: int = 2) -> Dict[str, Any]:
    url = f"{base_url}/documents.json"
    params = {
        "date": date_str,
        "type": doc_type,
        "Subscription-Key": api_key,
    }
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def fetch_document_zip(base_url: str, api_key: str, doc_id: str, doc_type: int = 1) -> bytes:
    url = f"{base_url}/documents/{doc_id}"
    params = {
        "type": doc_type,
        "Subscription-Key": api_key,
    }
    resp = requests.get(url, params=params, timeout=120)
    resp.raise_for_status()
    return resp.content
