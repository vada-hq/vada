// packages/contracts/src/button-execution.mjs의 타입 선언.
// 판정 의미론은 재구현하지 않고 계약 모듈을 직접 import한다(vada-conventions 8번).
declare module '*button-execution.mjs' {
  export interface ButtonExecutionResult {
    allowed: boolean
    applicableFieldKeys: string[]
    missingFieldKeys: string[]
    onExecutionBlocked: { type: string; focus: string } | null
  }

  export function evaluateButtonExecution(input: {
    action: unknown
    elements: unknown[]
    values: Record<string, unknown>
  }): ButtonExecutionResult

  export function getRequiredFieldCandidates(elements: unknown[]): Array<{
    fieldKey: string
    label: string
    enabledWhen: Array<{ fieldKey: string; operator: string }>
  }>

  export function hasFieldValue(value: unknown): boolean
}
