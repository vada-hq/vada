import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildOpenApi, requestBodies } from "./generate-openapi.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const specRoot = join(repoRoot, "specs", "figma", "vada-wireframe");
const OUT = join(specRoot, "openapi.json");
const BODIES = join(specRoot, "request-bodies.json");

function read(name) {
  return JSON.parse(readFileSync(join(specRoot, name), "utf-8"));
}

function readScreens() {
  const screensDir = join(specRoot, "screens");
  const screens = [];
  for (const entry of readdirSync(screensDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      screens.push(
        JSON.parse(readFileSync(join(screensDir, entry.name, "screen.json"), "utf-8"))
      );
    } catch {
      continue;
    }
  }
  return screens;
}

export function buildVadaOpenApi() {
  return buildOpenApi({
    dataSources: read("data-sources.json"),
    mutations: read("mutations.json"),
    optionSources: read("option-sources.json"),
    screens: readScreens(),
    info: {
      title: "vada",
      version: "0.1.0",
      description:
        "학생회 운영 도구의 API. **이 문서는 손으로 쓰지 않는다** — " +
        "specs/figma/vada-wireframe의 카탈로그에서 만들어진다" +
        "(apps/spec-service/src/generate-openapi.mjs).\n\n" +
        "**아직 없는 것**: 인증 규약, 기계가 읽는 오류 코드, 쪽 나눔 규약. " +
        "명세가 정한 적이 없어 지어내지 않았다."
    },
    servers: [
      {
        url: "/",
        description:
          "**배포 주소는 아직 정하지 않았다.** 같은 호스트에서 잰다는 뜻으로 두었다 — " +
          "지어낸 도메인을 적으면 그 거짓이 생성된 클라이언트까지 간다."
      }
    ],
    securityScheme: {
      key: "session",
      cookieName: "vada.session",
      description: "로그인한 사람의 세션. Better Auth가 발급하고 우리 Postgres에 앉는다."
    }
  });
}

export function buildVadaRequestBodies(document = buildVadaOpenApi()) {
  return requestBodies(document);
}

function writeVadaOpenApi() {
  const document = buildVadaOpenApi();
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
  writeFileSync(
    BODIES,
    `${JSON.stringify(buildVadaRequestBodies(document), null, 2)}\n`,
    "utf-8"
  );
  const count = Object.values(document.paths).reduce(
    (sum, item) => sum + Object.keys(item).length,
    0
  );
  process.stdout.write(
    `openapi.json — 자리 ${Object.keys(document.paths).length}개 · 동작 ${count}개\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeVadaOpenApi();
}
