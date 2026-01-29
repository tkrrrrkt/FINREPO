# FINREPO テスト実行ガイド

## 📋 目次
1. [クイックスタート](#クイックスタート)
2. [テストスイート詳細](#テストスイート詳細)
3. [実行オプション](#実行オプション)
4. [トラブルシューティング](#トラブルシューティング)
5. [テスト結果の確認](#テスト結果の確認)

---

## クイックスタート

### 最初のセットアップ

```bash
# テスト依存関係をインストール
cd /Users/ktkrr/root/10_dev/FINREPO
pip install -r test/requirements.txt

# ユニットテストを実行（DB不要）
./run_tests.sh unit

# またはリグレッションテストを実行（DB必要）
./run_tests.sh regression
```

### 日常的な実行

```bash
# すべてのテストを実行
./run_tests.sh all

# または単純に
pytest test/ -v
```

---

## テストスイート詳細

### 1️⃣ ユニット正規化テスト (Unit Normalizer)

**ファイル:** `test/unit/test_unit_normalizer.py`  
**テスト数:** 53個  
**実行時間:** < 1秒  
**DB必要:** いいえ

**テスト対象:**
- JPY パススルー（8テスト）
- USD → JPY 変換（10テスト）
- EUR → JPY 変換（8テスト）
- テキスト単位判別（6テスト）
- NULL・空値処理（3テスト）
- 小数精度（5テスト）
- 極端な値（3テスト）
- 一貫性（2テスト）
- DB統合（2テスト）
- 実データ（2テスト）

**実行例:**
```bash
# 全テスト実行
pytest test/unit/test_unit_normalizer.py -v

# 特定テストクラスのみ
pytest test/unit/test_unit_normalizer.py::TestUSDToJPYConversion -v

# 特定テストのみ
pytest test/unit/test_unit_normalizer.py::TestUSDToJPYConversion::test_usd_conversion_rate_145 -v
```

**期待結果:** ✅ 53/53 PASS

---

### 2️⃣ 概念階層テスト (Concept Hierarchy)

**ファイル:** `test/unit/test_concept_hierarchy.py`  
**テスト数:** 29個  
**実行時間:** 2-3秒（XBRL ファイル読み込み）  
**DB必要:** いいえ

**テスト対象:**
- Extractor 初期化（2テスト）
- 階層レベル計算（7テスト）
- Root concept 検出（4テスト）
- 循環参照検出（4テスト）
- エッジケース（8テスト）

**実行例:**
```bash
# 全テスト実行
pytest test/unit/test_concept_hierarchy.py -v

# 階層計算テストのみ
pytest test/unit/test_concept_hierarchy.py::TestHierarchyLevelCalculation -v
```

**期待結果:** ✅ 29/29 PASS

---

### 3️⃣ リグレッションテスト (Regression)

**ファイル:** `test/regression/test_known_facts.py`  
**テスト数:** 27個  
**実行時間:** < 1秒  
**DB必要:** はい（edinet ローカルDB）

**テスト対象:**
- DB接続確認（2テスト）
- S100LUF2 ファクト数（3テスト）
- 単位正規化統計（5テスト）
- 概念階層統計（6テスト）
- 売上認識（3テスト）
- 概念カバレッジ（4テスト）
- データ整合性（4テスト）
- DBインデックス（1テスト）

**実行例:**
```bash
# 全リグレッション実行
pytest test/regression/test_known_facts.py -v

# 特定テストクラス
pytest test/regression/test_known_facts.py::TestUnitNormalizationStatistics -v
```

**期待結果:** ✅ 27/27 PASS

**前提条件:**
```bash
# ローカル DB が起動していること
psql -h localhost -U edinet_user -d edinet
```

---

## 実行オプション

### run_tests.sh を使用した実行

```bash
cd /Users/ktkrr/root/10_dev/FINREPO

# すべてのテスト実行
./run_tests.sh all

# ユニットテストのみ
./run_tests.sh unit

# リグレッションテストのみ
./run_tests.sh regression

# 統合テストのみ
./run_tests.sh integration

# 高速テストのみ（DB不要）
./run_tests.sh quick

# カバレッジレポート生成
./run_tests.sh coverage

# ヘルプ表示
./run_tests.sh help
```

### pytest を直接使用

```bash
# すべてのテスト実行（詳細出力）
pytest test/ -v

# テスト数の少ない実行（簡潔）
pytest test/ -q

# エラー時のトレースバック表示
pytest test/ -v --tb=short    # 短い形式
pytest test/ -v --tb=long     # 長い形式

# 特定のテストパターンのみ実行
pytest test/ -k "USD"        # "USD" を含むテスト
pytest test/ -k "not slow"   # "slow" でないテスト

# テストの情報表示
pytest test/ --collect-only  # テスト一覧表示
pytest test/ -v --tb=no      # テスト結果のみ（トレース非表示）

# カバレッジレポート
pytest test/ --cov=src --cov-report=html
# 結果は htmlcov/index.html に生成
```

---

## トラブルシューティング

### Q1: `pytest: command not found`

**原因:** pytest がインストールされていない

**解決方法:**
```bash
pip install -r test/requirements.txt
```

---

### Q2: リグレッションテスト失敗: `OperationalError: could not connect to server`

**原因:** ローカル PostgreSQL が起動していない

**解決方法:**
```bash
# PostgreSQL 起動状態の確認
psql -h localhost -U edinet_user -d edinet -c "SELECT 1"

# 起動していなければ Docker で起動
docker-compose up -d postgres
# または
brew services start postgresql
```

---

### Q3: `ModuleNotFoundError: No module named 'lib.unit_normalizer'`

**原因:** sys.path に src/ が設定されていない

**解決方法:**
```bash
# FINREPO ディレクトリで実行
cd /Users/ktkrr/root/10_dev/FINREPO
pytest test/
```

---

### Q4: 概念階層テストが遅い

**原因:** XBRL ファイル読み込みのため時間がかかります（正常動作）

**期待時間:** 2-3秒

**無視する方法:**
```bash
# XBRL テストをスキップ
pytest test/unit/test_concept_hierarchy.py -m "not xbrl"
```

---

### Q5: ファイアウォール/プロキシエラー

**メッセージ:** `ConnectionError: ('Connection aborted.', ...)`

**解決方法:**
```bash
# ローカルテストのみ実行（DB テスト除外）
./run_tests.sh quick
```

---

## テスト結果の確認

### コンソール出力の見方

```
test/unit/test_unit_normalizer.py::TestJPYNormalization::test_jpy_value_unchanged PASSED [ 18%]
       ^                               ^                   ^                              ^      ^
       テストファイル                   クラス              メソッド                      結果    進捗
```

### テスト結果サマリー

```
============================== 53 passed in 0.04s ==============================
                                ^                  ^
                              テスト数              実行時間
```

### 失敗時のサマリー

```
FAILED test/regression/test_known_facts.py::TestUnitNormalizationStatistics::test_unit_normalization_jpy_807
  AssertionError: S100LUF2 should have 1125 JPY facts, got 1125
  
=== short test summary info ===
FAILED test/regression/test_known_facts.py::... - AssertionError: ...

========================= 5 failed, 22 passed in 0.25s =========================
                           ^              ^
                       失敗テスト       成功テスト
```

---

## カバレッジレポート

カバレッジレポートを生成する方法：

```bash
# HTML レポート生成
./run_tests.sh coverage

# または直接実行
pytest test/ --cov=src --cov-report=html --cov-report=term

# レポートを開く
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

**期待カバレッジ:** 80%以上

---

## ベストプラクティス

### 1. 開発中の実行
```bash
# 高速フィードバックループのため、変更中のテストのみ実行
pytest test/unit/test_unit_normalizer.py -v -x

# -x: 最初の失敗で停止
# -v: 詳細出力
```

### 2. コミット前の実行
```bash
# 全テスト実行
./run_tests.sh all

# または
pytest test/ -v
```

### 3. CI/CD 環境での実行
```bash
# 本番環境
pytest test/ -q --tb=short

# -q: 簡潔出力
# --tb=short: エラー情報のみ表示
```

### 4. デバッグ時の実行
```bash
# テスト実行を止めて pdb でデバッグ
pytest test/unit/test_unit_normalizer.py -v --pdb

# 詳細なログ出力
pytest test/unit/test_unit_normalizer.py -v --log-cli-level=DEBUG
```

---

## テスト追加時の手順

新しい機能を追加するときのテスト追加流れ：

### Step 1: テストファイルに新しいテストを追加

```python
def test_new_feature(self):
    """新機能の説明"""
    normalizer = UnitNormalizer()
    unit, value = normalizer.normalize("USD", Decimal("100"))
    assert unit == "JPY"
    assert value == Decimal("14500")
```

### Step 2: テストを実行して失敗を確認

```bash
pytest test/unit/test_unit_normalizer.py::TestNewFeature::test_new_feature -v
# Expected: FAILED
```

### Step 3: 実装コードを追加

`src/lib/unit_normalizer.py` に機能を追加

### Step 4: テストが成功することを確認

```bash
pytest test/unit/test_unit_normalizer.py::TestNewFeature::test_new_feature -v
# Expected: PASSED
```

### Step 5: 全テストが成功することを確認

```bash
./run_tests.sh all
# Expected: すべて PASS
```

---

## 参考資料

### テストファイル場所
- **ユニットテスト:** `test/unit/`
- **リグレッションテスト:** `test/regression/`
- **統合テスト:** `test/integration/` (今後)

### テスト設定
- **pytest 設定:** `pytest.ini`
- **テスト要件:** `test/requirements.txt`
- **テストスクリプト:** `run_tests.sh`

### ドキュメント
- **テスト実装詳細:** `TEST_IMPLEMENTATION_SUMMARY.md`
- **テスト完了報告:** `TEST_COMPLETION_REPORT.md`
- **このガイド:** `TEST_EXECUTION_GUIDE.md`

---

## よくある質問 (FAQ)

**Q: テスト実行に何分かかりますか？**  
A: 約2-3分（うち2分は概念階層テスト）

**Q: 毎回すべてのテストを実行する必要がありますか？**  
A: 開発中は `./run_tests.sh quick` で十分。コミット前に `./run_tests.sh all` を実行

**Q: テストが失敗したら何をすればいいですか？**  
A: [トラブルシューティング](#トラブルシューティング) を参照

**Q: テストを追加する場合、どこに追加しますか？**  
A: [テスト追加時の手順](#テスト追加時の手順) を参照

---

**最終更新:** 2026-01-29  
**テストスイート状態:** ✅ 全79テスト PASS
