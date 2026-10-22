import { strFromU8, unzipSync } from 'fflate'

// 시험용 xlsx 읽기. 시트 이름 → 줄 → 칸(문자는 string, 수는 number, 빈 칸은 null)이다.
// 수식 칸이 하나라도 있으면 formulas가 0보다 커서, 문자 칸으로 들어갔는지 볼 수 있다.
type Value = string | number | null
type Sheets = Record<string, Value[][]>

const unescapeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const LETTERS = 26
const columnIndex = (letters: string) =>
  Array.from(letters).reduce((all, char) => all * LETTERS + char.charCodeAt(0) - 64, 0) - 1

function cellValue(attributes: string, inner: string, shared: string[]): Value {
  const value = /<v>(.*?)<\/v>/s.exec(inner)?.[1]
  const inline = /<t[^>]*>(.*?)<\/t>/s.exec(inner)?.[1]
  if (/t="s"/.test(attributes) && value !== undefined) return shared[Number(value)] ?? null
  if (inline !== undefined) return unescapeXml(inline)
  return value === undefined ? null : Number(value)
}

function rowsOf(xml: string, shared: string[]) {
  const rows: Value[][] = []
  for (const row of xml.matchAll(/<row [^>]*?r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    const cells: Value[] = []
    for (const cell of (row[2] ?? '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)>(.*?)<\/c>/gs))
      cells[columnIndex(cell[1] ?? 'A')] = cellValue(cell[2] ?? '', cell[3] ?? '', shared)
    rows[Number(row[1]) - 1] = Array.from(cells, cell => cell ?? null)
  }
  return Array.from(rows, row => row ?? [])
}

export function readXlsx(bytes: Uint8Array) {
  const files = unzipSync(bytes)
  const read = (name: string) => strFromU8(files[name] ?? new Uint8Array())
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs)].map(match =>
    unescapeXml([...(match[1] ?? '').matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(t => t[1]).join('')),
  )
  const names = [...read('xl/workbook.xml').matchAll(/<sheet [^>]*?name="([^"]*)"/g)].map(match =>
    unescapeXml(match[1] ?? ''),
  )
  const sheets: Sheets = {}
  let formulas = 0
  names.forEach((name, index) => {
    const xml = read(`xl/worksheets/sheet${index + 1}.xml`)
    formulas += (xml.match(/<f[ >]/g) ?? []).length
    sheets[name] = rowsOf(xml, shared)
  })
  return {
    sheets,
    formulas,
    text: Object.values(files)
      .map(file => strFromU8(file))
      .join('\n'),
  }
}
