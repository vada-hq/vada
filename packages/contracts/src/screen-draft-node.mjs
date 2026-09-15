// 초안 생성기가 쓰는 Figma 노드 순회와 텍스트 추출 기본 연산.

export function children(node) {
  return Array.isArray(node?.children) ? node.children : [];
}

export function directChildNamed(node, name) {
  return children(node).find((child) => child.name === name) ?? null;
}

export function collectText(node, parts = []) {
  if (typeof node?.text?.content === "string") {
    parts.push(node.text.content);
  }
  for (const child of children(node)) {
    collectText(child, parts);
  }
  return parts;
}

export function textOf(node) {
  return collectText(node).join("").trim();
}

export function findDescendant(node, predicate) {
  for (const child of children(node)) {
    if (predicate(child)) {
      return child;
    }
    const found = findDescendant(child, predicate);
    if (found) {
      return found;
    }
  }
  return null;
}

export function toSource(node) {
  return { nodeId: node.id, name: node.name, figmaType: "FRAME" };
}
