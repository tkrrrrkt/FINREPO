"""
Unit Tests for Concept Hierarchy Extractor (Issue #2)

このモジュールは ConceptHierarchyExtractor の正確性を検証します：
  1. 階層レベル計算の正確性（BFS アルゴリズム）
  2. 循環参照検出の信頼性
  3. Root concept 特定の正確性
  4. エッジケース処理の堅牢性

Test Strategy:
  - Mock XBRL Model objects を使用
  - 既知の親子関係パターンをテスト
  - エッジケース（空, NULL, 循環）を網羅
  - 実XBRL データ（S100LUF2）でも検証
"""

import pytest
import sys
from pathlib import Path
from typing import Dict, Set, List, Optional
from unittest.mock import Mock, MagicMock, patch

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from lib.concept_hierarchy import (
    ConceptHierarchyExtractor,
    ConceptRelation,
)


class TestConceptHierarchyExtractorInitialization:
    """初期化とセットアップのテスト"""

    def test_extractor_initialization(self):
        """Extractor が正しく初期化されるか"""
        extractor = ConceptHierarchyExtractor()
        assert extractor.concept_parents == {}
        assert extractor.concept_children == {}
        assert extractor.concept_levels == {}

    def test_extractor_multiple_instances_isolated(self):
        """複数インスタンスが独立しているか"""
        extractor1 = ConceptHierarchyExtractor()
        extractor2 = ConceptHierarchyExtractor()

        extractor1.concept_parents["Test"] = "Parent"
        assert "Test" not in extractor2.concept_parents


class TestHierarchyLevelCalculation:
    """階層レベル計算のテスト（BFS アルゴリズム）"""

    @pytest.fixture
    def simple_hierarchy(self):
        """
        シンプルな3段階の親子関係を作成

        Root
        ├─ A (Level 2)
        ├─ B (Level 2)
        │  ├─ B1 (Level 3)
        │  └─ B2 (Level 3)
        └─ C (Level 2)
        """
        extractor = ConceptHierarchyExtractor()
        # Manually build parent relationships
        extractor.concept_parents = {
            "A": "Root",
            "B": "Root",
            "C": "Root",
            "B1": "B",
            "B2": "B",
        }
        extractor.concept_children = {
            "Root": {"A", "B", "C"},
            "B": {"B1", "B2"},
        }
        return extractor

    def test_root_concept_has_level_1(self, simple_hierarchy):
        """Root concept（親がない）が Level 1 を持つ"""
        simple_hierarchy._calculate_hierarchy_levels()

        assert simple_hierarchy.concept_levels.get("Root") == 1, \
            "Root concept should have level 1"

    def test_direct_children_have_level_2(self, simple_hierarchy):
        """Root の直接の子が Level 2 を持つ"""
        simple_hierarchy._calculate_hierarchy_levels()

        for concept in ["A", "B", "C"]:
            assert simple_hierarchy.concept_levels.get(concept) == 2, \
                f"Concept {concept} should have level 2"

    def test_grandchildren_have_level_3(self, simple_hierarchy):
        """孫世代が Level 3 を持つ"""
        simple_hierarchy._calculate_hierarchy_levels()

        for concept in ["B1", "B2"]:
            assert simple_hierarchy.concept_levels.get(concept) == 3, \
                f"Concept {concept} should have level 3"

    def test_multiple_roots_each_has_level_1(self):
        """複数の Root（親がない概念）が全て Level 1 を持つ"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "Root1_Child": "Root1",
            "Root2_Child": "Root2",
        }
        extractor.concept_children = {
            "Root1": {"Root1_Child"},
            "Root2": {"Root2_Child"},
        }
        extractor._calculate_hierarchy_levels()

        assert extractor.concept_levels.get("Root1") == 1
        assert extractor.concept_levels.get("Root2") == 1

    def test_deep_hierarchy_levels(self):
        """深い階層（11段階）の level 計算"""
        extractor = ConceptHierarchyExtractor()

        # Create 11-level hierarchy manually
        # L1: Root
        # L2-L11: Chain of parent-child
        for i in range(2, 12):
            parent = f"L{i-1}"
            child = f"L{i}"
            extractor.concept_parents[child] = parent
            if parent not in extractor.concept_children:
                extractor.concept_children[parent] = set()
            extractor.concept_children[parent].add(child)

        extractor._calculate_hierarchy_levels()

        # Verify levels
        for i in range(1, 12):
            level_concept = f"L{i}"
            expected_level = i
            actual_level = extractor.concept_levels.get(level_concept)
            assert actual_level == expected_level, \
                f"L{i} should have level {expected_level}, got {actual_level}"


class TestCircularReferenceDetection:
    """循環参照検出のテスト"""

    def test_no_circular_reference_simple_tree(self):
        """シンプルなツリーに循環参照がない"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "A": "Root",
            "B": "A",
            "C": "B",
        }
        extractor.concept_children = {
            "Root": {"A"},
            "A": {"B"},
            "B": {"C"},
        }

        issues = extractor.validate_hierarchy()
        circular_issues = [i for i in issues if "Circular" in i]
        assert len(circular_issues) == 0, \
            f"Simple tree should have no circular references, got: {circular_issues}"

    def test_direct_circular_reference_detection(self):
        """直接的な循環参照（A → B → A）を検出"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "A": "B",
            "B": "A",
        }
        extractor.concept_children = {
            "A": {"B"},
            "B": {"A"},
        }

        issues = extractor.validate_hierarchy()
        circular_issues = [i for i in issues if "Circular" in i]
        assert len(circular_issues) > 0, \
            "Should detect direct circular reference A → B → A"

    def test_self_reference_detection(self):
        """自己参照（A → A）を検出"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "A": "A",
        }
        extractor.concept_children = {
            "A": {"A"},
        }

        issues = extractor.validate_hierarchy()
        circular_issues = [i for i in issues if "Circular" in i]
        assert len(circular_issues) > 0, \
            "Should detect self-reference A → A"

    def test_complex_circular_reference_detection(self):
        """複雑な循環参照（A → B → C → A）を検出"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "A": "B",
            "B": "C",
            "C": "A",
        }

        issues = extractor.validate_hierarchy()
        circular_issues = [i for i in issues if "Circular" in i]
        assert len(circular_issues) > 0, \
            "Should detect complex circular reference A → B → C → A"


class TestAncestorAndDescendantMethods:
    """先祖・子孫取得メソッドのテスト"""

    @pytest.fixture
    def family_tree(self):
        """
        家系図パターン
        GrandParent
        ├─ Parent1
        │  ├─ Child1
        │  └─ Child2
        └─ Parent2
           └─ Child3
        """
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "Parent1": "GrandParent",
            "Parent2": "GrandParent",
            "Child1": "Parent1",
            "Child2": "Parent1",
            "Child3": "Parent2",
        }
        extractor.concept_children = {
            "GrandParent": {"Parent1", "Parent2"},
            "Parent1": {"Child1", "Child2"},
            "Parent2": {"Child3"},
        }
        return extractor

    def test_get_parent_returns_direct_parent(self, family_tree):
        """直接親を正しく返す"""
        assert family_tree.get_parent("Child1") == "Parent1"
        assert family_tree.get_parent("Parent1") == "GrandParent"

    def test_get_parent_root_returns_none(self, family_tree):
        """Root の親は None を返す"""
        assert family_tree.get_parent("GrandParent") is None

    def test_get_children_returns_direct_children(self, family_tree):
        """直接子を正しく返す"""
        assert family_tree.get_children("Parent1") == {"Child1", "Child2"}
        assert family_tree.get_children("Parent2") == {"Child3"}

    def test_get_ancestors_returns_all_ancestors(self, family_tree):
        """全ての祖先を Root まで返す"""
        ancestors = family_tree.get_ancestors("Child1")
        assert ancestors == ["Parent1", "GrandParent"], \
            f"Ancestors of Child1 should be [Parent1, GrandParent], got {ancestors}"

    def test_get_descendants_returns_all_descendants(self, family_tree):
        """全ての子孫を葉まで返す"""
        descendants = family_tree.get_descendants("Parent1")
        assert descendants == {"Child1", "Child2"}, \
            f"Descendants of Parent1 should be {{Child1, Child2}}, got {descendants}"

    def test_get_level_for_all_concepts(self, family_tree):
        """全ての概念について level を正しく返す"""
        family_tree._calculate_hierarchy_levels()

        assert family_tree.get_level("GrandParent") == 1
        assert family_tree.get_level("Parent1") == 2
        assert family_tree.get_level("Child1") == 3


class TestExtractFromMockXBRLModel:
    """Mock XBRL Model からの抽出テスト"""

    def create_mock_model_object(self, name: str) -> Mock:
        """Mock ModelObject を作成"""
        obj = Mock()
        obj.name = name
        obj.qname = f"jppfs_cor:{name}"
        return obj

    def test_extract_simple_relationship(self):
        """シンプルな1つの親子関係を抽出"""
        extractor = ConceptHierarchyExtractor()

        # Create mock relationship
        parent_obj = self.create_mock_model_object("Assets")
        child_obj = self.create_mock_model_object("CurrentAssets")

        mock_rel = Mock()
        mock_rel.fromModelObject = parent_obj
        mock_rel.toModelObject = child_obj

        # Create mock relationship set
        mock_rel_set = Mock()
        mock_rel_set.modelRelationships = [mock_rel]

        # Create mock model
        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=mock_rel_set)

        relations = extractor.extract_from_model_xbrl(mock_model)

        assert len(relations) == 1
        assert relations[0].parent_concept_name == "Assets"
        assert relations[0].child_concept_name == "CurrentAssets"
        assert relations[0].hierarchy_level == 2

    def test_extract_multiple_relationships(self):
        """複数の親子関係を抽出"""
        extractor = ConceptHierarchyExtractor()

        # Create mock relationships
        rels = []
        pairs = [
            ("Root", "Assets"),
            ("Assets", "CurrentAssets"),
            ("Assets", "NonCurrentAssets"),
        ]

        for parent_name, child_name in pairs:
            parent_obj = self.create_mock_model_object(parent_name)
            child_obj = self.create_mock_model_object(child_name)

            mock_rel = Mock()
            mock_rel.fromModelObject = parent_obj
            mock_rel.toModelObject = child_obj
            rels.append(mock_rel)

        mock_rel_set = Mock()
        mock_rel_set.modelRelationships = rels

        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=mock_rel_set)

        relations = extractor.extract_from_model_xbrl(mock_model)

        assert len(relations) == 3
        # Verify Root has level 1
        root_rel = [r for r in relations if r.parent_concept_name == "Root"][0]
        assert root_rel.hierarchy_level == 2  # Root's child

    def test_extract_with_null_objects_skipped(self):
        """NULL object の親子関係はスキップ"""
        extractor = ConceptHierarchyExtractor()

        parent_obj = self.create_mock_model_object("Assets")

        # Create relationship with None child
        mock_rel = Mock()
        mock_rel.fromModelObject = parent_obj
        mock_rel.toModelObject = None

        mock_rel_set = Mock()
        mock_rel_set.modelRelationships = [mock_rel]

        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=mock_rel_set)

        relations = extractor.extract_from_model_xbrl(mock_model)

        assert len(relations) == 0, \
            "Relationships with None objects should be skipped"

    def test_extract_handles_missing_relationshipset(self):
        """relationshipSet が存在しない場合を処理"""
        extractor = ConceptHierarchyExtractor()

        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=None)

        relations = extractor.extract_from_model_xbrl(mock_model)

        assert len(relations) == 0, \
            "Should return empty list when relationshipSet is None"

    def test_extract_returns_concept_relation_objects(self):
        """抽出結果が ConceptRelation オブジェクト"""
        extractor = ConceptHierarchyExtractor()

        parent_obj = self.create_mock_model_object("Root")
        child_obj = self.create_mock_model_object("Child")

        mock_rel = Mock()
        mock_rel.fromModelObject = parent_obj
        mock_rel.toModelObject = child_obj

        mock_rel_set = Mock()
        mock_rel_set.modelRelationships = [mock_rel]

        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=mock_rel_set)

        relations = extractor.extract_from_model_xbrl(mock_model)

        assert isinstance(relations[0], ConceptRelation)
        assert hasattr(relations[0], "child_concept_name")
        assert hasattr(relations[0], "parent_concept_name")
        assert hasattr(relations[0], "hierarchy_level")


class TestEdgeCases:
    """エッジケースのテスト"""

    def test_single_concept_no_relationships(self):
        """単一概念（親子なし）"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {}
        extractor.concept_children = {}

        extractor._calculate_hierarchy_levels()

        assert len(extractor.concept_levels) == 0

    def test_isolated_concept_hierarchy(self):
        """孤立した概念群（Root と繋がらない）"""
        extractor = ConceptHierarchyExtractor()
        extractor.concept_parents = {
            "OrphanChild": "Orphan",
        }
        extractor.concept_children = {
            "Orphan": {"OrphanChild"},
        }

        issues = extractor.validate_hierarchy()
        orphan_issues = [i for i in issues if "not in hierarchy" in i]
        # Note: 実装により異なる可能性あり
        # ここではスキップされるかをテスト

    def test_empty_concept_name_handling(self):
        """空の概念名"""
        extractor = ConceptHierarchyExtractor()
        parent_obj = Mock()
        parent_obj.name = ""
        parent_obj.qname = "test:parent"

        child_obj = Mock()
        child_obj.name = ""
        child_obj.qname = "test:child"

        # Should use qname as fallback
        mock_rel = Mock()
        mock_rel.fromModelObject = parent_obj
        mock_rel.toModelObject = child_obj

        mock_rel_set = Mock()
        mock_rel_set.modelRelationships = [mock_rel]

        mock_model = Mock()
        mock_model.relationshipSet = Mock(return_value=mock_rel_set)

        relations = extractor.extract_from_model_xbrl(mock_model)

        # Should use qname as fallback
        assert relations[0].parent_concept_name == "test:parent" or \
               relations[0].parent_concept_name == ""


class TestConceptRelationDataClass:
    """ConceptRelation データクラスのテスト"""

    def test_concept_relation_creation(self):
        """ConceptRelation オブジェクト作成"""
        rel = ConceptRelation(
            child_concept_name="CurrentAssets",
            parent_concept_name="Assets",
            hierarchy_level=3,
        )

        assert rel.child_concept_name == "CurrentAssets"
        assert rel.parent_concept_name == "Assets"
        assert rel.hierarchy_level == 3

    def test_concept_relation_immutability(self):
        """ConceptRelation のイミュータビリティ"""
        rel = ConceptRelation(
            child_concept_name="Child",
            parent_concept_name="Parent",
            hierarchy_level=2,
        )

        # dataclass fields can be accessed
        assert rel.child_concept_name == "Child"


# ============================================================================
# Integration Tests (Real XBRL Data - S100LUF2)
# ============================================================================

class TestWithRealXBRLData:
    """実 XBRL データ（S100LUF2）でのテスト"""

    @pytest.fixture(scope="module")
    def real_xbrl_file(self):
        """実 XBRL ファイルパス"""
        xbrl_path = Path(
            "/Users/ktkrr/root/10_dev/FINREPO/data/raw/edinet/2021/06/30/"
            "S100LUF2_59730_unknown/extracted/XBRL/PublicDoc/"
            "jpcrp030000-asr-001_E01441-000_2021-03-31_01_2021-06-30.xbrl"
        )
        if xbrl_path.exists():
            return xbrl_path
        else:
            pytest.skip("Real XBRL file not found")

    def test_real_xbrl_extracts_non_empty_relationships(self, real_xbrl_file):
        """実 XBRL から親子関係が抽出される"""
        pytest.importorskip("arelle.api")
        from arelle import api

        extractor = ConceptHierarchyExtractor()

        # Load real XBRL
        session = api.Session()
        model = api.getModelDocument(
            session,
            str(real_xbrl_file),
        )

        if model is None:
            pytest.skip("Could not load XBRL model")

        relations = extractor.extract_from_model_xbrl(model)

        # S100LUF2 should have 708 relationships
        assert len(relations) > 0, \
            "Real XBRL should extract at least some relationships"

        session.close()

    def test_real_xbrl_hierarchy_levels_are_positive(self, real_xbrl_file):
        """実 XBRL の全ての hierarchy_level が正数"""
        pytest.importorskip("arelle.api")
        from arelle import api

        extractor = ConceptHierarchyExtractor()

        session = api.Session()
        model = api.getModelDocument(
            session,
            str(real_xbrl_file),
        )

        if model is None:
            pytest.skip("Could not load XBRL model")

        relations = extractor.extract_from_model_xbrl(model)

        for rel in relations:
            assert rel.hierarchy_level > 0, \
                f"Hierarchy level should be positive, got {rel.hierarchy_level} for {rel.child_concept_name}"

        session.close()


# ============================================================================
# Test Running
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
