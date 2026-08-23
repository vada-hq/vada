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

// 검사 전체에 허용하는 시간. 넘기면 전부 통과했더라도 실패로 끝낸다.
//
// 종료 훅의 자동 게이트는 검사가 제한 시간(120초)을 넘기면 실패가 아니라
// 경고만 남기고 통과시킨다. 스위트가 느려서 못 끝낸 것인지 코드가 깨진 것인지
// 구분할 수 없기 때문이다. 그래서 스위트가 그 선에 닿는 순간부터 게이트는
// 깨진 코드에도 "통과"라고 말하고, 그 사실은 아무도 모른다.
//
// 이 저장소가 만드는 것은 사이클마다 세는 수렴 기록이고, 그 기록의 근거가
// 게이트다. 재고 안 나는 저울로 잰 숫자는 숫자가 아니다.
//
// 그래서 게이트의 절반에서 미리 멈춘다. 미래의 조용한 통과를 지금의 시끄러운
// 실패로 바꾸는 것이 이 상수의 전부다. 걸리면 검사를 지울 것이 아니라, 바뀐
// 경로가 깨뜨릴 수 있는 앱만 돌리도록 APPS 실행을 쪼개면 된다.
const BUDGET_SEC = 60;

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

const startedAll = Date.now();

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

const totalSec = (Date.now() - startedAll) / 1000;
record(
  `\n>>> 전부 통과 ${stamp()} (${totalSec.toFixed(1)}초 / 예산 ${BUDGET_SEC}초)\n`
);

if (totalSec > BUDGET_SEC) {
  const reason =
    `검사는 전부 통과했지만 ${totalSec.toFixed(1)}초가 걸렸습니다(예산 ${BUDGET_SEC}초). ` +
    `종료 훅의 자동 게이트는 120초를 넘기면 실패를 실패로 알리지 못하고 통과시킵니다. ` +
    `그 선에 닿기 전에 멈춘 것입니다.\n` +
    `할 일: 검사를 지우지 말고, 바뀐 경로가 깨뜨릴 수 있는 앱만 돌리도록 ` +
    `APPS 실행을 쪼갤 것.\n`;
  record(`\n>>> 시간 예산 초과\n${reason}`);
  process.stdout.write(`\n[run-tests] ${reason}`);
  process.exit(1);
}
