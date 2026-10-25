// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import Gallery from './Gallery'

// 부품 확인 화면 전체의 겉 모양(docs/features/r01-maintainability.md 조각 10). 대화상자를 연 모양은 Gallery.overlay.snapshot.test.tsx가
// 그 묶음만 그려 적는다(시험마다 전체를 그리면 시험 하나의 상한에 가까워진다).
afterEach(cleanup)

test('처음 모양', () => {
  render(<Gallery />)
  expect(snapshotHtml()).toMatchSnapshot()
})
