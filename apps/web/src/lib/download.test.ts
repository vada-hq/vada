// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { setTermsRequiredHandler } from './api'
import { downloadFile, downloadName, saveByFrame } from './download'

afterEach(() => {
  document.querySelectorAll('iframe').forEach(frame => frame.remove())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('내려받은 파일 이름은 filename*에서 꺼내고, 없거나 깨졌으면 기본 이름이다', () => {
  expect(
    downloadName(
      `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent('체육대회 정산 2026-10-09.xlsx')}`,
      '정산.xlsx',
    ),
  ).toBe('체육대회 정산 2026-10-09.xlsx')
  expect(downloadName("attachment; filename*=UTF-8''%28%27%29.xlsx", '정산.xlsx')).toBe(
    "(')" + '.xlsx',
  )
  expect(downloadName(null, '결산.xlsx')).toBe('결산.xlsx')
  expect(downloadName("attachment; filename*=UTF-8''%E0%A4%A.xlsx", '결산.xlsx')).toBe('결산.xlsx')
})

test('파일을 받으면 서버가 준 이름으로 내려받고, 실패하면 서버 오류 코드를 돌려준다', async () => {
  const name = '2026년 2학기 결산 2026-10-10.xlsx'
  // jsdom의 Blob은 Node Response 본문으로 읽히지 않아 문자열로 준다.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('xlsx', {
          headers: {
            'Content-Disposition': `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
          },
        }),
    ),
  )
  // jsdom에는 파일 주소 만들기가 없다.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:report'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
  const clicks: { download: string; href: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({ download: this.download, href: this.getAttribute('href') ?? '' })
  })
  expect(await downloadFile('/api/report', '결산.xlsx')).toEqual({ ok: true })
  expect(clicks).toEqual([{ download: name, href: 'blob:report' }])
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: 'EXPORT_TOO_LARGE' }), { status: 409 })),
  )
  expect(await downloadFile('/api/report', '결산.xlsx')).toEqual({
    ok: false,
    code: 'EXPORT_TOO_LARGE',
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline')
    }),
  )
  expect(await downloadFile('/api/report', '결산.xlsx')).toEqual({ ok: false, code: null })
})

test('내려받기가 403 TERMS_REQUIRED로 막히면 동의 화면 처리기에 알린다', async () => {
  const handler = vi.fn()
  setTermsRequiredHandler(handler)
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 })),
    )
    await downloadFile('/api/report', '결산.xlsx')
    expect(handler).not.toHaveBeenCalled()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'TERMS_REQUIRED' }), { status: 403 })),
    )
    expect(await downloadFile('/api/report', '결산.xlsx')).toEqual({
      ok: false,
      code: 'TERMS_REQUIRED',
    })
    expect(handler).toHaveBeenCalledOnce()
  } finally {
    setTermsRequiredHandler(null)
  }
})

// 서버가 문서로 답해 iframe에 뜬 모습. 주소를 실제로 받지는 않으므로 본문을 직접 쓴다.
function showIn(frame: HTMLIFrameElement, text: string) {
  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<body>${text}</body>`)
  doc.close()
}

test('묶음 iframe에 JSON 오류 문서가 뜨면 오류 코드를 돌려주고 iframe을 지운다', async () => {
  const result = saveByFrame('/api/x/audit.zip')
  const frame = document.querySelector('iframe')!
  expect(frame.hidden).toBe(true)
  expect(frame.getAttribute('src')).toBe('/api/x/audit.zip')
  showIn(frame, JSON.stringify({ error: 'EXPORT_TOO_LARGE' }))
  frame.dispatchEvent(new Event('load'))
  expect(await result).toEqual({ ok: false, code: 'EXPORT_TOO_LARGE' })
  expect(document.querySelector('iframe')).toBeNull()
})

test('묶음 iframe에 JSON이 아닌 문서가 뜨면 코드 없이 실패한다', async () => {
  const result = saveByFrame('/api/x/audit.zip')
  const frame = document.querySelector('iframe')!
  showIn(frame, 'not json')
  frame.dispatchEvent(new Event('load'))
  expect(await result).toEqual({ ok: false, code: null })
})

test('묶음 iframe에 문서가 뜨지 않으면(첨부) 기다린 뒤 성공으로 보고 iframe을 지운다', async () => {
  vi.useFakeTimers()
  try {
    const result = saveByFrame('/api/x/audit.zip')
    expect(document.querySelector('iframe')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await result).toEqual({ ok: true })
    expect(document.querySelector('iframe')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})
