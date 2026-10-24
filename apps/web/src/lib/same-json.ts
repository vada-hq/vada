// 서버가 준 JSON 값 둘이 같은가. 다시 읽은 값이 같으면 지금 값을 그대로 두어 다시 그리지 않게 한다. 키 순서는 서버가 늘 같게 준다.
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
