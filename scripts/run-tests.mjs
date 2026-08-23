// 세 앱의 테스트를 차례로 돌리고, 무슨 일이 있었는지 파일로 남긴다.
//
// 자동 테스트 게이트가 실패를 알릴 때 출력이 비어 있는 일이 반복됐다. 출력이
// 없으면 원인을 추측할 수밖에 없고, 실제로 세 번 추측하고 세 번 다 빗나갔다.
// 여기서 남긴 파일이 다음 실패 때 추측을 대신한다.
//
// 남기는 것은 `.test-last.log` 하나뿐이다. 매번 덮어쓰므로 쌓이지 않는다.
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const logPath = join(repoRoot, ".test-last.log");

const APPS = ["apps/figma-plugin", "apps/spec-service", "apps/vada-web"];

function stamp() {
  // Date는 로그에만 쓴다. 판정에는 쓰지 않는다.
  return new Date().toISOString();
}

function record(text) {
  appendFileSync(logPath, text);
}

function runOne(app) {
  return new Promise((resolve) => {
    const started = Date.now();
    record(`\n===== ${app} =====\n`);

    const child = spawn("npm", ["--prefix", app, "test"], {
      cwd: repoRoot,
      shell: true
    });

    const echo = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      record(text);
    };
    child.stdout.on("data", echo);
    child.stderr.on("data", echo);

    child.on("close", (code) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      record(`----- ${app}: 종료 코드 ${code}, ${seconds}초 -----\n`);
      resolve(code ?? 1);
    });
  });
}

writeFileSync(logPath, `테스트 실행 ${stamp()}\n`);

for (const app of APPS) {
  const code = await runOne(app);
  if (code !== 0) {
    record(`\n>>> ${app}에서 실패했습니다. 위 출력이 원인입니다.\n`);
    process.stdout.write(
      `\n[run-tests] ${app} 실패. 전체 출력은 .test-last.log에 있습니다.\n`
    );
    process.exit(code);
  }
}

record(`\n>>> 전부 통과 ${stamp()}\n`);
