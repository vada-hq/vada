import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_SCREENS } from './screens'
import type { ElementSpec, ScreenSpec } from './types'

// 화면이 자기 명세를 지키는가.
//
// 2026-08-27 감사에서 같은 모양의 결함이 셋 나왔다. 셋 다 **명세에는 적혀 있는데
// 화면이 그 줄을 아예 읽지 않는** 것이었고, 게이트 넷이 다 놓쳤다.
//
// · FIN-REQ-01이 executeWhen을 구현하지 않아 빈 칸으로도 제출됐다.
// · FIN-SUP-01·FIN-REV-01·FIN-EVID-01이 mutation을 실행하지 않고 '저장하는 중'
//   이라고 **써 놓기만 한 뒤** 성공 화면으로 갔다.
// · FIN-REQ-01·FIN-SUP-01·FIN-REV-01·ONB-02가 stateScopeKey를 선언해 놓고
//   화면 안의 useState만 썼다 - 떠났다 오면 쓰던 것이 사라졌다.
//
// 왜 넷이 다 놓쳤는가. 계약 검사는 판정기를 **따로** 시험하고, 준수 검사는 글자만
// 보고, 대조기는 누르지 않고, e2e는 사람이 적은 것만 본다. **명세의 한 줄과
// 화면의 한 줄을 짝지어 보는 자리가 없었다.**
//
// 이 검사는 그 자리다. 다만 하는 일은 거칠다 - 화면을 그려 보는 것이 아니라
// **원문에 그 배선이 있는지**를 본다. 있는데 틀리게 쓴 것은 못 잡는다. 그래도
// 위의 셋은 전부 '아예 없음'이었고, 없는 것은 이것으로 잡힌다.

const SRC = join(__dirname, '..')

// FIN-REQ-01 -> FINREQ01Screen.tsx
function componentFileOf(screenId: string): string {
  return join(SRC, 'screens', `${screenId.replace(/-/g, '')}Screen.tsx`)
}

function sourceOf(screenId: string): string {
  return readFileSync(componentFileOf(screenId), 'utf8')
}

const ROUTER = readFileSync(join(SRC, 'screens', 'ScreenRouter.tsx'), 'utf8')

/** 최상위 요소와 되풀이되는 묶음 안의 요소를 모두 훑는다(계약의 element-walk와 같은 규칙). */
function allSpecsOf(screen: ScreenSpec): ElementSpec[] {
  const out: ElementSpec[] = []
  for (const element of screen.elements) {
    out.push(element.spec)
    const nested = (element.spec as { itemFields?: { spec: ElementSpec }[] }).itemFields
    if (Array.isArray(nested)) {
      for (const child of nested) out.push(child.spec)
    }
  }
  return out
}

function actionsOf(spec: ElementSpec): { type: string }[] {
  const candidate = spec as {
    action?: { type: string }
    itemAction?: { type: string }
    selection?: { action: { type: string } }
  }
  return [candidate.action, candidate.itemAction, candidate.selection?.action].filter(
    (action): action is { type: string } => action !== undefined,
  )
}

describe('화면이 자기 명세를 지킨다', () => {
  // 명세가 submit이라고 말한 버튼이 있으면 화면은 **보내야 한다.** 보내는 방법은
  // 하나뿐이다(useSubmitAction) - 화면마다 손으로 옮겨 적던 시절에 두 곳은 옳게,
  // 세 곳은 틀리게 적혔기 때문이다.
  const submitting = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) => actionsOf(spec).some((action) => action.type === 'submit')),
  )

  it.each(submitting.map((screen) => screen.screenId))(
    '%s: submit이라고 말했으면 실제로 보낸다',
    (screenId) => {
      expect(sourceOf(screenId)).toContain('useSubmitAction')
    },
  )

  // stateScopeKey를 선언한 화면의 초안은 **그 스코프에 산다.** 화면 안의
  // useState에 담으면 떠났다 오는 순간 사라지고, 명세가 말한 flow 수명이
  // 거짓이 된다. 스코프를 잇는 것은 라우터의 일이므로 라우터에서 확인한다.
  const scoped = ALL_SCREENS.filter((screen) => screen.stateScopeKey !== undefined)

  it.each(scoped.map((screen) => screen.screenId))(
    '%s: 상태 스코프를 선언했으면 라우터가 그 초안을 넘긴다',
    (screenId) => {
      const component = `${screenId.replace(/-/g, '')}Screen`
      const usage = ROUTER.slice(ROUTER.indexOf(`<${component}`))
      const element = usage.slice(0, usage.indexOf('/>') + 2)
      expect(element).toContain('draft=')
      expect(element).toContain('onChangeDraft=')
    },
  )

  // 명세가 onSuccess.scopeEvent를 말하면 보낸 뒤 그 스코프를 **비워야 한다.**
  // 비우는 것은 화면 밖의 일이므로 라우터가 손잡이를 줘야 하고, 화면은 그것을
  // 갈고리에 넘겨야 한다. 재정 셋은 명세에 scopeEvent가 있는데 그 배선이 아예
  // 없었다 - 보내고도 쓰던 것이 그대로 남았을 자리다.
  const clearing = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) =>
      actionsOf(spec).some(
        (action) =>
          action.type === 'submit' &&
          (action as { onSuccess?: { scopeEvent?: string } }).onSuccess?.scopeEvent !== undefined,
      ),
    ),
  )

  it.each(clearing.map((screen) => screen.screenId))(
    '%s: 성공하면 스코프를 비운다고 말했으면 그 손잡이를 받는다',
    (screenId) => {
      const component = `${screenId.replace(/-/g, '')}Screen`
      const usage = ROUTER.slice(ROUTER.indexOf(`<${component}`))
      expect(usage.slice(0, usage.indexOf('/>') + 2)).toContain('onScopeEvent=')
      expect(sourceOf(screenId)).toContain('onScopeEvent')
    },
  )

  // 명세가 navigate라고 말한 자리는 화면이 **실제로 데려가야 한다.**
  //
  // 이것을 세 번 놓쳤다. pending이던 버튼을 실제 화면으로 이으면서 명세만 고치고
  // 화면의 `if (action.type === 'pending')`은 그대로 두는 것이다 - 누르면 아무
  // 일도 일어나지 않고, 게이트 중 e2e만 그것을 본다(그마저 시나리오를 적었을 때만).
  //
  // 여기서 보는 것은 거칠다: 그 화면의 원문이 대상 화면을 집어내는가. 직접
  // targetScreenId를 읽거나 공용 도우미(navigateTarget)를 쓰거나 둘 중 하나다.
  // pending만 다루는 화면은 어느 쪽도 없으므로 잡힌다.
  const navigating = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) =>
      actionsOf(spec).some((action) => action.type === 'navigate'),
    ),
  )

  it.each(navigating.map((screen) => screen.screenId))(
    '%s: navigate라고 말했으면 그리로 데려간다',
    (screenId) => {
      // targetScreenOf도 센다. 줄마다 가는 곳이 다른 목록이 생기면서 화면이
      // 이름을 직접 읽지 않고 그 함수를 거친다 - 갈래가 없으면 그 하나를
      // 그대로 돌려주므로 부르는 쪽은 갈래를 아는지 모르는지 신경 쓰지 않는다.
      expect(sourceOf(screenId)).toMatch(/targetScreenId|navigateTarget|targetScreenOf/)
    },
  )

  // 보내고 이동하면서 넘기는 인자. **화면이 손으로 적으면 안 된다** — 명세만
  // 읽고 화면을 만드는 사람은 그 인자를 넘겨야 한다는 사실을 알 수 없다.
  // 실제로 다섯 자리가 그렇게 살고 있었다(FIN-EVID-01·REV-01·SUP-01·REQ-01).
  const carrying = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) =>
      actionsOf(spec).some(
        (action) =>
          action.type === 'submit' &&
          (action as { onSuccess?: { params?: unknown } }).onSuccess?.params !== undefined,
      ),
    ),
  )

  it.each(carrying.map((screen) => screen.screenId))(
    '%s: 보내고 넘길 인자를 명세에서 읽는다',
    (screenId) => {
      const source = sourceOf(screenId)
      expect(source).toMatch(/paramSources/)
      // 손으로 적던 옛 자리가 남아 있으면 두 곳이 갈린다.
      expect(source).not.toMatch(/navigateParams/)
    },
  )

  // onSuccess.note도 '아직 정해지지 않았다'를 말한다 — 다만 누르기 전이 아니라
  // **보내고 난 뒤**의 자리다. 적어만 두고 아무도 안 보여주면 명세에만 있는
  // 사실이 되고, 사람은 보내고 나서 아무 일도 안 일어나는 것을 본다.
  const successPending = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) =>
      actionsOf(spec).some(
        (action) =>
          action.type === 'submit' &&
          (action as { onSuccess?: { note?: string } }).onSuccess?.note !== undefined,
      ),
    ),
  )

  it.each(successPending.map((screen) => screen.screenId))(
    '%s: 보낸 뒤가 아직 정해지지 않았다면 그 글을 내놓는다',
    (screenId) => {
      expect(sourceOf(screenId)).toMatch(/pendingNote/)
    },
  )

  // pending은 '아직 정해지지 않았다'를 말한다. 그 글을 화면이 어딘가로 내보내지
  // 않으면 누르는 사람은 고장 난 버튼을 본다. 어떻게 내보내는지는 화면이 정한다
  // (귀띔 글이든 알림 줄이든) - 여기서 보는 것은 **읽기는 하는가**뿐이다.
  const pending = ALL_SCREENS.filter((screen) =>
    allSpecsOf(screen).some((spec) => actionsOf(spec).some((action) => action.type === 'pending')),
  )

  it.each(pending.map((screen) => screen.screenId))(
    '%s: pending이라고 말했으면 그 글을 화면이 읽는다',
    (screenId) => {
      expect(sourceOf(screenId)).toMatch(/\.note\b/)
    },
  )
})
