import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'

// 이 파일은 dom 프로젝트(.tsx 테스트)에서만 돌므로 DOM이 항상 있다.
// 동적 import로 미루지 않는다 — setupFiles에서 await 뒤에 훅을 걸면
// vitest가 수집 문맥을 이미 닫아 간헐적으로 죽는다.

// globals: false에서는 testing-library의 자동 cleanup이 등록되지 않는다.
afterEach(() => {
  cleanup()
})

// jsdom에는 scrollIntoView가 없다.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// **기다림의 인내를 올린다.** testing-library의 `waitFor`는 1초가 기본인데, 진짜 저장소에
// 붙여 화면을 그리는 통합 검사가 열둘·백아흔 개로 늘면서 나란히 돌 때 첫 그림이 1초를
// 넘기는 일이 났다 — EVT-DOC-01(낮), EVT-00A·ORG-07A(밤, 다섯 번 중 셋). 단독으로는
// 늘 통과하므로 검사의 판정이 아니라 부하다. vitest의 testTimeout을 올린 것과 같은
// 처방이다: 지연을 줄이면 로딩 상태 단언이 불안정해지므로 인내값만 올린다.
configure({ asyncUtilTimeout: 5000 })
