// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { downloadFile, downloadName } from './download'

afterEach(() => {
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
