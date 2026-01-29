"""
Concept Hierarchy Extractor: XBRL Taxonomy から Concept 親子関係を抽出

このモジュールは、Arelle の XBRL モデルから Concept の親子関係（階層）を
抽出して、DB に保存するための構造に変換します。

Issue #2 対応。
"""

from typing import Dict, Set, List, Optional, Any
from dataclasses import dataclass


@dataclass
class ConceptRelation:
    """Concept の親子関係"""
    child_concept_name: str
    parent_concept_name: str
    hierarchy_level: int


class ConceptHierarchyExtractor:
    """XBRL Taxonomy から Concept 階層を抽出"""

    def __init__(self):
        """初期化"""
        self.concept_parents: Dict[str, str] = {}
        self.concept_children: Dict[str, Set[str]] = {}
        self.concept_levels: Dict[str, int] = {}

    def extract_from_model_xbrl(self, model_xbrl: Any) -> List[ConceptRelation]:
        """
        Arelle の ModelXBRL から Concept 親子関係を抽出

        Args:
            model_xbrl: Arelle の ModelXBRL オブジェクト

        Returns:
            ConceptRelation のリスト
        """
        self.concept_parents = {}
        self.concept_children = {}
        self.concept_levels = {}

        # Relationship Set から親子関係を抽出
        try:
            # XBRL parent-child arc role
            parent_child_arcrole = "http://www.xbrl.org/2003/arcrole/parent-child"

            # relationshipSet に arcrole を指定して取得
            rel_set = model_xbrl.relationshipSet(parent_child_arcrole)

            if rel_set and hasattr(rel_set, 'modelRelationships'):
                for rel in rel_set.modelRelationships:
                    parent = rel.fromModelObject
                    child = rel.toModelObject

                    if parent is None or child is None:
                        continue

                    parent_name = parent.name if parent.name else str(parent.qname)
                    child_name = child.name if child.name else str(child.qname)

                    # 親子関係を記録
                    if child_name not in self.concept_parents:
                        self.concept_parents[child_name] = parent_name

                    # 逆関係も記録（子から親へのマッピング）
                    if parent_name not in self.concept_children:
                        self.concept_children[parent_name] = set()
                    self.concept_children[parent_name].add(child_name)

        except Exception as e:
            print(f"Warning: Failed to extract concept relationships: {e}")
            return []

        # 階層レベルを計算
        self._calculate_hierarchy_levels()

        # ConceptRelation リストに変換
        relations = []
        for child, parent in self.concept_parents.items():
            level = self.concept_levels.get(child, 1)
            relations.append(
                ConceptRelation(
                    child_concept_name=child,
                    parent_concept_name=parent,
                    hierarchy_level=level
                )
            )

        return relations

    def _calculate_hierarchy_levels(self) -> None:
        """
        各 Concept の階層レベルを計算

        レベル 1: Root concept (親がない)
        レベル 2: Root の直下
        レベル 3: レベル 2 の子
        ...
        """
        # Root concepts を特定（親がない）
        all_concepts = set(self.concept_parents.keys()) | set(self.concept_parents.values())
        root_concepts = {c for c in all_concepts if c not in self.concept_parents}

        # Root から BFS で階層レベルを計算
        queue = [(c, 1) for c in root_concepts]
        visited = set()

        while queue:
            concept, level = queue.pop(0)

            if concept in visited:
                continue

            visited.add(concept)
            self.concept_levels[concept] = level

            # 子 Concept を追加
            if concept in self.concept_children:
                for child in self.concept_children[concept]:
                    if child not in visited:
                        queue.append((child, level + 1))

    def get_parent(self, concept_name: str) -> Optional[str]:
        """
        Concept の親を取得

        Args:
            concept_name: Concept 名

        Returns:
            親 Concept 名、またはなければ None
        """
        return self.concept_parents.get(concept_name)

    def get_children(self, concept_name: str) -> Set[str]:
        """
        Concept の子を取得

        Args:
            concept_name: Concept 名

        Returns:
            子 Concept の集合
        """
        return self.concept_children.get(concept_name, set())

    def get_level(self, concept_name: str) -> int:
        """
        Concept の階層レベルを取得

        Args:
            concept_name: Concept 名

        Returns:
            階層レベル（1 = Root）
        """
        return self.concept_levels.get(concept_name, 1)

    def get_ancestors(self, concept_name: str) -> List[str]:
        """
        Concept の全祖先を取得（Root まで遡る）

        Args:
            concept_name: Concept 名

        Returns:
            祖先 Concept のリスト（近い順）
        """
        ancestors = []
        current = concept_name

        while current in self.concept_parents:
            parent = self.concept_parents[current]
            ancestors.append(parent)
            current = parent

        return ancestors

    def get_descendants(self, concept_name: str) -> Set[str]:
        """
        Concept の全子孫を取得（葉まで下る）

        Args:
            concept_name: Concept 名

        Returns:
            子孫 Concept の集合
        """
        descendants = set()
        stack = [concept_name]

        while stack:
            current = stack.pop()
            children = self.get_children(current)

            for child in children:
                if child not in descendants:
                    descendants.add(child)
                    stack.append(child)

        return descendants

    def validate_hierarchy(self) -> List[str]:
        """
        階層の妥当性を検証

        Returns:
            見つかった問題のリスト（問題がなければ空）
        """
        issues = []

        # 循環参照をチェック
        for concept in self.concept_parents:
            ancestors = self.get_ancestors(concept)
            if concept in ancestors:
                issues.append(f"Circular reference detected: {concept}")

        # 孤立した Concept をチェック
        all_concepts = set(self.concept_parents.keys()) | set(self.concept_parents.values())
        for concept in all_concepts:
            if concept not in self.concept_levels:
                issues.append(f"Concept not in hierarchy: {concept}")

        return issues


# グローバルインスタンス
extractor = ConceptHierarchyExtractor()


# 使用例：
# from src.lib.concept_hierarchy import extractor
#
# # Arelle の ModelXBRL から抽出
# relations = extractor.extract_from_model_xbrl(model_xbrl)
#
# # 結果を確認
# for rel in relations:
#     print(f"{rel.child_concept_name} -> {rel.parent_concept_name} (level {rel.hierarchy_level})")
#
# # Concept の情報を取得
# parent = extractor.get_parent("jppfs_cor:Cash")
# children = extractor.get_children("jppfs_cor:CurrentAssets")
# ancestors = extractor.get_ancestors("jppfs_cor:Cash")
# level = extractor.get_level("jppfs_cor:Cash")
