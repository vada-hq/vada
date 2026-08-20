import {
  figmaAssetFileName,
  isVectorAssetNode
} from "../../../packages/contracts/src/figma-design.mjs";

export const REFERENCE_PNG_SCALE = 2;

// Figma 샌드박스가 던지는 값은 Error 인스턴스가 아닐 수 있다(렐름이 다르다).
// `error instanceof Error ? error.message : "..."`로 거르면 진짜 원인이 사라지고
// 쓸모없는 fallback 문구만 남는다 — HOME-01K에서 실제로 그랬고, 무엇이
// 실패했는지 알 수 없어 진단이 한 번 왕복했다.
export function toErrorMessage(error) {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  const message = error?.message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }
  const text = error === undefined || error === null ? "" : String(error);
  return text.length > 0 && text !== "[object Object]"
    ? text
    : "알 수 없는 오류입니다.";
}

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

  const vectorNodes = screenNode.findAll((node) => isVectorAssetNode(node));
  const assets = [];
  const failures = [];

  // 하나가 실패해도 나머지를 버리지 않는다. 화면이 커질수록(HOME-01K는 벡터
  // 64개) 전부 아니면 전무는 진단도 복구도 불가능하게 만든다.
  for (const node of vectorNodes) {
    try {
      const svg = await node.exportAsync({ format: "SVG_STRING" });

      if (typeof svg !== "string" || !svg.includes("<svg")) {
        throw new Error("SVG 형식이 아닙니다.");
      }

      assets.push({
        nodeId: node.id,
        fileName: figmaAssetFileName(node.id),
        svg
      });
    } catch (error) {
      failures.push(
        `벡터 ${node.id}의 SVG 추출 실패: ${toErrorMessage(error)}`
      );
    }
  }

  let referencePng = null;
  try {
    const png = await screenNode.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: REFERENCE_PNG_SCALE }
    });

    if (!(png instanceof Uint8Array) || png.length === 0) {
      throw new Error("PNG 바이트가 비어 있습니다.");
    }
    referencePng = png;
  } catch (error) {
    failures.push(`화면 참조 PNG 추출 실패: ${toErrorMessage(error)}`);
  }

  return { assets, referencePng, failures };
}
