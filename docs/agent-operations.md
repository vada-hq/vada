---
독자: 에이전트
상태: 계획(적용 전). 적용 순서는 맨 아래 '적용'에 있다.
---

# 에이전트 운영 방법

이 저장소에서 Claude Code와 Codex를 어떻게 굴리는지 정한다. 세션, 문맥, 역할별 모델과 effort, 검토 도구, 확장 수단이다. 일의 흐름(기능 명세 → 조각 → 검토 → 배포)은 `docs/work-method.md`가 정하고, 이 문서는 그 흐름을 도구로 어떻게 돌리는지만 정한다. 2026-10-20 조사로 정했다(`.superpowers/research/2026-10-20-method/ops-*.md`, git 밖).

## 한 줄로

세션은 기능 하나에 하나다. 진행 세션은 Opus 5.5 high로 판단하고 배포한다. 코드는 Sonnet 5.5 작업자가 쓴다. 검토는 새 문맥의 검토자가 한 번 한다. 위험한 조각만 Opus와 Codex가 따로 깊게 본다. 역할별 모델과 effort는 저장소의 에이전트 정의 파일에 고정해, 누가 돌려도 같게 움직인다.

## 정한 것

| 질문 | 정한 것 | 근거 |
|---|---|---|
| 세션을 옮기나 | 기능(또는 기반 일 하나)이 바뀔 때 문맥을 비운다. 넘기는 것은 파일(명세, 진행 기록, git)이다 | [Claude Code 모범 사례](https://code.claude.com/docs/en/best-practices): 무관한 작업 사이 `/clear`, "명세가 끝나면 새 세션에서 실행". [Anthropic 긴 작업 하네스](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): 한 번에 기능 하나, 진행 파일과 git으로 인계 |
| 자동 압축 | 압축 창을 400K 토큰으로 낮춘다 | 1M 창 모델은 기본으로 약 967K에서야 압축한다([model-config](https://code.claude.com/docs/en/model-config#default-auto-compact-thresholds)). 기능 2 진행 세션은 호출마다 평균 약 49만 토큰이었다. 문서에 권장 숫자는 없어 처음 값이고 잰 뒤 고친다 |
| `/compact`, `/clear` | 사람이 기능 경계에서 `/clear`, 긴 일 앞의 자연스러운 끊김에서만 `/compact 초점`. 조각 중간에는 하지 않는다 | [prompt-caching](https://code.claude.com/docs/en/prompt-caching): 모델과 effort는 세션 처음에 정하고 압축은 작업 사이 끊김에 |
| 세션을 여러 개 쓰나 | 한 사람이 한 기능에 진행 세션 하나. 나란히 하는 일은 그 안의 하위 에이전트로 한다(작업자 둘까지). 사람끼리는 서로 다른 기능을 각자의 작업 폴더에서 한다 | [agents](https://code.claude.com/docs/en/agents): 같은 파일을 만지면 worktree로 격리. [Anthropic 다중 에이전트](https://www.anthropic.com/engineering/built-multi-agent-research-system): 코딩은 나란히 할 일이 적고 토큰을 약 15배 쓴다 |
| 에이전트 팀, 클라우드 세션 | 쓰지 않는다 | 에이전트 팀은 실험 기능이고 기본으로 꺼져 있다. 토큰을 약 7배 쓰고 Windows Terminal 분할창을 지원하지 않는다. 클라우드 세션은 비밀 값과 DB 접근이 필요하고 회사 공용 계정의 사용량을 나눠 쓴다 |
| 워크플로 | 사람이 "워크플로로" 또는 `ultracode`라고 한 일에만 쓴다. 맞는 일: 저장소 전체 점검, 교차 확인하는 조사 | [workflows](https://code.claude.com/docs/en/workflows): 사람이 고르는 기능이다. 하위 에이전트 몇 개를 넘는 일에 쓴다 |
| 역할별 모델과 effort | 아래 '역할' 표 | 아래 |
| Codex | 깊은 검토 조각의 두 번째 검토자로만 쓴다. 읽기 전용이다 | 아래 'Codex' |
| 스킬 | 지금은 만들지 않는다. 같은 절차를 세 번째 붙여 넣을 때 만든다 | [features-overview](https://code.claude.com/docs/en/features-overview): "세 번째 붙여 넣을 때 스킬로" |
| 플러그인 | 이 저장소에서는 superpowers를 끈다 | 아래 '플러그인' |
| fast mode | 쓰지 않는다 | [fast-mode](https://code.claude.com/docs/en/fast-mode): 긴 자율 작업에는 맞지 않는다. 구독에서는 사용 크레딧으로 따로 청구된다 |

## 세션과 문맥

- 진행 세션은 기능 하나(R01 같은 기반 일 하나도 같다)를 맡는다. 사람이 있으면 기능이 끝날 때 `/clear`를 하고, 새 기능은 명세, 진행 기록, `git log`를 읽고 시작한다. 사람이 없으면 기다리지 않고 같은 세션에서 이어 간다(`docs/work-method.md` '진행 에이전트'). 이때 문맥은 400K 자동 압축이 줄인다.
- 압축에서 살아남는 것은 루트 `CLAUDE.md`와 `AGENTS.md`, 최근에 읽은 파일 다섯 개까지뿐이다([context-window](https://code.claude.com/docs/en/context-window#what-survives-compaction)). 대화에서 정한 것은 그때그때 파일(명세의 '정한 것', 진행 기록의 `Ruling:`)에 적는다. 무엇을 남길지는 `CLAUDE.md`의 'Compact instructions'가 정한다.
- 같은 문제로 두 번 고쳐도 안 되면 문맥이 실패한 시도로 찼다는 신호다. 사람이 있으면 `/clear`하고 배운 것을 넣어 다시 시작한다(모범 사례). 하위 에이전트라면 아래 '막혔을 때'를 따른다.
- 모델은 세션 중간에 바꾸지 않는다. 모델을 바꾸면 캐시가 깨져 전체 문맥을 다시 읽는다. Opus 5.5의 effort 변경은 캐시를 지킨다.
- 세션 이름은 `/rename NNN-기능이름`으로 붙인다. 오래된 큰 세션은 이어서 열지 않는다. 캐시가 식은 뒤 이어 열면 전체를 캐시 없이 다시 읽는다([sessions](https://code.claude.com/docs/en/sessions)). 새 세션에서 파일을 가리킨다.
- 하위 에이전트 지시와 결과의 길이는 `docs/work-method.md` '진행 에이전트'를 따른다(지시 15줄, 결과는 파일에 쓰고 10줄 이하로 돌려준다).
- 문맥 크기는 `/context`, 캐시 미스는 `/usage`의 `Prompt cache` 줄로 본다.

## 나란히 하기와 작업 폴더

- 작업자는 `isolation: worktree`로 임시 작업 폴더에서 일한다. 진행 세션의 파일을 건드리지 못한다. 작업 폴더는 진행 세션의 HEAD에서 딴다(프로젝트 설정 `worktree.baseRef: "head"`). 그래야 아직 올리지 않은 명세 커밋과 앞 조각 가지가 보인다. 이 컴퓨터의 전역 설정은 `fresh`(원격 main에서 딴다)라서 프로젝트 설정으로 덮는다.
- 작업자는 시작할 때 가지 이름을 `work/NNN-조각번호`로 바꾸고(`git branch -m`), `npm ci --prefer-offline`으로 의존성을 깐다. 다른 폴더의 `node_modules`를 연결하지 않는다. npm 워크스페이스 링크가 그 폴더의 `packages/`를 가리켜, 작업 폴더에서 고친 계약 대신 main의 계약으로 시험하게 된다.
- 동시에 도는 작업자는 둘까지다(`docs/work-method.md` '동시에 하는 일'). 이 컴퓨터는 논리 코어가 8개이고, 시험이 겹치면 2~3배 느려졌다. 조사와 검토는 읽기만 하므로 더 많이 돌려도 된다.
- 워크플로의 동시 에이전트는 4로 둔다(`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`). 문서에 코어당 기준이 없어 처음 값이다.
- 팀원이 함께 일하면 사람마다 다른 기능을 맡고, 각자의 클론이나 작업 폴더에서 일한다. 같은 파일을 두 세션이 동시에 고치지 않는다([Codex 긴 작업](https://learn.chatgpt.com/docs/long-running-work.md)도 같다).

## 역할

역할마다 모델, effort, 도구를 `.claude/agents/<이름>.md` 머리말에 고정한다. 진행 에이전트는 하위 에이전트를 부를 때 이 이름으로 부르고, 호출마다 모델이나 effort를 따로 주지 않는다. 모델은 별칭이 아니라 전체 ID로 적는다. 별칭이 Claude Code 버전마다 다르게 풀린다(2.1.285에서는 `haiku`가 4.5다).

| 역할 | 파일 | 모델 | effort | 도구 | 까닭 |
|---|---|---|---|---|---|
| 진행 | 프로젝트 설정 `model`, `effortLevel` | `claude-opus-5-5` | high | 전체 | 판단, 결정, 배포와 확인을 한다. Opus 5.5의 기본은 medium이고, 확인이 중요한 일은 high다. xhigh는 우리 일에서 이득을 잰 적이 없어 쓰지 않는다 |
| 모양 잡기 | `shaper` | `claude-opus-5-5` | high | 읽기, 웹, 명세 파일 쓰기 | 답이 모호한 일은 큰 모델이 낫다. 정할 것마다 근거를 대조한다 |
| 조사 | `researcher` | `claude-opus-5-5` | high | 읽기, 웹, 조사 파일 쓰기. `omitClaudeMd: true` | 출처를 읽고 대조하는 여러 단계 일이다. 코드 규칙은 필요 없다 |
| 작업자 | `worker` | `claude-sonnet-5-5` | medium | 전체. `isolation: worktree` | 명세에 수용 기준과 닿는 곳이 정해진 코딩이다. 공식 권고는 "잘 정해진 에이전트 코딩은 Sonnet 5.5 medium", "지시가 구체적이면 작은 모델로" |
| 보통 검토 | `reviewer` | `claude-sonnet-5-5` | high | `Read, Grep, Glob, Bash` | 검토는 확인과 경계 사례가 중요한 일이라 high다. 작성자와 같은 등급 이상이다 |
| 깊은 검토 | `deep-reviewer` | `claude-opus-5-5` | high | `Read, Grep, Glob, Bash` | 주소, 인증, 권한, 학생회 사이 격리, 돈, 데이터 무결성, 운영 DB, 동시 처리 조각(`docs/work-method.md` 2절)이다. Codex가 따로 함께 본다 |
| 기계적 일 | `clerk` | `claude-haiku-5-5` | medium | 읽기, `Bash`, 결과 파일 쓰기. `omitClaudeMd: true` | 기록 세기, 지표 뽑기, 일정 읽기처럼 답이 하나인 일이다. Haiku 5.5의 공식 용도다. Claude Code 2.1.293 이상이 필요하다 |

근거: [model-config, effort 표](https://code.claude.com/docs/en/model-config#choose-an-effort-level)("Opus 5.5는 medium에서 시작"), [모델 개요](https://platform.claude.com/docs/en/models/overview), [Anthropic 블로그, 모델과 effort 고르기](https://claude.com/blog/claude-model-and-effort-level-in-claude-code), [effort 쓰기](https://claude.dev/blog/spending-your-effort/)("낮은 effort로 만들고 높은 effort로 확인"). 역할별 공식 표는 없다. 위 표는 공식 서술을 우리 역할에 대입한 것이라 아래 '재는 것'으로 확인한다.

- max는 쓰지 않는다. 과하게 생각하고 이득이 줄어든다는 공식 경고가 있다.
- Fable 5.1은 자동으로 쓰지 않는다. Opus 5.5의 2.5배 값이고 사용 크레딧으로 청구될 수 있다. 써야 할 것 같으면 턴 끝에 한 줄로 알린다.

### 막혔을 때

- 작업자가 검토 지적을 두 번 고쳐도 남으면 진행 에이전트가 원인을 가른다. 파일을 빠뜨렸거나 시험을 안 돌렸거나 중간에 멈췄으면 같은 모델의 effort를 올린다(medium → high). 맥락을 다 갖고 제대로 했는데 틀렸으면 한 단계 큰 모델(Opus 5.5 medium)의 새 작업자가 고친다([Anthropic 블로그](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)의 판단 기준).
- 검토는 세 번까지다. 세 번째에도 남으면 고치기를 멈추고 진행 에이전트가 접근을 다시 본다. 다시 정한 것은 진행 기록에 `Ruling:`으로 적는다.
- 다시 검토할 때는 고친 diff만 본다. 지적은 줄 하나가 아니라 버그의 부류로 내서 작업자가 같은 부류를 모두 고치게 한다. 이미 낸 지적은 다시 내지 않는다. 출처: [Anthropic, 코드 리뷰 수렴](https://claude.dev/blog/solving-code-review-at-anthropic/). 이렇게 해서 통과까지의 평균 검토 수가 2.08에서 1.32로 줄었다.

## Codex

- **쓰는 곳.** 깊은 검토 조각에서 `deep-reviewer`와 따로, 동시에 돌린다. 같은 모델이 자기 계열 출력을 좋게 보는 경향이 있고, 다른 계열은 일부 다른 오류를 찾는다. 다만 이 효과의 근거는 약하다(`ops-evidence.md` 1절). 그래서 위험한 조각에만 쓰고 효과를 잰다.
- **쓰지 않는 곳.** 구현, 보통 검토, PR 검토(`@codex review`. 우리는 PR을 쓰지 않는다). OpenAI의 Claude Code 플러그인(`codex-plugin-cc`)도 쓰지 않는다. 그 리뷰 게이트는 Stop 훅에서 돌아 긴 반복과 사용량 소진을 경고한다. 셸 호출 하나로 충분하다.
- **호출.** 저장소 스크립트 `tools/codex-review.sh <가지> <명세 경로> <조각 번호>`가 아래를 부른다. 결과는 JSON 파일로 받고, 진행 에이전트는 그 파일만 읽는다.

  ```bash
  codex exec -s read-only -m gpt-6.1-sol -c model_reasoning_effort="high" \
    --ephemeral --json --output-schema tools/codex-review-schema.json -o <결과.json> \
    "git diff main...<가지>와 <명세>의 조각 <번호>만 보라. 정확성, 수용 기준, AGENTS.md 위반만 Critical/Important로 내라. 형식, 린트, 타입은 보지 마라. 파일은 고치지 마라."
  ```

  - `-s read-only`는 매번 준다. 이 컴퓨터의 Codex 설정이 `danger-full-access`라서 생략하면 쓰기가 가능한 채로 돌 수 있다.
  - 모델은 공식 기본인 `gpt-6.1-sol`, effort는 공식 문서가 검토자 예로 든 `high`다. 전역 설정의 `deep-review` 프로필(`gpt-5.6-sol`, max, fast)은 쓰지 않는다. 이전 세대에 토큰 단가가 두 배이고, fast는 사용량을 2.5배 쓴다.
  - `codex exec review --base main`은 지시문과 같이 쓸 수 없어 우리 기준(정확성만)으로 좁히지 못한다. 그래서 `codex exec`를 쓴다.
- **결과 처리.** 진행 에이전트가 두 검토자의 지적을 합치고 같은 것은 하나로 센다. 파일과 줄, 그리고 실패하는 경우가 적힌 Critical/Important만 작업자에게 넘긴다. 나머지는 진행 기록에 남긴다.
- **사용량.** 회사 ChatGPT 요금제의 Codex 사용량에서 빠지고, 공용 계정이라 다른 사람의 사용과 합쳐질 수 있다. 호출마다 `--json` 출력의 `turn.completed.usage`(토큰 수)를 진행 기록에 적는다.
- **쓸 수 없을 때.** Codex가 없거나 한도에 닿았으면 `deep-reviewer`만으로 검토하고 진행 기록에 그렇다고 적는다.
- Codex도 `AGENTS.md`를 읽는다(합쳐서 32KiB까지). 그래서 `AGENTS.md`에는 도구와 상관없는 저장소 규칙만 두고, Claude Code에만 해당하는 것은 `CLAUDE.md`와 `.claude/`에 둔다.

## 확장 수단

어디에 둘지는 공식 기준을 따른다([features-overview](https://code.claude.com/docs/en/features-overview)). 매번 반드시 지켜야 하는 것은 설정과 훅에 둔다. 늘 알아야 하는 것은 `AGENTS.md`에 둔다. 가끔 쓰는 절차는 스킬, 격리가 필요한 일은 하위 에이전트다. 지시문은 부탁일 뿐 보장이 아니다("a request, not a guarantee").

### 저장소에 두는 것(팀이 함께 씀)

| 파일 | 내용 |
|---|---|
| `.claude/settings.json` | `model: claude-opus-5-5`, `effortLevel: high`, `worktree.baseRef: head`, `env`(`CLAUDE_CODE_AUTO_COMPACT_WINDOW=400000`, `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS=4`), `permissions.deny`(`Read(./.env)`, `Read(./.env.*)`, `.env.example`는 허용), `enabledPlugins`(superpowers 끔) |
| `.claude/agents/*.md` | 위 '역할' 표의 여섯 개. 머리말에 `name`, `description`, `model`, `effort`, `tools`. 작업자와 검토자는 실제 DB 명령(`db:migrate`, `test-data`, `pg-smoke`)을 막는다. `disallowedTools`의 `Bash(…)` 패턴으로 막고, 안 되면 머리말 `hooks`의 PreToolUse로 막는다. 적용할 때 시험으로 확인한다 |
| `CLAUDE.md` | `@AGENTS.md` 아래에 `# Compact instructions`. 지금 기능 번호와 조각 번호, 명세와 진행 기록 경로, 고친 파일 목록, 실패 중인 시험과 그 명령, 아직 적용하지 않은 `Ruling:`을 남긴다 |
| `.gitignore` | `.claude/worktrees/`, `.claude/settings.local.json` |
| `tools/codex-review.sh`, `tools/codex-review-schema.json` | 위 'Codex' |

- `.env` 읽기 금지는 지금 전역 설정에만 있어서 팀원에게는 걸리지 않는다. 저장소 설정으로 옮긴다.
- 개인 설정은 `.claude/settings.local.json`(git 밖)과 전역 설정에 둔다. 저장소 설정이 전역 설정을 이긴다.
- 사용자 정의 에이전트 설명은 합쳐서 15,000 토큰 안이다. 넘으면 시작할 때 경고가 나온다.
- 환경 변수 `CLAUDE_CODE_EFFORT_LEVEL`이 있으면 머리말 effort를 무시한다. 이 변수를 두지 않는다.

### 플러그인

- 이 저장소에서는 superpowers를 끈다. superpowers의 계획 쓰기와 하위 에이전트 실행 스킬은 계획에 코드를 다 적고 작업마다 검토하라고 한다. 이것은 `docs/work-method.md` 원칙 2(계획에 코드를 적지 않는다)와 원칙 3(검토는 한 번)에 맞지 않는다. 기능 2에서 고친 항목의 약 95%가 코드가 적힌 계획에서 나왔다. 또 켜진 플러그인은 모든 세션의 문맥에 들어간다([plugins](https://code.claude.com/docs/en/plugins/overview)). 끄는 것은 설정 한 줄이라 되돌리기 쉽다.
- 다른 전역 플러그인은 이 저장소의 일이 아니다. 개인 전역 설정에서 정한다.

### 훅

- 지금 이 컴퓨터의 전역 Stop 훅(품질 게이트)은 응답이 끝날 때마다 돈다. 기능 2에서 60번, 모두 15분이 걸렸다. 문서상 Stop 훅은 횟수를 줄일 설정이 없고, 스크립트 안에서 일찍 끝내는 것만 된다([hooks-guide](https://code.claude.com/docs/en/hooks-guide#limitations)). 저장소에는 같은 검사가 이미 있다(커밋 전 `npm run check`, 전체 시험은 CI). 그래서 저장소에는 Stop 훅을 두지 않는다. 전역 훅을 고치는 일은 개인 전역 설정(`~/agent-config`)에서 따로 한다.

### 스킬 후보

지금 만들지 않는다. 같은 절차를 세 번째로 지시에 붙여 넣게 되면 `.claude/skills/`에 만든다.

- 조각 올리기: fast-forward 합치기 → CI 기다리기 → 배포 감시 → 배포 뒤 확인. 절차의 원본은 `docs/work-method.md`이고, 스킬은 그 절차를 부르는 안내만 담는다.

## 재는 것

`docs/work-method.md` '재는 것'의 시간 지표에 아래를 더한다. 따로 적지 않고, 기능을 닫을 때 `clerk`가 대화 기록(`~/.claude/projects/…/*.jsonl`)과 진행 기록에서 뽑는다.

| 지표 | 보는 것 |
|---|---|
| 역할별 토큰 | 진행, 작업자, 검토자, Codex가 각각 쓴 입력·출력 토큰 |
| 진행 세션 문맥 | 호출마다 평균 문맥 크기(기능 2: 약 49만) |
| 다시 한 비율 | 작업자 모델별로 나눠 본다(기능 2: 34%) |
| Codex 단독 지적 | Codex만 낸 지적 가운데 작업자가 실제로 고친 수 |

## 다시 볼 때

- R01의 처음 세 조각에서 Sonnet 작업자의 다시 한 비율이 34%보다 높으면 작업자를 `claude-opus-5-5` medium으로 바꾼다.
- 400K 압축을 두고도 진행 세션의 평균 문맥이 30만을 넘으면, 하위 에이전트의 결과 길이부터 줄인다.
- 깊은 검토 다섯 조각에서 Codex만 낸 지적 가운데 고친 것이 0이면 Codex 검토를 멈춘다. 많으면 보통 검토로 넓힐지 본다.
- 에이전트 팀이 실험 기능에서 벗어나거나, 팀원 여럿이 한 기능을 나눠 만들게 되면 '나란히 하기'를 다시 본다.
- Claude Code나 Codex의 새 모델이 나오면 공식 권고 effort부터 다시 시작한다(같은 이름의 effort도 모델마다 값이 다르다).

## 적용

1. **사람, 세션 사이에:** `claude update`로 Claude Code를 2.1.296 이상으로 올린다(Haiku 5.5, 호출마다 effort, 머리말 `autoCompactWindow`, 유휴 압축). 함께 일할 팀원도 같은 버전 이상을 쓴다.
2. 저장소 설정을 한 커밋으로 넣는다: `.claude/settings.json`, `.claude/agents/` 여섯 개, `CLAUDE.md`의 Compact instructions, `.gitignore`. `AGENTS.md` '기능 만들기'에 이 문서를 가리키는 줄을 더한다. `docs/work-method.md` '진행 에이전트'의 노력값 줄을 이 문서를 가리키는 줄로 바꾼다. 이 문서 머리의 상태를 '적용됨'으로 고친다.
3. 확인한다. 새 세션에서 `/agents`에 여섯 개가 보이는지 본다. 작업자와 검토자가 DB 명령을 못 돌리는지 본다. `.env` 읽기가 막히는지 본다.
4. `tools/codex-review.sh`와 스키마를 만든다. 지난 조각 하나(기능 2의 가지 범위)로 처음 돌려 네 가지를 본다. 돌린 뒤 `git status`가 그대로인지(읽기 전용), 결과 JSON이 스키마대로인지, 토큰 수가 나오는지, 지적이 정확성에만 머무는지다.
5. R01을 이 방법으로 시작하고, 처음 세 조각에서 '재는 것'을 뽑아 '다시 볼 때'에 대어 본다.
