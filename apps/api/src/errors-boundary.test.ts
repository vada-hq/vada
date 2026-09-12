import { expect, it, vi } from 'vitest'

it('회의·구매 업무 규칙은 HTTP 라우팅 없이 값을 검증한다', async () => {
  // 다른 검사에서 불러온 모듈이 의존 관계를 가리지 않게 새로 읽는다.
  vi.resetModules()
  vi.doMock('./routes.ts', () => {
    throw new Error('업무 규칙이 HTTP 라우팅을 불러왔습니다')
  })

  try {
    const { readWord } = await import('./meetings/fields.ts')
    const { objectOf } = await import('./purchases/body.ts')
    const { cancellableStage } = await import('./meetings/manage.ts')

    expect(readWord({ reason: ' 일정 변경 ' }, 'reason', '취소 사유')).toBe('일정 변경')
    expect(() => readWord({ reason: 1 }, 'reason', '취소 사유')).toThrow(
      '취소 사유 칸은 글로 적어 주세요',
    )
    expect(objectOf({ title: '구매 요청' }, '구매 요청')).toEqual({ title: '구매 요청' })
    expect(() => objectOf([], '구매 요청')).toThrow('구매 요청의 모양이 아닙니다')
    expect(cancellableStage('scheduled')).toBe(true)
    expect(cancellableStage('cancelled')).toBe(false)
  } finally {
    // API 검사는 프로세스를 공유하므로 다음 파일에 모의 모듈을 남기지 않는다.
    vi.doUnmock('./routes.ts')
    vi.resetModules()
  }
})
