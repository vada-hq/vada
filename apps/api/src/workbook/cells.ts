import type { Cell, Row } from 'write-excel-file/node'

// 행사 정산서와 결산서가 같이 쓰는 칸 도움 함수.
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// 사용자가 쓴 글은 모두 문자 칸이다. "="로 시작해도 수식으로 읽히지 않는다.
export const text = (value: string): Cell => ({ value, type: String })
export const bold = (value: string): Cell => ({ value, type: String, fontWeight: 'bold' })
export const money = (value: number, strong = false): Cell => ({ value, type: Number, format: '#,##0', ...(strong ? { fontWeight: 'bold' as const } : {}) })
export const count = (value: number): Cell => ({ value, type: Number })
export const rate = (value: number): Cell => ({ value, type: Number, format: '0.0%' })
// 날짜 칸. 날짜를 UTC 자정으로 두어 일련번호가 정수가 되게 한다.
export const day = (value: string): Cell => ({ value: new Date(`${value}T00:00:00.000Z`), type: Date, format: 'yyyy-mm-dd' })
// 수식 안 문자열은 255자까지다. 넘으면 링크를 빼고 표시만 남긴다. 주소는 서버가 만든 것만 넣는다.
export const link = (url: string): Cell => url.length <= 255 && !url.includes('"') ? { value: `HYPERLINK("${url}","열기")`, type: 'Formula' } : text('—')
export const header = (labels: string[]): Row => labels.map(bold)
// 2026-10-09 18:40 (한국 시간)
export const koreanTime = (value: Date) => value.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)

// 파일 이름. 윈도에서 쓸 수 없는 글자는 _로 바꾸고 한국 날짜를 붙인다. 예: "체육대회 정산 2026-10-10.xlsx"
export function workbookFileName(name: string, fallback: string, label: string, exportedAt: Date) {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || fallback
  return `${clean} ${label} ${exportedAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.xlsx`
}
// 내려받기 머리글. 한글 이름은 RFC 5987로 싣고, encodeURIComponent가 남기는 ' ( ) * 도 바꾼다.
export function contentDisposition(fileName: string) {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encoded}`
}
