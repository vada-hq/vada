// 두 앱의 테스트를 **함께** 돌리고, 무슨 일이 있었는지 파일로 남긴다.
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
// 이쪽은 덮어쓰지 않는다. 드물게 나는 일은 쌓여야 보인다.
const flakePath = join(repoRoot, ".test-flakes.log");

// **셋이 됐다(2026-08-30).** apps/api가 붙으면서 느린 쪽이 바뀔 수 있다 —
// 나란히 도므로 벽시계는 가장 느린 하나가 정한다. 지금은 여전히 vada-web이다.
const APPS = ["apps/spec-service", "apps/vada-web", "apps/api"];

// 저울이 재는 것.
//
// **오랫동안 벽시계를 재고 그것으로 실패시켰다.** 근거는 이 파일의 주석에만 있었다 —
// "종료 훅의 자동 게이트가 120초를 넘기면 실패를 통과시킨다". 2026-08-30에 찾아보니
// **그런 장치가 이 저장소 어디에도 없다.** `.githooks`는 pre-commit과 pre-push 둘뿐이고
// 시간 제한이 없다. 확인할 수 없는 수를 근거로 초록 코드를 네 번 떨어뜨렸다.
//
// 그리고 벽시계는 **코드가 정하는 값이 아니다.** 같은 코드로 79.9 · 85.5 · 93.7 ·
// 102.3 · 111.7 · 150.6초가 나왔는데, 그동안 vitest가 스스로 보고한 값은 63.7초에서
// 거의 움직이지 않았다. 차이는 기계다(남은 메모리 1GB, 다른 프로세스와 겹침).
// **기계 때문에 코드를 떨어뜨리는 게이트는 늑대가 왔다고 거짓으로 외치는 것이다** —
// 이 파일이 60초를 90초로 올릴 때 스스로 그렇게 적어 두었다.
//
// 그래서 둘을 가른다.
//
// · **검사가 스스로 잰 값**으로 실패시킨다. 코드가 정하는 값이고 흔들리지 않는다.
//   이것이 막으려는 것은 하나다 — **재는 저울이 느려지면 사람이 덜 재게 된다.**
// · **벽시계는 알리기만 한다.** 넘쳤다는 사실은 보이되 실패로 만들지 않는다.
//
// 값을 줄이는 처방은 두 번 통했다. design 대조가 화면 하나를 세 번 그리던 것(116→57.7초),
// 준수 검사가 읽기만 하는 검사 열둘마다 다시 그리던 것(58.6→16.8초). 지금 남은
// 되풀이는 **그 둘이 저마다 화면 여든둘을 그린다**는 것이다(27.6 + 21.3초).
const BUDGET_SEC = 90;

// 넘치기 전에 미리 알린다. 실패시키지는 않되 여백이 얼마나 남았는지는 보여야 한다.
const WARN_SEC = 60;

function stamp() {
  // Date는 로그에만 쓴다. 판정에는 쓰지 않는다.
  return new Date().toISOString();
}

function record(text) {
  appendFileSync(logPath, text);
}

// 출력은 흘려보내지 않고 앱마다 모아 둔다.
//
// 둘이 함께 도니 그대로 흘리면 두 앱의 줄이 섞인다. 섞인 로그는 원인을 말해주지
// 못하고, 이 파일이 있는 이유가 바로 그것이었다. 끝난 뒤 앱 순서대로 적는다.
function runOne(app) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = "";

    const child = spawn("npm", ["--prefix", app, "test"], {
      cwd: repoRoot,
      shell: true
    });

    const collect = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    child.on("close", (code) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      resolve({ code: code ?? 1, output, seconds });
    });
  });
}

function reportOne(app, { code, output, seconds }) {
  record(`
===== ${app} =====
` + output);
  record(`----- ${app}: 종료 코드 ${code}, ${seconds}초 -----
`);
  process.stdout.write(`
===== ${app} (${seconds}초) =====
` + output);
}

// 검사가 실패한 것과 검사를 돌리지 못한 것은 다른 일이다.
//
// 실제로 겪은 실패의 지문: 열네 파일이 전부 "0 test"로 죽고, 그 안에서 vitest가
// 러너를 찾지 못한다("Vitest failed to find the current suite", "Cannot read
// properties of undefined (reading 'config')"). jsdom을 쓰지 않는 node 검사까지
// 같이 죽고, tests 0ms다 — 단언이 틀린 게 아니라 아무것도 시작되지 못한 것이다.
//
// 원인은 못 찾았다. CI 환경·반복·동시 실행·CPU 부하·찬 캐시·중복 설치를 하나씩
// 지웠지만 재현되지 않는다. 그래서 진단하는 대신 두 가지를 가른다.
//
// 가르는 근거: 진짜 실패는 검사가 돌다가 난다. 하나도 돌지 않았는데 실패했다면
// 그건 검사의 판정이 아니다. 이 경우에만 한 번 다시 돌린다 — setup 파일이 깨진
// 것처럼 진짜로 못 도는 상태라면 두 번째도 똑같이 죽으므로 걸러지지 않는다.
function ranNothing(output) {
  return /Tests\s+no tests/.test(output);
}

/**
 * 그 앱의 검사가 **스스로 잰** 값(초).
 *
 * vitest는 `Duration  56.61s`, node --test는 `# duration_ms 30393`으로 적는다.
 * 못 읽으면 null이다 — 못 읽은 것을 0으로 세면 저울이 조용히 헐거워진다.
 */
function selfMeasuredSec(output) {
  const vitest = output.match(/Duration\s+([\d.]+)s/);
  if (vitest !== null) return Number(vitest[1]);
  const node = output.match(/# duration_ms\s+([\d.]+)/);
  if (node !== null) return Number(node[1]) / 1000;
  return null;
}

writeFileSync(logPath, `테스트 실행 ${stamp()}\n`);

const startedAll = Date.now();

// 두 앱을 **함께** 돌린다.
//
// 차례로 돌리면 두 시간이 그대로 더해지는데, 그 합이 예산(60초)을 넘겼다(68.3초).
// 두 앱은 서로의 산출물을 쓰지 않는다 — 한쪽은 node --test로 계약을 검사하고
// 다른 쪽은 vitest로 화면을 그린다. 순서가 뜻을 갖지 않으므로 함께 돌려도 된다.
//
// **나란히 도는 순간 '한쪽만 돌린다'는 처방은 값을 잃는다.** 벽시계는 느린 쪽이
// 정하므로 빠른 쪽을 건너뛰어도 그대로다. 넘칠 때 볼 곳은 느린 쪽 안에서
// 되풀이되는 일이다.
const results = await Promise.all(APPS.map((app) => runOne(app)));

for (const [at, app] of APPS.entries()) {
  let { code, output } = results[at];
  reportOne(app, results[at]);

  if (code !== 0 && ranNothing(output)) {
    // 다시 돌리기 전에, 이번 일이 있었다는 사실부터 남긴다. 다시 돌려서 통과하면
    // 아무 일도 없던 것처럼 보이는데, 그러면 이 문제는 영영 잡히지 않는다.
    // `.test-flakes.log`는 덮어쓰지 않고 쌓인다 — 언젠가 이 기록이 원인을 말해준다.
    appendFileSync(
      flakePath,
      `\n===== ${stamp()} ${app}: 검사가 하나도 돌지 못했습니다 =====\n${output}`
    );
    record(`\n>>> ${app}이(가) 하나도 돌지 못했습니다. 한 번 다시 돌립니다.\n`);
    process.stdout.write(
      `\n[run-tests] ${app}: 검사가 하나도 돌지 못했습니다(검사 실패가 아닙니다).\n` +
        `           한 번 다시 돌립니다. 기록은 .test-flakes.log에 쌓입니다.\n`
    );
    const again = await runOne(app);
    reportOne(app, again);
    ({ code, output } = again);
  }

  if (code !== 0) {
    record(`\n>>> ${app}에서 실패했습니다. 위 출력이 원인입니다.\n`);
    process.stdout.write(
      `\n[run-tests] ${app} 실패. 전체 출력은 .test-last.log에 있습니다.\n`
    );
    process.exit(code);
  }
}

const totalSec = (Date.now() - startedAll) / 1000;

// 앱들이 나란히 도므로 **검사가 스스로 잰 값도 가장 느린 하나**가 정한다.
// 합을 쓰면 앱을 쪼갤 때마다 수가 늘어 실제로 느려지지 않았는데 넘친 것처럼 보인다.
const measured = results.map(({ output }) => selfMeasuredSec(output));
const unknown = APPS.filter((_, at) => measured[at] === null);
const selfSec = Math.max(0, ...measured.filter((value) => value !== null));

record(
  `
>>> 전부 통과 ${stamp()}
` +
    `    검사가 스스로 잰 값 ${selfSec.toFixed(1)}초 (예산 ${BUDGET_SEC}초)
` +
    `    벽시계 ${totalSec.toFixed(1)}초
`
);

// **벽시계는 알리기만 한다.** 기계가 정하는 값이라 실패로 만들면 초록 코드가
// 무작위로 떨어진다.
if (totalSec > selfSec * 1.5 + 20) {
  process.stdout.write(
    `
[run-tests] 벽시계 ${totalSec.toFixed(1)}초, 검사가 잰 값 ${selfSec.toFixed(1)}초.
` +
      `           차이가 큽니다 — 기계가 바쁘거나 다른 프로세스와 겹쳤을 수 있습니다.
`
  );
}

// 값을 못 읽으면 **조용히 통과시키지 않는다.** 읽는 규칙이 바뀌면 저울이 헐거워지고,
// 헐거워진 저울은 아무 말도 하지 않는다.
if (unknown.length > 0) {
  const reason =
    `${unknown.join(", ")}의 출력에서 검사가 스스로 잰 값을 읽지 못했습니다.
` +
    `할 일: selfMeasuredSec가 읽는 모양이 바뀌었는지 볼 것.
`;
  record(`
>>> 저울을 읽지 못함
${reason}`);
  process.stdout.write(`
[run-tests] ${reason}`);
  process.exit(1);
}

if (selfSec > WARN_SEC && selfSec <= BUDGET_SEC) {
  process.stdout.write(
    `
[run-tests] 검사가 ${selfSec.toFixed(1)}초 걸렸습니다(예산 ${BUDGET_SEC}초, 알림선 ${WARN_SEC}초).
` +
      `           아직 통과지만 여백이 줄고 있습니다.
`
  );
}

if (selfSec > BUDGET_SEC) {
  const reason =
    `검사는 전부 통과했지만 검사 자체가 ${selfSec.toFixed(1)}초 걸렸습니다(예산 ${BUDGET_SEC}초).
` +
    `**재는 저울이 느려지면 사람이 덜 재게 됩니다.** 그것이 검사를 없애는 가장 흔한 길입니다.
` +
    `할 일: 검사를 지우지 말고 **되풀이되는 일**을 찾을 것 — 화면 하나를 그리는 값이
` +
    `여든두 배로 곱해지는 자리가 또 있는가.
`;
  record(`
>>> 시간 예산 초과
${reason}`);
  process.stdout.write(`
[run-tests] ${reason}`);
  process.exit(1);
}
