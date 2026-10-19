// getByRole·getByLabelText는 HTMLElement를 돌려준다. 칸 종류를 `as` 단언 대신 확인으로 좁힌다.
// (`(요소 as HTMLButtonElement).disabled` 꼴은 린트가 불필요한 단언으로 잘못 보고하고, 지우면 타입 검사가 실패한다.)
export function asElement<T extends HTMLElement>(element: HTMLElement, type: new () => T): T {
  if (!(element instanceof type)) {
    throw new Error(`${type.name}이(가) 아니다: <${element.tagName.toLowerCase()}>`)
  }
  return element
}
