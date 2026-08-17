import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeFigmaDesign } from "../../../packages/contracts/src/figma-design.mjs";

async function writeJsonAtomically(filePath, value) {
  const directory = dirname(filePath);
  const temporaryPath = join(
    directory,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function generateFigmaDesignFile(
  rawPath,
  { screenId, outputPath } = {}
) {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    throw new TypeError("figma.raw.json 경로가 필요합니다.");
  }

  const resolvedRawPath = resolve(rawPath);
  const resolvedOutputPath = resolve(
    outputPath ?? join(dirname(resolvedRawPath), "figma.design.json")
  );
  const inferredScreenId = screenId?.trim() || basename(dirname(resolvedRawPath));
  const raw = JSON.parse(await readFile(resolvedRawPath, "utf8"));
  const design = normalizeFigmaDesign(raw, {
    screenId: inferredScreenId,
    rawFile: basename(resolvedRawPath)
  });

  await writeJsonAtomically(resolvedOutputPath, design);
  return { design, outputPath: resolvedOutputPath };
}

async function runCli() {
  const [, , rawPath, screenId] = process.argv;
  if (!rawPath) {
    throw new TypeError(
      "사용법: node src/generate-figma-design.mjs <figma.raw.json 경로> [screenId]"
    );
  }

  const result = await generateFigmaDesignFile(rawPath, { screenId });
  process.stdout.write(`${result.outputPath}\n`);
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
