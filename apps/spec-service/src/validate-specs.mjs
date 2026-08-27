import { allElementsOf } from "../../../packages/contracts/src/element-walk.mjs";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020Module from "ajv/dist/2020.js";

import { collectSpecFindings } from "../../../packages/contracts/src/spec-validation.mjs";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const schemasDir = join(repoRoot, "packages", "contracts", "schemas");

const CATALOG_SCHEMA_FILES = [
  "screen.schema.json",
  "option-sources.schema.json",
  "data-sources.schema.json",
  "state-scopes.schema.json",
  "flows.schema.json",
  "mutations.schema.json",
  "shell.schema.json",
  "element-action.schema.json",
  "element-params.schema.json",
  "figma-design.schema.json",
  "figma-file.schema.json"
];

async function createValidators() {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
  for (const fileName of CATALOG_SCHEMA_FILES) {
    const schema = JSON.parse(await readFile(join(schemasDir, fileName), "utf8"));
    ajv.addSchema(schema);
  }

  // 요소 스키마 목록은 screen.schema.json의 spec.type enum이 유일한 원본이다.
  // 목록을 손으로 이중화하면 새 유형이 "검증 없이 통과"로 조용히 새어나간다.
  const screenSchema = JSON.parse(
    await readFile(join(schemasDir, "screen.schema.json"), "utf8")
  );
  const elementTypes =
    screenSchema.properties.elements.items.properties.spec.properties.type.enum;
  const elements = {};
  const elementPropertyOrder = {};
  for (const elementType of elementTypes) {
    const fileName = `${elementType}.schema.json`;
    let schema;
    try {
      schema = JSON.parse(await readFile(join(schemasDir, fileName), "utf8"));
    } catch (error) {
      throw new Error(
        `요소 유형 '${elementType}'의 스키마 ${fileName}을 읽을 수 없습니다: ${error.message}`
      );
    }
    ajv.addSchema(schema);
    elements[elementType] = ajv.getSchema(fileName);
    // 화면 JSON의 속성 순서 원본. 플러그인이 쓰는 순서와 같아야 한다.
    elementPropertyOrder[elementType] = Object.keys(schema.properties ?? {});
  }

  return {
    screen: ajv.getSchema("screen.schema.json"),
    optionSources: ajv.getSchema("option-sources.schema.json"),
    dataSources: ajv.getSchema("data-sources.schema.json"),
    stateScopes: ajv.getSchema("state-scopes.schema.json"),
    flows: ajv.getSchema("flows.schema.json"),
    mutations: ajv.getSchema("mutations.schema.json"),
    shell: ajv.getSchema("shell.schema.json"),
    figmaFile: ajv.getSchema("figma-file.schema.json"),
    figmaDesign: ajv.getSchema("figma-design.schema.json"),
    elementPropertyOrder,
    elements
  };
}

function describeAjvError(error) {
  const path = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${path} 허용되지 않는 속성 '${error.params.additionalProperty}'`;
  }
  return `${path} ${error.message}`;
}

function pushSchemaFindings(findings, file, prefix, errors) {
  for (const error of errors ?? []) {
    findings.push({
      level: "error",
      file,
      message: `${prefix}${describeAjvError(error)}`
    });
  }
}

async function readJsonFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalCatalog({
  findings,
  filePath,
  fileLabel,
  validator,
  missingMessage
}) {
  if (!(await pathExists(filePath))) {
    findings.push({ level: "warning", file: fileLabel, message: missingMessage });
    return null;
  }
  let catalog;
  try {
    catalog = await readJsonFile(filePath);
  } catch (error) {
    findings.push({
      level: "error",
      file: fileLabel,
      message: `JSON을 읽을 수 없습니다: ${error.message}`
    });
    return null;
  }
  if (!validator(catalog)) {
    pushSchemaFindings(findings, fileLabel, "스키마 위반: ", validator.errors);
  }
  return catalog;
}

// 화면의 모든 요소를 유형별 스키마로 다시 본다. **안쪽 요소도 화면의 요소와 같은
// 규칙을 받는다**(list.itemFields · itemList.itemFields).
//
// 한동안 최상위만 봤다. 그래서 FIN-REQ-01의 중첩 input에 없는 inputType과 불리언
// 자리에 글을 넣어도 검증이 0건이었다 - 재현으로 확인했다. 속성 **순서**만 어긋나게
// 하면 걸렸는데, 그건 순서 검사가 우연히 평평하게 훑기 때문이지 스키마가 본 것이
// 아니었다.
function validateScreenElements(findings, fileLabel, spec, validators) {
  for (const { element, path } of allElementsOf(spec)) {
    const elementSpec = element?.spec;
    const validator = validators.elements[elementSpec?.type];
    if (!validator) {
      // 검증기가 모르는 유형을 조용히 통과시키면 스키마 구멍이 된다.
      findings.push({
        level: "error",
        file: fileLabel,
        message: `${path}의 유형 '${elementSpec?.type}'을 검증할 스키마가 없습니다.`
      });
      continue;
    }
    if (!validator(elementSpec)) {
      pushSchemaFindings(
        findings,
        fileLabel,
        `${path} ${elementSpec.type} 스키마 위반: `,
        validator.errors
      );
    }
  }
}

async function validateWireframe(wireframeDir, wireframeKey, validators, findings) {
  const label = (...parts) => [wireframeKey, ...parts].join("/");

  const optionSources = await readOptionalCatalog({
    findings,
    filePath: join(wireframeDir, "option-sources.json"),
    fileLabel: label("option-sources.json"),
    validator: validators.optionSources,
    missingMessage: "선택지 출처 카탈로그가 없습니다."
  });
  const dataSources = await readOptionalCatalog({
    findings,
    filePath: join(wireframeDir, "data-sources.json"),
    fileLabel: label("data-sources.json"),
    validator: validators.dataSources,
    missingMessage: "데이터 출처 카탈로그가 없습니다."
  });
  const stateScopes = await readOptionalCatalog({
    findings,
    filePath: join(wireframeDir, "state-scopes.json"),
    fileLabel: label("state-scopes.json"),
    validator: validators.stateScopes,
    missingMessage: "상태 스코프 카탈로그가 없습니다."
  });

  // 흐름·제출 카탈로그는 선택 사항이다: 없으면 조용히 지나가고, 있으면 검증한다.
  const readOptionalOwnCatalog = async (fileName, validator) => {
    const filePath = join(wireframeDir, fileName);
    if (!(await pathExists(filePath))) {
      return null;
    }
    let catalog;
    try {
      catalog = await readJsonFile(filePath);
    } catch (error) {
      findings.push({
        level: "error",
        file: label(fileName),
        message: `JSON을 읽을 수 없습니다: ${error.message}`
      });
      return null;
    }
    if (!validator(catalog)) {
      pushSchemaFindings(findings, label(fileName), "스키마 위반: ", validator.errors);
    }
    return catalog;
  };

  const flowsCatalog = await readOptionalOwnCatalog("flows.json", validators.flows);
  const shellCatalog = await readOptionalOwnCatalog("shell.json", validators.shell);
  const mutations = await readOptionalOwnCatalog("mutations.json", validators.mutations);
  // Figma 문서 신원. 없어도 되지만(플러그인으로만 저장해 온 wireframe) 있으면 검사한다.
  await readOptionalOwnCatalog("figma-file.json", validators.figmaFile);

  const screensDir = join(wireframeDir, "screens");
  const entries = await readdir(screensDir, { withFileTypes: true });

  const screens = [];
  const designs = {};

  for (const entry of entries) {
    if (entry.isFile()) {
      if (entry.name.endsWith(".json")) {
        findings.push({
          level: "warning",
          file: label("screens", entry.name),
          message:
            "화면 명세는 screens/<screenId>/screen.json 구조를 따라야 합니다. screens/ 바로 아래의 파일은 무시됩니다."
        });
      }
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const screenDir = join(screensDir, entry.name);
    const specPath = join(screenDir, "screen.json");
    if (await pathExists(specPath)) {
      const fileLabel = label("screens", entry.name, "screen.json");
      let spec;
      try {
        spec = await readJsonFile(specPath);
      } catch (error) {
        findings.push({
          level: "error",
          file: fileLabel,
          message: `JSON을 읽을 수 없습니다: ${error.message}`
        });
        spec = undefined;
      }
      if (spec !== undefined) {
        if (!validators.screen(spec)) {
          pushSchemaFindings(findings, fileLabel, "화면 스키마 위반: ", validators.screen.errors);
        }
        validateScreenElements(findings, fileLabel, spec, validators);
        screens.push({ file: fileLabel, spec });
      }
    }

    const designPath = join(screenDir, "figma.design.json");
    const rawPath = join(screenDir, "figma.raw.json");
    const designLabel = label("screens", entry.name, "figma.design.json");

    if (!(await pathExists(designPath))) {
      if (await pathExists(rawPath)) {
        findings.push({
          level: "warning",
          file: designLabel,
          message: "figma.raw.json은 있으나 정규화된 figma.design.json이 없습니다."
        });
      }
      continue;
    }

    let design;
    try {
      design = await readJsonFile(designPath);
    } catch (error) {
      findings.push({
        level: "error",
        file: designLabel,
        message: `JSON을 읽을 수 없습니다: ${error.message}`
      });
      continue;
    }
    if (!validators.figmaDesign(design)) {
      pushSchemaFindings(findings, designLabel, "스키마 위반: ", validators.figmaDesign.errors);
    }

    if (await pathExists(rawPath)) {
      const rawText = await readFile(rawPath, "utf8");
      const rawHash = createHash("sha256").update(rawText, "utf8").digest("hex");
      const designHash = design?.source?.hash;
      if (typeof designHash !== "string") {
        findings.push({
          level: "warning",
          file: designLabel,
          message:
            "source.hash가 없어 figma.raw.json과의 신선도를 확인할 수 없습니다. 정규화 CLI를 다시 실행하면 기록됩니다."
        });
      } else if (designHash !== rawHash) {
        findings.push({
          level: "error",
          file: designLabel,
          message:
            "figma.raw.json이 변경된 뒤 정규화가 실행되지 않았습니다. generate-figma-design.mjs를 다시 실행하세요."
        });
      }
    } else {
      findings.push({
        level: "warning",
        file: designLabel,
        message: "원본 figma.raw.json이 없어 신선도를 확인할 수 없습니다."
      });
    }

    let assetFiles = [];
    try {
      // 자산은 벡터(svg)와 래스터(png) 둘 다다. svg만 세면 png 자산이
      // 있는데도 '없다'고 보고한다.
      assetFiles = (await readdir(join(screenDir, "assets"))).filter(
        (name) => name.endsWith(".svg") || name.endsWith(".png")
      );
    } catch {
      assetFiles = [];
    }

    designs[entry.name] = {
      file: designLabel,
      design,
      assetFiles,
      hasReference: await pathExists(join(screenDir, "reference.png"))
    };
  }

  for (const screenId of Object.keys(designs)) {
    if (!screens.some((screen) => screen.spec?.screenId === screenId)) {
      findings.push({
        level: "warning",
        file: designs[screenId].file,
        message: `figma.design.json은 있으나 동작 명세 screens/${screenId}/screen.json이 없습니다.`
      });
    }
  }

  findings.push(
    ...collectSpecFindings({
      screens,
      optionSources,
      dataSources,
      stateScopes,
      designs,
      flows: flowsCatalog,
      flowsFile: label("flows.json"),
      shell: shellCatalog,
      shellFile: label("shell.json"),
      mutations,
      mutationsFile: label("mutations.json"),
      propertyOrderByType: validators.elementPropertyOrder
    })
  );
}

async function isWireframeDir(path) {
  try {
    const stats = await stat(join(path, "screens"));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function validateSpecsRoot(rootDir) {
  const resolvedRoot = resolve(rootDir);
  const validators = await createValidators();
  const findings = [];

  const wireframes = [];
  if (await isWireframeDir(resolvedRoot)) {
    wireframes.push({ dir: resolvedRoot, key: basename(resolvedRoot) });
  } else {
    for (const entry of await readdir(resolvedRoot, { withFileTypes: true })) {
      const candidate = join(resolvedRoot, entry.name);
      if (entry.isDirectory() && (await isWireframeDir(candidate))) {
        wireframes.push({ dir: candidate, key: entry.name });
      }
    }
  }

  if (wireframes.length === 0) {
    findings.push({
      level: "warning",
      file: resolvedRoot,
      message: "검증할 wireframe 폴더(screens/ 포함)를 찾지 못했습니다."
    });
    return findings;
  }

  for (const wireframe of wireframes) {
    await validateWireframe(wireframe.dir, wireframe.key, validators, findings);
  }
  return findings;
}

async function runCli() {
  const target = process.argv[2]
    ? resolve(process.argv[2])
    : join(repoRoot, "specs", "figma");
  const findings = await validateSpecsRoot(target);

  for (const finding of findings) {
    const tag = finding.level === "error" ? "[오류]" : "[경고]";
    process.stdout.write(`${tag} ${finding.file} — ${finding.message}\n`);
  }

  const errorCount = findings.filter((finding) => finding.level === "error").length;
  const warningCount = findings.length - errorCount;
  process.stdout.write(`오류 ${errorCount}건, 경고 ${warningCount}건\n`);
  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (entryUrl === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
