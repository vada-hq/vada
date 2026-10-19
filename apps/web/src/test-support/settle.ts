import { act } from '@testing-library/react'

// "그 일이 일어나지 않았다"를 확인하기 전에, 이미 걸린 일이 모두 끝난 다음으로 넘어간다. 시간을 재서 기다리지 않는다.
// 1) React 작업(이펙트 정리 포함)을 먼저 끝내, 닫히는 부품(Radix)이 지연 작업(setTimeout 0)을 걸게 한다.
// 2) 같은 지연의 타이머는 건 순서대로 실행되므로, 그 뒤에 0ms 타이머를 걸고 기다리면 먼저 걸린 지연 작업이 끝난 뒤에 돌아온다.
//    프로미스 연결(네트워크 응답을 기다리던 await 등)도 다음 타이머 전에 모두 끝난다.
// 느린 CI에서도 같은 순서라 "아직 안 일어난 것"과 "일어나지 않은 것"이 헷갈리지 않는다.
export async function settle() {
  await act(async () => {})
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  })
}
