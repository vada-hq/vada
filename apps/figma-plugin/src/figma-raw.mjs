import { figmaAssetFileName } from "../../../packages/contracts/src/figma-design.mjs";

const VECTOR_ASSET_NODE_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION"]);

export const REFERENCE_PNG_SCALE = 2;

export async function exportFigmaRaw(screenNode) {
  if (!screenNode || typeof screenNode.exportAsync !== "function") {
    throw new Error("Figma 원본을 추출할 작업 화면이 필요합니다.");
  }

  const raw = await screenNode.exportAsync({ format: "JSON_REST_V1" });

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Figma 원본 응답은 JSON 객체여야 합니다.");
  }

  if (
    !raw.document ||
    typeof raw.document !== "object" ||
    Array.isArray(raw.document)
  ) {
    throw new Error("Figma 원본 응답에 document 객체가 없습니다.");
  }

  return raw;
}

export async function exportFigmaScreenAssets(screenNode) {
  if (
    !screenNode ||
    typeof screenNode.exportAsync !== "function" ||
    typeof screenNode.findAll !== "function"
  ) {
    throw new Error("Figma 자산을 추출할 작업 화면이 필요합니다.");
  }

  const vectorNodes = screenNode.findAll((node) =>
    VECTOR_ASSET_NODE_TYPES.has(node.type)
  );
  const assets = [];

  for (const node of vectorNodes) {
    const svg = await node.exportAsync({ format: "SVG_STRING" });

    if (typeof svg !== "string" || !svg.includes("<svg")) {
      throw new Error(`벡터 노드 ${node.id}의 SVG를 추출하지 못했습니다.`);
    }

    assets.push({
      nodeId: node.id,
      fileName: figmaAssetFileName(node.id),
      svg
    });
  }

  const referencePng = await screenNode.exportAsync({
    format: "PNG",
    constraint: { type: "SCALE", value: REFERENCE_PNG_SCALE }
  });

  if (!(referencePng instanceof Uint8Array) || referencePng.length === 0) {
    throw new Error("화면 참조 PNG를 추출하지 못했습니다.");
  }

  return { assets, referencePng };
}
