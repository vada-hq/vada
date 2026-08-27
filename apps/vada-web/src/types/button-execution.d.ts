// packages/contracts/src/button-execution.mjs의 타입 선언.
// 판정 의미론은 재구현하지 않고 계약 모듈을 직접 import한다(vada-conventions 8번).
declare module '*button-execution.mjs' {
  /**
   * 채워야 하는 칸 하나.
   *
   * inList·fromSet이 붙은 것은 **판정기가 스스로 답할 수 없는 것**이다 — 되풀이되는
   * 묶음 안의 칸은 항목마다 값이 있고, 칸 목록이 데이터에서 오는 묶음은 칸 이름조차
   * 그릴 때 알게 된다. 그 둘은 화면이 isFilled로 답한다.
   */
  export interface RequiredFieldCandidate {
    fieldKey: string
    label: string
    enabledWhen: Array<{ fieldKey: string; operator: string }>
    /** 되풀이되는 묶음 안이면 그 목록의 fieldKey. 아니면 null. */
    inList: string | null
    /** 칸 목록이 데이터에서 오는 묶음인가. */
    fromSet: boolean
  }

  export interface ButtonExecutionResult {
    allowed: boolean
    applicableFieldKeys: string[]
    missingFieldKeys: string[]
    /** sourceAllows로 막혔을 때 서버가 준 이유. */
    blockedNote?: string | null
    onExecutionBlocked: { type: string; focus?: string } | null
  }

  export function evaluateButtonExecution(input: {
    action: unknown
    elements: unknown[]
    values?: Record<string, unknown>
    /** 값이 찼는지를 화면이 답한다. 되풀이·데이터 칸에는 없으면 던진다. */
    isFilled?: (candidate: RequiredFieldCandidate) => boolean
    /** 서버가 막았으면 그 글. sourceAllows에는 없으면 던진다. */
    sourceBlockedNote?: string
  }): ButtonExecutionResult

  export function getRequiredFieldCandidates(
    elements: unknown[],
  ): RequiredFieldCandidate[]

  export function hasFieldValue(value: unknown): boolean
}
