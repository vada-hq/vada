/**
 * 생성된 API 클라이언트가 **입력에서 결정적으로 나온 그것인지** 본다.
 *
 * 손으로 고친 생성 코드는 다음 생성에서 조용히 사라지거나, 더 나쁘게는 계약에
 * 없는 타입을 화면에 실어 나른다. 그래서 입력·설정·파일의 해시를 manifest에
 * 남기고 매번 맞춰 본다.
 *
 * **이 파일도 어느 계약 묶음인지 모른다.** 여기 있는 상수는 전부 `@vada/api-client`
 * 패키지에 관한 것이고, 묶음마다 다른 것은 OpenAPI 입력 경로뿐이라 인자로 받는다.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  equalJson,
  isObject,
  normalizePath,
  readJson,
  serializeJson,
  sha256,
} from "./json.mjs";

const execFileAsync = promisify(execFile);

export const CLIENT_PACKAGE_PATH = "packages/api-client/package.json";
export const CLIENT_CONFIG_PATH = "packages/api-client/openapi-ts.config.ts";
export const GENERATED_DIRECTORY = "packages/api-client/src/generated";
export const GENERATED_MANIFEST_PATH =
  "packages/api-client/generated-manifest.json";
export const CLIENT_ENTRYPOINT_PATH = "packages/api-client/src/index.ts";
export const CLIENT_ENTRYPOINT = 'export * from "./generated/index";\n';
export const CLIENT_PUBLIC_EXPORT = ".";
export const GENERATOR_PACKAGE = "@hey-api/openapi-ts";
export const GENERATOR_VERSION = "0.95.0";

async function snapshotDirectory(directory) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const contents = await readFile(path);
        files.push({
          path: normalizePath(relative(directory, path)),
          sha256: sha256(contents),
        });
      }
    }
  }
  await visit(directory);
  return files;
}

export async function expectedGeneratedManifest(root, openApiPath) {
  const [input, config, packageDocument, files] = await Promise.all([
    readFile(resolve(root, openApiPath)),
    readFile(resolve(root, CLIENT_CONFIG_PATH)),
    readJson(root, CLIENT_PACKAGE_PATH),
    snapshotDirectory(resolve(root, GENERATED_DIRECTORY)),
  ]);
  return {
    schema_version: "1.0.0",
    generator: {
      package: GENERATOR_PACKAGE,
      version: packageDocument.devDependencies?.[GENERATOR_PACKAGE],
    },
    input: { path: openApiPath, sha256: sha256(input) },
    config: { path: CLIENT_CONFIG_PATH, sha256: sha256(config) },
    files,
  };
}

function isWithinDirectory(directory, path) {
  const relativePath = relative(directory, path);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

function collectPackageExportTargets(value, location, errors, targets) {
  if (typeof value === "string") {
    targets.push({ location, target: value });
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      errors.push(`${location}: 빈 exports fallback 배열은 허용하지 않습니다.`);
    }
    value.forEach((entry, index) =>
      collectPackageExportTargets(
        entry,
        `${location}[${index}]`,
        errors,
        targets,
      ),
    );
    return;
  }
  if (isObject(value)) {
    const conditions = Object.entries(value);
    if (conditions.length === 0) {
      errors.push(`${location}: 빈 exports 조건 객체는 허용하지 않습니다.`);
    }
    for (const [condition, target] of conditions) {
      if (condition.startsWith(".")) {
        errors.push(
          `${location}: 공개 subpath는 exports 최상위에서만 선언해야 합니다.`,
        );
      }
      collectPackageExportTargets(
        target,
        `${location}.${condition}`,
        errors,
        targets,
      );
    }
    return;
  }
  errors.push(`${location}: exports target은 경로 또는 조건 객체여야 합니다.`);
}

function validateClientPackagePublicSurface(root, packageDocument) {
  const errors = [];
  const packageExports = packageDocument.exports;
  if (!isObject(packageExports)) {
    return [`${CLIENT_PACKAGE_PATH}: exports는 공개 subpath 객체여야 합니다.`];
  }

  const publicSubpaths = Object.keys(packageExports);
  if (
    publicSubpaths.length !== 1 ||
    publicSubpaths[0] !== CLIENT_PUBLIC_EXPORT
  ) {
    errors.push(
      `${CLIENT_PACKAGE_PATH}: exports에는 승인된 공개 진입점 "${CLIENT_PUBLIC_EXPORT}" 하나만 허용합니다.`,
    );
  }

  const targets = [];
  for (const [subpath, target] of Object.entries(packageExports)) {
    collectPackageExportTargets(
      target,
      `${CLIENT_PACKAGE_PATH}#exports[${JSON.stringify(subpath)}]`,
      errors,
      targets,
    );
  }

  const packageDirectory = resolve(root, dirname(CLIENT_PACKAGE_PATH));
  const sourceDirectory = resolve(root, dirname(CLIENT_ENTRYPOINT_PATH));
  const approvedEntrypoint = resolve(root, CLIENT_ENTRYPOINT_PATH);
  for (const { location, target } of targets) {
    if (!target.startsWith("./")) {
      errors.push(`${location}: package-relative 경로여야 합니다.`);
      continue;
    }
    const resolvedTarget = resolve(packageDirectory, target);
    if (!isWithinDirectory(packageDirectory, resolvedTarget)) {
      errors.push(`${location}: package 경계 밖을 공개할 수 없습니다.`);
      continue;
    }
    if (!isWithinDirectory(sourceDirectory, resolvedTarget)) {
      errors.push(`${location}: src 경계 밖을 공개할 수 없습니다.`);
      continue;
    }
    if (resolvedTarget !== approvedEntrypoint) {
      errors.push(
        `${location}: 승인된 생성 진입점 ${CLIENT_ENTRYPOINT_PATH}만 공개할 수 있습니다.`,
      );
    }
  }

  return errors;
}

export async function validateGeneratedClient(root, openApiPath) {
  const errors = [];
  const warnings = [];
  try {
    const [manifest, expected, entrypoint, packageDocument] = await Promise.all(
      [
        readJson(root, GENERATED_MANIFEST_PATH),
        expectedGeneratedManifest(root, openApiPath),
        readFile(resolve(root, CLIENT_ENTRYPOINT_PATH), "utf8"),
        readJson(root, CLIENT_PACKAGE_PATH),
      ],
    );
    errors.push(...validateClientPackagePublicSurface(root, packageDocument));
    if (expected.generator.version !== GENERATOR_VERSION) {
      errors.push(
        `${GENERATOR_PACKAGE}는 정확히 ${GENERATOR_VERSION}으로 고정해야 합니다.`,
      );
    }
    if (manifest.input?.sha256 !== expected.input.sha256) {
      errors.push("OpenAPI 입력 드리프트를 생성 manifest가 탐지했습니다.");
    }
    if (manifest.config?.sha256 !== expected.config.sha256) {
      errors.push("Hey API 설정 드리프트를 생성 manifest가 탐지했습니다.");
    }
    if (!equalJson(manifest.files, expected.files)) {
      errors.push("생성 클라이언트 드리프트를 탐지했습니다.");
    }
    if (!equalJson(manifest, expected)) {
      errors.push("생성 manifest가 현재 입력·설정·파일과 다릅니다.");
    }
    if (entrypoint !== CLIENT_ENTRYPOINT) {
      errors.push(
        `${CLIENT_ENTRYPOINT_PATH}: 생성 진입점에 수동 타입이나 내보내기를 둘 수 없습니다.`,
      );
    }
  } catch (error) {
    errors.push(`${GENERATED_MANIFEST_PATH}: ${error.message}`);
  }
  return { errors, warnings };
}

export async function snapshotFreshGeneration(root) {
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), "vada-api-client-generate-"),
  );
  try {
    const cliPath = resolve(
      root,
      "packages/api-client/node_modules/@hey-api/openapi-ts/bin/run.js",
    );
    await execFileAsync(
      process.execPath,
      [
        cliPath,
        "--file",
        resolve(root, CLIENT_CONFIG_PATH),
        "--output",
        temporaryDirectory,
        "--silent",
        "--no-log-file",
      ],
      {
        cwd: resolve(root, "packages/api-client"),
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return await snapshotDirectory(temporaryDirectory);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function writeGeneratedManifest(root, openApiPath) {
  const manifest = await expectedGeneratedManifest(root, openApiPath);
  const outputPath = resolve(root, GENERATED_MANIFEST_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeJson(manifest));
}
