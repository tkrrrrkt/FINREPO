# Claude

# EDINET×XBRL×EPM企業比較基盤の設計・実装ガイド

金融庁EDINETから有価証券報告書を自動取得し、XBRL解析を経てRDBに格納、EPM指標で「企業比較」を可能にするシステムは、**API Version 2（2024年4月稼働）の活用、3層データアーキテクチャ、そして会計基準差異への対応**が成否を分ける。本レポートでは、一次情報に基づく技術要件から実装方針までを網羅的に整理し、再現可能な形で提示する。

---

## EDINET API Version 2の技術仕様

EDINET APIは2024年4月にVersion 2へ移行し、**APIキー認証が必須**となった。書類一覧API（`/api/v2/documents.json`）と書類取得API（`/api/v2/documents/{docID}`）の2つのエンドポイントで構成され、過去**10年分**の開示書類にアクセス可能である。

### APIキー取得とアクセス制御

APIキーは金融庁の登録画面（`https://api.edinet-fsa.go.jp/api/auth/index.aspx?mode=1`）からMicrosoftアカウント認証＋SMS多要素認証で取得する。明示的なレート制限は仕様書に記載がないが、**1〜3秒のリクエスト間隔**を設けることが推奨されている。データは**公共データ利用規約（PDL1.0）準拠**で、出典記載を条件に商用利用・再配布が可能である。

書類取得時は`type`パラメータで形式を指定する。`type=1`でXBRL含むZIP、`type=5`で2024年4月から追加されたCSVファイルが取得できる。ZIPファイル内は`XBRL/PublicDoc/`配下にiXBRL形式（`.htm`）の本文書が格納される。

---

## 表1：有価証券報告書判定ロジック

|判定条件|フィルタ式|対象範囲|
|---|---|---|
|書類種別コードのみ|`docTypeCode == "120"`|全有報（投資信託含む）|
|上場企業限定|`ordinanceCode == "010" AND formCode == "030000"`|上場企業の有報のみ|
|証券コード存在|`docTypeCode == "120" AND secCode IS NOT NULL`|上場企業（投信除外）|
|訂正有報含む|`docTypeCode IN ("120", "130")`|有報＋訂正有報|
|四半期報告書|`docTypeCode == "140"`|四半期報告書|

**実装推奨**: `ordinanceCode == "010" AND formCode IN ("030000", "030001")`で有報・訂正有報を取得し、`parentDocID`で訂正元を紐付ける。

---

## EDINETタクソノミの階層構造

EDINETタクソノミは**DEI（文書・主体情報）、内閣府令タクソノミ、財務諸表本表タクソノミ（JGAAP/IFRS）**の3層構造を持つ。名前空間プレフィックスは`jppfs_cor`（財務諸表本表・日本基準）、`jpcrp_cor`（開示府令）、`jpdei_cor`（DEI）、`jpigp_cor`（IFRS）が主要である。

タクソノミは毎年更新され、2025年版は2025年3月31日以後終了事業年度から適用される。公式リソースとして、金融庁サイト（`https://www.fsa.go.jp/search/20241112.html`）からタクソノミ本体、要素リスト、勘定科目リストがダウンロード可能である。

### 連結/個別の判定方法

XBRLのcontext内scenario要素で`jppfs_cor:ConsolidatedOrNonConsolidatedAxis`軸を確認する。**scenario省略時はデフォルトで連結**、`NonConsolidatedMember`指定時が個別財務諸表となる。コンテキストID命名規約では`CurrentYearInstant_NonConsolidatedMember`のように接尾辞で判別可能である。

---

## 表2：最小項目セット（BS/PL/CF/従業員数）

### 貸借対照表（BS）- periodType: instant

|日本語名|element_name|namespace|
|---|---|---|
|総資産|Assets|jppfs_cor|
|流動資産|CurrentAssets|jppfs_cor|
|現金及び預金|CashAndDeposits|jppfs_cor|
|受取手形及び売掛金|NotesAndAccountsReceivableTrade|jppfs_cor|
|棚卸資産|Inventories|jppfs_cor|
|固定資産|NoncurrentAssets|jppfs_cor|
|有形固定資産|PropertyPlantAndEquipment|jppfs_cor|
|負債合計|Liabilities|jppfs_cor|
|流動負債|CurrentLiabilities|jppfs_cor|
|固定負債|NoncurrentLiabilities|jppfs_cor|
|純資産合計|NetAssets|jppfs_cor|
|株主資本合計|ShareholdersEquity|jppfs_cor|

### 損益計算書（PL）- periodType: duration

|日本語名|element_name|namespace|
|---|---|---|
|売上高|NetSales|jppfs_cor|
|売上原価|CostOfSales|jppfs_cor|
|売上総利益|GrossProfit|jppfs_cor|
|販売費及び一般管理費|SellingGeneralAndAdministrativeExpenses|jppfs_cor|
|営業利益|OperatingIncome|jppfs_cor|
|経常利益|OrdinaryIncome|jppfs_cor|
|当期純利益|ProfitLoss|jppfs_cor|
|親会社株主帰属利益|ProfitLossAttributableToOwnersOfParent|jppfs_cor|

### キャッシュフロー計算書（CF）- periodType: duration

|日本語名|element_name|namespace|
|---|---|---|
|営業CF|NetCashProvidedByUsedInOperatingActivities|jppfs_cor|
|投資CF|NetCashProvidedByUsedInInvestingActivities|jppfs_cor|
|財務CF|NetCashProvidedByUsedInFinancingActivities|jppfs_cor|
|現金同等物期末残高|CashAndCashEquivalents|jppfs_cor|

### DEI・非財務データ

|日本語名|element_name|namespace|
|---|---|---|
|従業員数|NumberOfEmployees|jpcrp_cor|
|EDINETコード|EDINETCodeDEI|jpdei_cor|
|証券コード|SecurityCodeDEI|jpdei_cor|
|会計基準|AccountingStandardsDEI|jpdei_cor|
|決算日|CurrentFiscalYearEndDateDEI|jpdei_cor|

---

## XBRL解析ライブラリと実装パターン

### 推奨ライブラリ構成

Python環境では**Arelle**（`pip install arelle-release`）を中心に、EDINET固有処理には**edinet-xbrl**を併用する構成が最適である。Arelleはタクソノミ解析、dimension処理、日本語ラベル取得に強みを持ち、XBRL International認定の信頼性がある。

```python
# Arelle基本パターン
from arelle import Cntlr
cntlr = Cntlr.Cntlr(logFileName='logToPrint')
model_xbrl = cntlr.modelManager.load(xbrl_path)

for fact in model_xbrl.facts:
    qname = str(fact.qname)
    label_ja = fact.concept.label(lang='ja')
    context = fact.context
    value = fact.xValue
    decimals = fact.decimals
    unit = str(fact.unit.measures[0][0]) if fact.unit else None
```

### decimals属性によるスケーリング処理

XBRL数値はdecimals属性で精度を表現する。`decimals="-6"`は百万円単位、`decimals="0"`は円単位を意味する。EDINETでは値自体がスケール済みの場合が多いため、**単位（unit）とdecimals両方を確認**して正規化する必要がある。

### 日次バッチの増分取得設計

前回取得日をJSON/DBで管理し、それ以降の日付を順次処理する。**Exponential Backoff with Jitter**でリトライし、構造化ログ（JSON形式）で監査証跡を残す設計が推奨される。訂正有報は`parentDocID`で元書類を特定し、UPSERT（`ON CONFLICT DO UPDATE`）で既存データを更新する。

---

## 表3：正規化ルール

|ルールID|項目|正規化内容|実装方法|
|---|---|---|---|
|NR-01|金額単位|百万円に統一|decimals属性に基づき変換|
|NR-02|売上関連科目|NetSalesに統一|営業収益、事業収益をマッピング|
|NR-03|有利子負債|個別科目を合算|短期借入金+長期借入金+社債+リース債務|
|NR-04|会計基準フラグ|JGAAP/IFRS識別|AccountingStandardsDEI参照|
|NR-05|連結/個別フラグ|軸メンバーで判定|ConsolidatedOrNonConsolidatedAxis|
|NR-06|期間表記|終了月の年度で統一|2024年3月期→FY2024|
|NR-07|拡張タクソノミ|親要素にマッピング|企業独自科目→標準科目|
|NR-08|IFRS営業利益|調整後指標を計算|持分法損益除外で近似|
|NR-09|のれん償却|IFRS企業に擬似計上|同業種平均償却率適用（注記付）|
|NR-10|変則決算|年率換算|9ヶ月決算×12/9（注記付）|

---

## 表4：RDBスキーマ設計（3層アーキテクチャ）

### Bronze層（raw スキーマ）- 生データ保持

```sql
CREATE TABLE raw.edinet_document (
    id              BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(20) UNIQUE NOT NULL,
    raw_json        JSONB NOT NULL,          -- API response全体
    xbrl_zip_path   TEXT,
    fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE raw.xbrl_instance (
    id              BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(20) REFERENCES raw.edinet_document(doc_id),
    instance_xml    TEXT,                    -- 生XML保持
    parsed_facts    JSONB                    -- パース済みJSON
);
```

### Silver層（curated スキーマ）- 正規化済み

```sql
CREATE TABLE curated.company_master (
    company_id      SERIAL PRIMARY KEY,
    edinet_code     VARCHAR(10) UNIQUE,
    securities_code VARCHAR(10),
    corporate_number VARCHAR(13),
    company_name    VARCHAR(200) NOT NULL,
    industry_code   VARCHAR(10),
    fiscal_year_end SMALLINT,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE curated.document (
    document_id     BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(20) UNIQUE NOT NULL,
    company_id      INTEGER REFERENCES curated.company_master(company_id),
    doc_type_code   VARCHAR(10) NOT NULL,
    submission_date DATE NOT NULL,
    period_start    DATE,
    period_end      DATE,
    fiscal_year     SMALLINT,
    is_consolidated BOOLEAN DEFAULT TRUE,
    is_amended      BOOLEAN DEFAULT FALSE
) PARTITION BY RANGE (submission_date);

CREATE TABLE curated.financial_fact (
    fact_id         BIGSERIAL,
    document_id     BIGINT REFERENCES curated.document(document_id),
    company_id      INTEGER REFERENCES curated.company_master(company_id),
    concept_id      INTEGER REFERENCES curated.taxonomy_concept(concept_id),
    context_id      INTEGER REFERENCES curated.fact_context(context_id),
    value_numeric   NUMERIC(30, 6),
    value_text      TEXT,
    unit_id         INTEGER,
    decimals        SMALLINT,
    dimension_json  JSONB,
    PRIMARY KEY (fact_id, document_id)
) PARTITION BY RANGE (document_id);

CREATE TABLE curated.taxonomy_concept (
    concept_id      SERIAL PRIMARY KEY,
    namespace       VARCHAR(100) NOT NULL,
    element_name    VARCHAR(200) NOT NULL,
    label_ja        VARCHAR(500),
    label_en        VARCHAR(500),
    data_type       VARCHAR(50),
    period_type     VARCHAR(20),
    balance_type    VARCHAR(10),
    UNIQUE (namespace, element_name)
);
```

### Gold層（metrics スキーマ）- 計算済み指標

```sql
CREATE TABLE metrics.company_financials (
    id              BIGSERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL,
    fiscal_year     SMALLINT NOT NULL,
    period_end      DATE NOT NULL,
    revenue         NUMERIC(20, 0),
    operating_income NUMERIC(20, 0),
    net_income      NUMERIC(20, 0),
    total_assets    NUMERIC(20, 0),
    net_assets      NUMERIC(20, 0),
    roe             NUMERIC(10, 4),
    roa             NUMERIC(10, 4),
    roic            NUMERIC(10, 4),
    operating_margin NUMERIC(10, 4),
    is_consolidated BOOLEAN DEFAULT TRUE,
    UNIQUE (company_id, fiscal_year, is_consolidated)
) PARTITION BY RANGE (period_end);
```

### インデックス設計

```sql
CREATE INDEX idx_company_name_trgm ON curated.company_master 
    USING gin (company_name gin_trgm_ops);
CREATE INDEX idx_fact_dimension_gin ON curated.financial_fact 
    USING gin (dimension_json jsonb_path_ops);
CREATE INDEX idx_metrics_company_year ON metrics.company_financials(company_id, fiscal_year);
```

---

## 表5：EPM指標定義書（15指標）

|#|指標名|計算式|使用concept|欠損時ルール|
|---|---|---|---|---|
|1|**ROE**|当期純利益 ÷ 自己資本 × 100|ProfitLoss, NetAssets|自己資本≤0は計算不可|
|2|**ROA**|当期純利益 ÷ 総資産 × 100|ProfitLoss, Assets|期首期末平均使用|
|3|**ROIC**|NOPAT ÷ 投下資本 × 100|OperatingIncome, 有利子負債, 株主資本|NOPAT=営業利益×(1-30%)|
|4|**営業利益率**|営業利益 ÷ 売上高 × 100|OperatingIncome, NetSales|売上高=0は計算不可|
|5|**経常利益率**|経常利益 ÷ 売上高 × 100|OrdinaryIncome, NetSales|IFRS企業は代替計算|
|6|**純利益率**|当期純利益 ÷ 売上高 × 100|ProfitLoss, NetSales|-|
|7|**EBITDA**|営業利益 + 減価償却費|OperatingIncome, Depreciation|減価償却費はCFから取得|
|8|**EBITDAマージン**|EBITDA ÷ 売上高 × 100|上記 + NetSales|-|
|9|**粗利率**|売上総利益 ÷ 売上高 × 100|GrossProfit, NetSales|-|
|10|**販管費率**|販管費 ÷ 売上高 × 100|SGA, NetSales|-|
|11|**CCC**|売上債権日数 + 棚卸資産日数 - 仕入債務日数|各勘定科目×365÷回転基準|構成要素nullは0扱い|
|12|**総資産回転率**|売上高 ÷ 総資産（回）|NetSales, Assets|期首期末平均使用|
|13|**自己資本比率**|自己資本 ÷ 総資産 × 100|NetAssets, Assets|-|
|14|**D/Eレシオ**|有利子負債 ÷ 自己資本（倍）|借入金合算, NetAssets|自己資本≤0は計算不可|
|15|**ICR**|(営業利益+受取利息) ÷ 支払利息（倍）|OperatingIncome, Interest|支払利息=0は∞|

---

## 企業間比較を阻害する5つの要因

### 会計基準差異（JGAAP vs IFRS）

最大の障壁は**営業利益の定義差異**である。JGAAPでは「売上総利益−販管費」と明確だが、IFRSでは定義がなく企業独自の「事業利益」「コア営業利益」が混在する。さらに**のれん償却の有無**（JGAAP：20年以内で償却、IFRS：非償却）が利益水準に直接影響する。2027年のIFRS18号適用で営業・投資・財務の3区分が明確化される予定である。

### 表示科目と拡張タクソノミの揺れ

同一概念でも「売上高」「営業収益」「事業収益」と表記が分かれ、企業独自の拡張タクソノミで科目名が追加される。**科目マッピングテーブル**を整備し、正規表現やタクソノミ親要素への集約で対応する必要がある。

### 注記依存項目の非構造化

有利子負債の内訳、減価償却方法、セグメント情報の詳細は注記テキストに埋もれており、XBRLで完全に構造化されていない。現時点では**キャッシュフロー計算書の減価償却費**取得が最も信頼性が高い。

---

## 表6：リスクマトリクス

|カテゴリ|リスク内容|発生確率|影響度|対策|
|---|---|---|---|---|
|**技術**|Arelle依存によるメンテナンスリスク|中|高|lxml直接パース機能を並行実装|
|**技術**|iXBRL仕様変更への追従遅れ|低|中|タクソノミ年次更新時に検証|
|**データ**|拡張タクソノミによる科目名寄せ失敗|高|高|マッピングテーブル＋手動レビュー|
|**データ**|IFRS営業利益の定義不統一|高|高|EBITDA比較を推奨、注記付与|
|**データ**|訂正有報による遡及修正|中|中|parentDocID追跡＋UPSERT|
|**法務**|API利用規約違反（大量アクセス）|低|高|レート制限（1-3秒間隔）遵守|
|**法務**|出典記載漏れ|低|中|自動出典挿入機能|
|**運用**|タクソノミ年次更新への対応遅延|中|高|更新アラート＋検証環境|
|**運用**|名寄せ精度低下（社名変更・合併）|中|中|法人番号クロスリファレンス|
|**運用**|バッチ障害による欠損|中|中|リトライ＋手動補完フロー|

---

## 実装方針と推奨アーキテクチャ

### 技術スタック

- **言語**: Python 3.11+
- **XBRLパーサー**: Arelle（メイン）+ edinet-xbrl（補助）
- **DB**: PostgreSQL 15+（JSONB、パーティショニング活用）
- **ジョブ管理**: Airflow / Prefect
- **可視化**: Metabase / Superset

### 処理フロー概要

```
EDINET API → ZIP展開 → iXBRL解析 → Fact抽出
    ↓
Bronze層（raw JSON/XML保持）
    ↓
Silver層（正規化・名寄せ・マッピング）
    ↓
Gold層（指標計算・マテリアライズドビュー）
    ↓
BIダッシュボード / API提供
```

---

## すぐ着手できるToDo（WBS）

### 第1週：環境構築とPoC

|#|タスク|成果物|所要日数|
|---|---|---|---|
|1-1|APIキー取得・疎通確認|疎通確認スクリプト|0.5日|
|1-2|Arelle環境構築|解析サンプルコード|1日|
|1-3|任意1社の有報取得・解析|Factリスト（CSV）|1日|
|1-4|PostgreSQL Bronze層テーブル作成|DDLスクリプト|0.5日|
|1-5|取得→保存の単発バッチ作成|Python スクリプト|2日|

### 第1ヶ月：基盤構築

|#|タスク|成果物|所要日数|
|---|---|---|---|
|2-1|Silver層スキーマ設計・DDL作成|ER図、DDLスクリプト|3日|
|2-2|タクソノミマスター投入|taxonomy_conceptテーブル|2日|
|2-3|科目マッピングテーブル初版|マッピング定義CSV|3日|
|2-4|日次バッチ（増分取得）実装|Airflow DAG|5日|
|2-5|訂正有報の更新ロジック実装|UPSERT処理|2日|
|2-6|主要100社の過去5年分取得|検証データセット|5日|

### 第3ヶ月：EPM機能・運用化

|#|タスク|成果物|所要日数|
|---|---|---|---|
|3-1|Gold層スキーマ設計・DDL作成|DDL、計算ロジック|5日|
|3-2|EPM指標計算ロジック実装|指標計算モジュール|10日|
|3-3|IFRS/JGAAP調整ロジック実装|正規化処理|5日|
|3-4|マテリアライズドビュー・更新バッチ|リフレッシュDAG|3日|
|3-5|BIダッシュボード構築（Metabase）|比較ダッシュボード|10日|
|3-6|API提供（FastAPI）|REST API|5日|
|3-7|運用ドキュメント整備|運用マニュアル|3日|
|3-8|全上場企業への展開|本番データセット|継続|

---

## 結論

EDINETベースの企業比較基盤は、**API Version 2の安定稼働、3層アーキテクチャによる柔軟性確保、会計基準差異への明示的な対応**が成功の鍵となる。特に、IFRSの営業利益定義問題はEBITDA比較で回避し、拡張タクソノミの揺れは科目マッピングテーブルで吸収する設計が現実的である。本レポートの設計指針とWBSに沿って着手すれば、3ヶ月で主要企業の比較分析基盤を稼働させることが可能である。

# GEMINI
# 金融庁EDINET（有価証券報告書）に基づく次世代データ基盤構築およびEPM指標設計に関する包括的調査報告書

## 1. エグゼクティブサマリー

本報告書は、金融庁が運営する電子開示システム「EDINET」から有価証券報告書（以下、有報）のXBRL/iXBRLデータを自動取得し、解析・正規化を経てリレーショナルデータベース（RDB）へ格納、さらに企業パフォーマンス管理（EPM）の高度な指標（ROIC、CVP分析等）を用いて企業間比較を実現するためのシステム要件、設計指針、および実装戦略を包括的に提示するものである。

企業の財務情報は、投資家の意思決定における最も基礎的な一次情報である。日本国内においては、EDINET APIの公開により機械可読な形式でのデータ取得が可能となったが、その実務的な活用には「ドキュメント中心」のXBRL構造を「データ中心」の分析基盤へ変換するという極めて高い技術的ハードルが存在する。特に、有報におけるタクソノミ（勘定科目体系）の多様性、コンテキスト（文脈）の複雑性、そして会計基準（日本基準、IFRS、米国基準）の混在は、単純なデータスクレイピングでは解決できない課題である。

本調査では、これらの課題に対し、以下の4つのレイヤーからなるソリューションアーキテクチャを提案する。

1. **Ingestion Layer（データ取得層）**: EDINET API v2を用いた堅牢かつ冪等性を担保したデータ収集。
    
2. **Parsing & Normalization Layer（解析・正規化層）**: XBRL処理エンジン（Arelle）を活用した厳密なコンテキスト解析と、会計基準を横断する標準化ロジック。
    
3. **Persistence Layer（データ蓄積層）**: 時系列分析と横断比較に最適化されたRDBスキーマ設計。
    
4. **Analytics Layer（EPM指標層）**: 財務数値と非財務数値（従業員数等）を統合したROICツリー展開、および回帰分析を用いた固定費・変動費分解（CVP）モデルの実装。
    

本報告書は、専門リサーチャーおよびソリューションアーキテクトの視点から、再現可能な技術仕様と実装コードのロジックを含めて記述されており、次世代の財務データ基盤構築におけるブループリントとなることを意図している。

---

## 2. 第1部：EDINET API v2によるデータ取得戦略

データ基盤の信頼性は、最上流であるデータ取得プロセスの堅牢性に依存する。EDINET API v2は強力なツールであるが、その仕様を正確に理解し、APIの制限や特性（Rate Limit、更新頻度、訂正報告書の扱い）を考慮した設計が不可欠である。

### 2.1 API認証とエンドポイント設計

EDINET APIの利用には、金融庁が発行するAPIキーを用いた認証が必要となる。旧バージョンでは認証なしでのアクセスが可能であったが、v2以降はセキュリティ強化のため、リクエストごとにAPIキーをパラメータとして付与することが義務付けられている 。

**システム設計上の要件:**

- **認証管理**: APIキーは環境変数やセキュアなVaultシステムで管理し、ソースコードへのハードコーディングを避ける。
    
- **エンドポイント構成**:
    
    1. **書類一覧API (`/api/v2/documents.json`)**: 指定した日付に提出された書類のメタデータを取得する。
        
    2. **書類取得API (`/api/v2/documents/{docID}`)**: 特定の書類ID（docID）に対応するXBRL/ZIPファイルを取得する 。
        

### 2.2 対象書類の厳密なフィルタリング

本プロジェクトの目的は「有価証券報告書の確定年次データ」の取得であるため、APIから返却される膨大な提出書類の中から、対象となるファイルを正確に抽出するロジックが必要となる。

**フィルタリングロジックの核となるパラメータ:**

APIのレスポンス（JSON形式）に含まれる `results` 配列内の各オブジェクトに対し、以下の条件判定を行う。

1. **書類種別コード (`docTypeCode`)**:
    
    - ターゲットコード: `120`（有価証券報告書）。これが本システムの主対象である。
        
    - 訂正報告書の扱い: コード `130`（訂正有価証券報告書）も取得対象とする必要がある。財務数値が事後的に修正されるケースは稀ではなく、正確なデータ基盤には「最新の正しい値」を保持する責務があるためである。
        
    - 除外コード: `140`（四半期報告書）、`150`（半期報告書）、`160`（臨時報告書）などは、年次確定データではないため除外する 。
        
2. **府令コード (`ordinanceCode`)**:
    
    - 一般事業会社を対象とする場合、`010`（企業内容等の開示に関する内閣府令）を選択する。金融商品取引業者や投資信託などを区別する場合、このコードによるフィルタリングが有効である。
        
3. **提出日時 (`submitDateTime`)**:
    
    - 同一企業から同日に複数のファイルが出ている場合（訂正など）、このタイムスタンプを用いて最新のファイルを特定する。
        

### 2.3 冪等性とスケジューリングの実装

データ取得は一度きりの操作ではなく、継続的なパイプライン処理である。したがって、システムの「冪等性（Idempotency）」—何度実行しても結果が同じであること—が重要となる。

**実装戦略:**

- **取得履歴管理テーブル**: RDB内に `ingestion_log` テーブルを作成し、処理済みの `docID` を記録する。
    
- **スケジューリング**: クーロンジョブ（Cron）やワークフローエンジン（Apache Airflow, Prefect等）を用い、毎日所定の時間（例：開示が集中する17時以降）にAPIをポールする。
    
- **ルックバックウィンドウ**: APIの反映遅延やシステムダウンを考慮し、処理対象期間は「当日」だけでなく「過去7日間」を常にスキャンするロジックを推奨する。これにより、土日祝日の提出分や訂正分の取りこぼしを防ぐことができる。
    

### 2.4 レート制限とエラーハンドリング

EDINET API等の公開APIには、サーバー負荷軽減のためのレート制限（Rate Limit）が存在することが一般的である。API仕様書や実測値に基づき、適切なスロットリング（Throttling）を実装する必要がある。

**エラーハンドリング方針:**

- **429 Too Many Requests**: このステータスコードが返された場合、指数バックオフ（Exponential Backoff）アルゴリズムを用いて待機時間を増やしながらリトライする 。
    
- **404 Not Found**: 書類一覧には存在するが、物理ファイルが削除されている（取り下げられた）場合などに発生する。これはログに警告を出力し、処理をスキップする。
    
- **5xx Server Errors**: 金融庁側のサーバーエラー。一定回数のリトライ後、管理者へアラートを通知する。
    

---

## 3. 第2部：XBRL/iXBRL解析と正規化（The Core Engine）

データ基盤構築における最大の難所は、取得したZIPファイル内のXBRL/iXBRLデータをいかにして意味のある数値情報へ変換するかにある。XBRLは「XML」の一種であるが、その構造は多次元的かつ参照関係が複雑であり、単純なXMLパーサや正規表現での抽出は極めて危険であり、推奨されない。

### 3.1 XBRLの構造的理解とArelleの採用

XBRL（eXtensible Business Reporting Language）は、財務情報を記述するための国際標準言語である。その実体は、「ファクト（事実）」と「コンテキスト（文脈）」の集合体である。

- **Fact（ファクト）**: 数値そのもの（例：1,000,000円）。
    
- **Context（コンテキスト）**: その数値が「いつ」「誰の」「どのような条件の」ものかを定義するメタデータ。
    
- **Concept（コンセプト）**: その数値が「何であるか」（例：売上高）を定義するタグ。
    

これらを正しく解釈するためには、XBRLの仕様（XLink, XPointer, Dimensions）を完全に実装したパーサーが必要である。本プロジェクトでは、世界的に実績のあるオープンソースのXBRLプロセッサ **「Arelle」** の採用を強く推奨する 。ArelleはPythonで実装されており、複雑なリンクベースの解決やインラインXBRLの展開を自動化できる唯一のデファクトスタンダードツールである。

### 3.2 解析エンジンのアーキテクチャ

Arelleを用いた解析エンジンは、以下のステップでデータを抽出する。

**Step 1: インスタンスのロード**

EDINETからダウンロードしたZIPファイルを解凍し、中にある `.xbrl` ファイル（またはiXBRLの場合は `.htm` ファイル）をArelleの `ModelManager` にロードする。

Python

```
# 概念的な実装イメージ [7]
from arelle import Cntlr
ctrl = Cntlr.Cntlr()
model_xbrl = ctrl.modelManager.load("path/to/downloaded/file.xbrl")
```

**Step 2: ファクトのイテレーション**

ロードされた `model_xbrl` オブジェクトには、文書内の全てのファクトが含まれている。`model_xbrl.facts` をループ処理することで、個々のデータポイントにアクセスできる。

**Step 3: コンテキストの解析（ContextRef Decoding）** ここが最もクリティカルな処理である。単に「売上高（NetSales）」というタグを見つけるだけでは不十分である。その売上高が「当期」のものか「前期」のものか、あるいは「連結」か「単体」かを区別しなければならない。これを怠ると、データベースには異なる年度や範囲の数値が混在することになり、分析不能となる 。

#### コンテキスト解析の重要ロジック

XBRLの各ファクトは `contextRef` という属性を持っている。このID（例：`CurrentYear_Consolidated`）自体は文字列に過ぎないため、これに対応する `context` オブジェクトの中身を解析する必要がある。

1. **期間（Period）の判定**:
    
    - **時点（Instant）**: 貸借対照表（BS）項目。`context.isInstantPeriod` がTrueであるか確認する。その日付が、当該有報の決算日（`periodEnd`）と一致するものを「当期末残高」と判定する 。
        
    - **期間（Duration）**: 損益計算書（PL）・キャッシュフロー計算書（CF）項目。`context.isStartEndPeriod` がTrueであるか確認する。開始日と終了日の差分が約365日（1年）であり、かつ終了日が決算日と一致するものを「当期発生額」と判定する。四半期データや累積データを除外するため、期間の長さチェックは必須である 。
        
2. **連結区分（Dimensions）の判定**:
    
    - EDINETのXBRLでは、連結データと単体データが同一ファイルに含まれる場合がある。
        
    - **連結（Consolidated）**: コンテキストのディメンション情報に `ConsolidatedMember`（連結）が含まれている、あるいは明示的に非連結の指定がない主要なコンテキストを探す。
        
    - **単体（Non-Consolidated）**: `SeparateMember`（単体）などのディメンションが付与されている場合がある。
        
    - 本プロジェクトの主目的は「企業比較」であるため、**連結数値**を最優先で取得するロジックとする。連結財務諸表を作成していない企業の場合は、単体数値を採用するフォールバックロジックを実装する。
        
3. **過去データの除外**:
    
    - 有報には比較のために「前期（Prior Year）」の数値も含まれている。これらは、過去に提出された有報の「当期」データと重複するため、基本的には取り込まない、あるいは「前期比較用」として別カラムにフラグ立てして格納する設計とする。データの整合性を保つためには、原則として「その報告書における当期データ」のみを積み上げていく方式（Snapshot方式）がRDB管理上は望ましい。
        

### 3.3 タクソノミの正規化とマッピング

EDINETでは、会計基準（日本基準、IFRS、米国基準）によって使用されるタグ（Concept Name）が異なる。EPMで横断比較を行うためには、これらを統一的な「内部勘定科目コード」にマッピングする必要がある。

#### 主要科目のマッピング定義表

|**分析項目**|**日本基準 (J-GAAP) タグ**|**IFRS タグ (ifrs-full)**|**内部統一ID**|**備考**|
|---|---|---|---|---|
|**売上高**|`jppfs_cor:NetSales`|`ifrs-full:Revenue`|`STD_REV`|IFRSでは「収益」|
|**売上原価**|`jppfs_cor:CostOfSales`|`ifrs-full:CostOfSales`|`STD_COS`||
|**売上総利益**|`jppfs_cor:GrossProfit`|`ifrs-full:GrossProfit`|`STD_GP`|IFRSで開示がない場合は計算で導出|
|**販管費**|`jppfs_cor:SellingGeneralAndAdministrativeExpenses`|_(該当タグなし)_|`STD_SGA`|IFRSでは販管費の一括表示義務がないため、個別の費用項目の合算が必要な場合がある|
|**営業利益**|`jppfs_cor:OperatingIncome`|`ifrs-full:ProfitFromOperations`|`STD_OP`|IFRSの営業利益定義は日本基準と異なる場合があるため注記が必要|
|**当期純利益**|`jppfs_cor:ProfitLossAttributableToOwnersOfParent`|`ifrs-full:ProfitLossAttributableToOwnersOfParent`|`STD_NI`|親会社株主に帰属する当期純利益|
|**流動資産**|`jppfs_cor:CurrentAssets`|`ifrs-full:CurrentAssets`|`STD_CA`||
|**固定資産**|`jppfs_cor:NoncurrentAssets`|`ifrs-full:NoncurrentAssets`|`STD_NCA`||
|**資産合計**|`jppfs_cor:Assets`|`ifrs-full:Assets`|`STD_TA`||
|**有利子負債**|_(計算項目)_: 短期借入金 + 長期借入金 + 社債等|`ifrs-full:Borrowings` 等|`STD_IBD`|複数のタグを合算して算出するロジックが必要|

**実装上の注意点**:

- **IFRSの特異性**: IFRS採用企業では、「営業利益」のタグが存在しない、あるいは日本基準の営業利益と意味合いが異なる（金融収益が含まれる等）ケースがある。EPM指標の設計時には、この差異を吸収するための「調整後営業利益」を算出するロジックを解析層に組み込むことが推奨される 。
    
- **従業員数の取得**: 財務数値とは異なり、従業員数は `jpcrp_cor`（企業情報）名前空間のタグで定義される。
    
    - タグ例: `jpcrp_cor:NumberOfEmployees`（従業員数） 。
        
    - テキストブロック対応: 多くの場合、従業員数は数値タグではなくHTMLのテキストブロック `jpcrp_cor:InformationAboutEmployeesTextBlock` 内に記載されている 。この場合、ArelleでHTMLテキストを抽出し、正規表現（Regex）を用いて「従業員数...(\d+)名」といったパターンマッチングで数値を刈り取る泥臭い処理が必要となる場合がある。
        

---

## 4. 第3部：データモデリングとRDB格納設計（Persistence Layer）

解析されたデータは、分析に耐えうる形式でリレーショナルデータベース（RDB）に格納されなければならない。ここでは、EPM分析のパフォーマンスと柔軟性を両立させるスキーマ設計を提案する。

### 4.1 データベース選定

PostgreSQLの採用を推奨する。

- **理由1**: JSONB型のサポート。XBRLの元のコンテキスト情報や単位情報をJSON形式でそのまま保持しつつ、主要な数値は構造化カラムに入れる「ハイブリッドアプローチ」が可能である 。
    
- **理由2**: 分析クエリへの強さ。ウィンドウ関数やCTE（共通テーブル式）を用いた複雑な財務指標計算（移動平均、前年比計算など）に最適化されている。
    

### 4.2 スキーマ設計（スタースキーマの応用）

データモデルは、中心となる「ファクトテーブル」と、それを説明する「ディメンションテーブル」に分離する正規化を行う。

#### 1. `dim_companies`（企業マスタ）

EDINETコードや証券コード、企業名を管理する。

- `company_id` (PK)
    
- `edinet_code` (Unique): 例: E00012
    
- `sec_code`: 証券コード (例: 72030)
    
- `company_name`: 企業名
    
- `industry_sector`: 業種（EDINETメタデータより取得）
    

#### 2. `dim_submissions`（提出書類マスタ）

どの書類からデータを取得したかを管理し、トレーサビリティを担保する。

- `submission_id` (PK)
    
- `doc_id`: EDINET APIの書類ID
    
- `company_id` (FK)
    
- `submission_date`: 提出日
    
- `fiscal_year_end`: 決算日 (例: 2024-03-31)
    
- `accounting_standard`: 会計基準フラグ ('JG', 'IFRS', 'US')
    

#### 3. `dim_accounts`（勘定科目マスタ）

前述のマッピングロジックで定義した内部統一IDを管理する。

- `account_id` (PK): 例: STD_REV
    
- `account_name_ja`: 表示名（売上高）
    
- `account_type`: タイプ ('Flow', 'Stock') - ROIC計算時の平均残高計算ロジック切り分けに使用。
    

#### 4. `fact_financials`（財務数値ファクトテーブル）

これが最大のテーブルとなる。

- `fact_id` (PK)
    
- `submission_id` (FK)
    
- `account_id` (FK)
    
- `amount`: 数値 (Decimal型, 精度18, スケール2)
    
- `currency`: 通貨 (JPY, USD)
    
- `context_type`: ('Current_Consolidated', 'Current_NonConsolidated')
    
- `original_tag`: 元のXBRLタグ名（デバッグ用）
    

**インデックス戦略**:

`fact_financials` は数億レコード規模になる可能性があるため、以下の複合インデックスが必須である。

- `(account_id, submission_id)`: 特定の勘定科目を時系列で引くため。
    
- `(submission_id)`: 特定の企業の全財務データを引くため。
    

---

## 5. 第4部：EPM機能と財務指標設計（Analytics Layer）

RDBに蓄積された正規化データを用いて、ユーザーの目的である「企業比較」を実現するEPM（Enterprise Performance Management）ロジックを設計する。

### 5.1 ROIC（投下資本利益率）の設計と実装

ROICは企業の「稼ぐ力」を測定する最重要指標である。

$$ROIC = \frac{NOPAT}{Invested Capital}$$

この式を、データベース上の勘定科目を用いて具体的に定義する。

**A. 分子：NOPAT（税引後営業利益）**

- 計算式: `OperatingIncome` × (1 - 実効税率)
    
- 実装上の課題: 実効税率は企業ごとに異なる。簡易的には一律30.6%（法定実効税率）を用いるか、より精緻には `IncomeTaxes` ÷ `IncomeBeforeIncomeTaxes` で実績税率を算出する。異常値（税率がマイナスになる場合など）のハンドリングが必要。
    

**B. 分母：投下資本（Invested Capital）**

- 計算式（資金調達サイド）: `NetAssets`（純資産） + `InterestBearingDebt`（有利子負債）
    
- 計算式（運用サイド）: `WorkingCapital`（運転資本） + `FixedAssets`（固定資産）
    
- **平残（Average Balance）の利用**: BS項目（ストック）は期末時点の値であるが、PL項目（フロー）と比較するため、期首と期末の平均値 `(Begin + End) / 2` を用いるのがEPMの鉄則である。「期首」の値は、当該年度有報の「前期末」データ、あるいは前年度有報の「当期末」データから取得する。
    

**C. ROICツリー展開**

EPMシステムでは、単にROICを表示するだけでなく、それを分解して改善ドライバーを特定する機能が求められる。

- **売上高営業利益率**: `OperatingIncome` / `NetSales`
    
- **投下資本回転率**: `NetSales` / `InvestedCapital`
    
    これにより、「利益率が低いのか、資産効率が悪いのか」を診断可能にする。
    

### 5.2 CVP分析と固定費・変動費の推計ロジック

「企業比較」において、損益分岐点（Break-even Point）の分析は強力なインサイトを提供する。しかし、有報には「固定費」「変動費」という区分は存在しない。したがって、統計的な推計アプローチが必要となる。

**推定手法：勘定科目法 vs 回帰分析法**

1. **勘定科目法（簡易法）**:
    
    - `CostOfSales`（売上原価）を全て「変動費」とみなす。
        
    - `SGA`（販管費）を全て「固定費」とみなす。
        
    - **欠点**: 製造業では売上原価に多額の労務費・減価償却費（固定費）が含まれるため、変動費率が高く算出されすぎ、限界利益率が過小評価される傾向がある。
        
2. 回帰分析法（推奨） :
    
    - 過去3〜5年分の四半期または年次データセットを用いる。
        
    - X軸：売上高 (`NetSales`)
        
    - Y軸：営業総費用 (`CostOfSales` + `SGA`)
        
    - 単回帰分析 $y = ax + b$ を実行する。
        
        - 傾き $a$: 変動費率
            
        - 切片 $b$: 固定費
            
    - **実装**: Pythonの `scikit-learn` または `statsmodels` を用い、企業ごとにバッチ処理で回帰係数を算出し、`analysis_metrics` テーブルに `variable_cost_ratio`, `fixed_cost` として格納する。決定係数 ($R^2$) が低い場合は信頼性が低いため、勘定科目法にフォールバックするロジックを組む。
        

### 5.3 財務指標分析とベンチマーク機能

「企業比較」を実現するためには、絶対額ではなく「比率」や「一人当たり指標」への変換が必須である。

**主要KPI設計:**

1. **労働生産性**: `GrossProfit` / `NumberOfEmployees` （従業員一人当たり付加価値）
    
2. **労働分配率**: `PersonnelExpenses` / `GrossProfit` （人件費の開示がある場合）
    
3. **CCC (Cash Conversion Cycle)**:
    
    - 売上債権回転日数 + 棚卸資産回転日数 - 仕入債務回転日数
        
    - `TradeReceivables` / (`NetSales`/365) +...
        

**ベンチマーク比較の実装:**

- ユーザーが任意の企業群（例：トヨタ、ホンダ、日産）を選択した際、即座にRDBから上記指標を取得し、レーダーチャートや推移グラフを描画する。
    
- **業界平均の算出**: `dim_companies.industry_sector` に基づき、同業他社の中央値（Median）や上位25%点（Top Quartile）を動的に計算し、対象企業の位置付けを可視化する。
    

---

## 6. 第5部：実装ロードマップと再現性（Implementation & Reproducibility）

最後に、このシステムを現実に構築するための技術スタックと手順をまとめる。

### 6.1 技術スタック推奨

- **言語**: Python 3.9+ (型ヒントを活用し、堅牢なコードを書く)
    
- **XBRLライブラリ**: `arelle-release` (PyPI)。公式のArelleは更新頻度が高いため、バージョンを固定（Pinning）して運用する。
    
- **データベース**: PostgreSQL 14+ (AWS RDS or Aurora Serverless推奨)
    
- **コンテナ化**: Docker。Arelleは依存ライブラリが多いため、環境差異をなくすためにコンテナ化が必須。
    
- **オーケストレーション**: Apache Airflow。日次バッチの依存関係管理（ダウンロード→解析→DB格納→EPM計算）に最適。
    

### 6.2 再現性のための注意点

1. **タクソノミキャッシュ**: Arelleは起動時に大量のタクソノミファイルをインターネットからダウンロードしようとする。これがボトルネックやタイムアウトの原因となる。事前に主要なタクソノミ（EDINETタクソノミ、IFRSタクソノミ）をダウンロードし、ローカルキャッシュとしてコンテナにマウントする構成にすることで、処理速度と安定性が飛躍的に向上する 。
    
2. **ユニットテスト**: XBRL解析ロジックは非常に複雑であるため、「特定の有報ファイル（エッジケースを含む）」を入力とし、期待されるJSONが出力されるかを検証するユニットテストを充実させる。特に「訂正報告書」や「IFRS移行初年度」のデータ処理が正しく行われるかのテストが重要である。
    

## 7. 結論

EDINETからの有価証券報告書データの自動取得とEPM基盤の構築は、技術的に高度な挑戦である。しかし、本報告書で詳述した「Arelleによる厳密なコンテキスト解析」、「会計基準を吸収する正規化マッピング」、「RDBによる時系列分析基盤」、「回帰分析を用いたCVPモデル」を組み合わせることで、単なるデータの羅列ではない、経営の意思決定に資するインテリジェンスを生み出すシステムが実現可能である。

このアーキテクチャは、金融機関のアナリスト業務の自動化、事業会社の競合分析、あるいはM&Aにおけるデューデリジェンスの効率化など、広範な応用可能性を秘めている。

---

**参考文献・情報源**

- EDINET API 仕様書およびコード定義
    
- XBRL解析技術（Arelle, Python）
    
- 勘定科目タグおよびタクソノミ定義（J-GAAP, IFRS）
    
- 財務分析・固定費推定手法
    
- データベース・ストレージ技術

# GPT
