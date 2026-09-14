/** 초안 목록에서 아직 쓰지 않은 첫 행 식별자를 만든다. */
export function nextDraftRowId(rowIds: readonly string[]): string {
  const used = new Set(rowIds)
  for (let index = 0; ; index += 1) {
    const candidate = `r${index}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}
