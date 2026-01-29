# EDINET パイプライン実行手順（ローカル）

この手順は **1社・1docID** での動作確認から、日次/週次の更新までを想定した最小構成です。

## 1. 前提
- PostgreSQL がローカルで起動済み
- EDINET APIキーが取得済み
- Python3 がインストール済み

## 1.1 Python 依存関係のセットアップ（初回のみ）
推奨: 仮想環境を使う
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

簡易（仮想環境を使わない場合）
```bash
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

## 2. DB初期化
```bash
DB_PASSWORD='あなたのパスワード' ./scripts/init_db.sh
```

オプションで上書き可能です。
```bash
DB_NAME=edinet DB_USER=edinet_user DB_HOST=127.0.0.1 DB_PORT=5432 DB_PASSWORD='***' ./scripts/init_db.sh
```

## 3. 設定ファイル
`src/config/config.yaml` に APIキーとDB接続情報を設定します。

- 例: `src/config/config.yaml`
```yaml
edinet:
  api_key: "<YOUR_API_KEY>"
  base_url: "https://api.edinet-fsa.go.jp/api/v2"
  rate_limit_sec: 2
  type: 2
  doc_type_code: "120"
  ordinance_code: "010"
  form_code: ["030000", "030001"]
  date_range:
    from: "2021-01-01"
    to: "2021-12-31"
  weekly_days_back: 14

paths:
  raw_root: "data/raw/edinet"
  log_root: "data/logs/edinet"

db:
  host: "localhost"
  port: 5432
  name: "edinet"
  user: "edinet_user"
  password: "<YOUR_DB_PASSWORD>"

qc:
  duration_days_min: 330
  duration_days_max: 400
  non_jpy_policy: "exclude"
```

**注**: パスワードは `EDINET_DB_PASSWORD` 環境変数でも指定できます。

## 4. 1社・1docID テスト
### 4.1 doclist 取得
```bash
python src/edinet/fetch_doclist.py --date 2021-06-30
```

### 4.2 ZIP 取得（raw.edinet_document から自動選択）
```bash
python src/edinet/fetch_zip.py --limit 5
```

### 4.3 docID を1つ選ぶ
DBで対象 doc_id を確認します。
```bash
psql -U edinet_user -d edinet -c "select doc_id, company_name, submission_date from raw.edinet_document where zip_path is not null order by submission_date desc limit 5;"
```

### 4.4 XBRL解析 → staging
```bash
python src/edinet/parse_xbrl.py --doc-id <DOC_ID>
```

### 4.5 core 取込 + 簡易検証
```bash
python src/edinet/verify_load_core.py --doc-id <DOC_ID>
```

## 5. 週次運用（例）
- `weekly_days_back=14` を使い、直近14日分の doclist を取得
- 取得済み docID は重複排除されます

```bash
python src/edinet/fetch_doclist.py --date-from 2026-01-15 --date-to 2026-01-28
python src/edinet/fetch_zip.py --limit 1000
```

## 6. ログの確認
- `data/logs/edinet/YYYY/MM/DD/*.jsonl`
- 主要ログ: `run_*.jsonl`, `doc_*.jsonl`, `qc_*.jsonl`, `error_*.jsonl`
