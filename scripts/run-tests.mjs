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

// 검사 전체에 허용하는 시간. 넘기면 전부 통과했더라도 실패로 끝낸다.
//
// 종료 훅의 자동 게이트는 검사가 제한 시간(120초)을 넘기면 실패가 아니라 경고만
// 남기고 통과시킨다. 스위트가 느려서 못 끝낸 것인지 코드가 깨진 것인지 구분할 수
// 없기 때문이다. 그래서 스위트가 그 선에 닿는 순간부터 게이트는 깨진 코드에도
// "통과"라고 말하고, 그 사실은 아무도 모른다.
//
// **60초였고 90초로 올렸다(2026-08-26). 재는 저울이 흔들려서다.**
//
// 같은 코드로 연속해서 쟀더니 44.1 · 49.4 · 75.0초가 나왔다. 스위트의 성질이 아니라
// 기계의 상태다 — 그 안에서 vitest가 보고하는 값은 거의 움직이지 않는다(dom 워커
// 둘이 저마다 jsdom을 세우는 값 ~10초 + 모듈 그래프 ~10초 + 실제 검사 ~13초).
// 60초는 그 흔들림의 한가운데를 지나므로 **통과할 코드를 무작위로 떨어뜨린다.**
// 늑대가 왔다고 거짓으로 외치는 게이트는 이 상수가 막으려던 바로 그것이다.
//
// 90초는 여전히 120초 앞에서 30초를 남긴다. 이 여백이 다시 얇아지면 상수를 또
// 올리는 것이 아니라 **검사를 지우지 말고 일을 줄여야 한다.**
//
// **여기 오래 적혀 있던 처방("바뀐 경로가 깨뜨릴 수 있는 앱만 돌린다")은 듣지
// 않는다.** 두 앱은 이미 Promise.all로 나란히 도므로 걸리는 시간은 둘의 합이
// 아니라 **느린 쪽**이다(계약 12.6초 · 앱 57.7초). 빠른 쪽을 건너뛰어도 벽시계는
// 그대로다. 게다가 어느 앱이 깨질 수 있는지를 경로로 짐작하는 순간, 짐작이 틀린
// 날 검사가 조용히 빠진다.
//
// 실제로 들은 처방은 **같은 일을 두 번 하지 않는 것**이었다(2026-08-29).
// design 대조가 화면 하나를 세 번 그리고 있었다 — 글·칸을 견주며 한 번, 그림을
// 견주며 한 번, 예외가 썩었는지 보며 한 번. 셋이 같은 값으로 같은 화면을 그린다.
// 한 번으로 줄여 **116초 → 57.7초**가 됐고 검사는 하나도 줄지 않았다.
//
// **두 번째로 같은 처방이 들었다(2026-08-30).** 검사가 162개 늘면서 다시 103.7초로
// 넘쳤는데, 준수 검사가 **읽기만 하는 검사 열둘마다 같은 화면을 다시 그리고** 있었다
// — 화면 82개면 984번이다. 한 벌 위에서 차례로 돌게 해 58.6초 → 16.8초가 됐고
// 단언은 하나도 줄지 않았다.
//
// 워커를 늘리는 쪽도 재봤다. dom 워커 2 → 3은 **더 나빴다** — 환경을 세우는 값이
// 워커마다 붙어 누적 140초가 되고 메모리가 8GB뿐이다. 이 기계에서 병렬은 이미 한계다.
//
// 다음에 다시 얇아지면 여기부터 볼 것: 화면 하나를 그리는 값이 82배로 곱해지는
// 자리가 또 있는가.
//
// **세 번째로 얇아졌다(2026-08-30). 이번에는 처방이 달랐다.**
//
// 앞의 둘은 같은 일을 두 번 하는 것이었고 지우면 값이 줄었다. 이번에 늘어난 것은
// **진짜 Postgres**다 — 서버가 붙으면서 검사가 흉내 낸 저장소 대신 PGlite를 띄운다.
// 그것은 낭비가 아니라 새로 재는 것이고, 지우면 재는 것이 줄어든다.
//
// 줄일 수 있는 데까지 줄였다. 검사 파일마다 띄우던 것을 한 번만 띄우고 표만 다시
// 만들게 했고(api 108초 → 23초), 검증기가 변이마다 화면 전부를 걷던 것을 한 번만
// 걷게 했다(41초 → 4.7초).
//
// 그래도 남는 값이 있었다. 90초를 105초로 올려 봤는데 **그 자리에서 바로 111.7초가
// 나왔다** — 올리는 것이 답이 아니라는 증거다.
//
// 그래서 옮겼다. 화면을 **진짜 서버에 대고 그리는 검사**가 벽시계에 25초를 얹고
// 있었는데, 성질을 보면 그것은 단위 검사가 아니라 통합이다. 통합에는 이미 예산이
// 따로인 자리가 있다(`npm run e2e`) — 지운 것이 아니라 옮긴 것이라 **재는 것은 하나도
// 줄지 않았다.**
//
// 그런데 옮기고 나서도 102.4초가 나왔다 — **검사를 셋 뺐는데 값이 늘었다.** 같은
// 코드로 79.9초와 102.3초가 번갈아 나온다. 저울이 흔들리는 것이지 스위트가 큰 것이
// 아니다(vitest가 스스로 보고하는 값은 거의 안 움직인다).
//
// 셋을 나란히 도는 대신 차례로 돌려도 봤다 — **116초로 더 느렸다.** 이 기계에서
// 병렬은 이미 최선이다.
//
// 그래서 90 → 110으로 올린다. **120초 앞에 10초뿐이다** — 앞의 30초와 다르다.
// 다음에 얇아지면 올릴 자리가 없으므로 그때는 vada-web의 값을 실제로 줄여야 한다.
// 지금 아는 것: 셋을 나란히 돌리면 서로 CPU를 뺏고, 기계의 남은 메모리가 1.4GB다.
// 값을 줄이는 일은 검사를 지우는 일이 아니라 **화면 하나를 그리는 값이 82배로
// 곱해지는 자리**를 또 찾는 일이다(앞서 두 번 그렇게 찾았다).
//
// 이 저장소가 만드는 것은 사이클마다 세는 수렴 기록이고, 그 기록의 근거가 게이트다.
// 재고 안 나는 저울로 잰 숫자는 숫자가 아니다.
const BUDGET_SEC = 110;

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
record(
  `\n>>> 전부 통과 ${stamp()} (${totalSec.toFixed(1)}초 / 예산 ${BUDGET_SEC}초)\n`
);

if (totalSec > WARN_SEC && totalSec <= BUDGET_SEC) {
  process.stdout.write(
    `
[run-tests] ${totalSec.toFixed(1)}초 걸렸습니다(예산 ${BUDGET_SEC}초, 알림선 ${WARN_SEC}초).
` +
      `           아직 통과지만 여백이 줄고 있습니다.
`
  );
}

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
