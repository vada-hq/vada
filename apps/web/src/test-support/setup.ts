import { configure } from '@testing-library/react'

// 파일을 병렬로 돌리면(npm test, CI) 첫 화면이 기본 대기 1초를 넘길 때가 있다. findBy·waitFor의 상한을 테스트 제한 시간 안에서 늘린다.
configure({ asyncUtilTimeout: 5_000 })
