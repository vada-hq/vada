import { strFromU8, unzipSync } from 'fflate'

// 테스트용 xlsx 읽기. 시트를 [행][열] 글자 표로 돌려준다.
// 문자 칸은 글, 숫자·날짜 칸은 저장된 값, 수식 칸은 "formula:수식", 빈 칸은 ''다. 열은 A~Z까지만 읽는다.
export function readBook(file: Buffer) {
  const files = unzipSync(new Uint8Array(file))
  const xml = (path: string) => strFromU8(files[path]!)
  const unescape = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const attribute = (element: string, name: string) => element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
  const strings = [...xml('xl/sharedStrings.xml').matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)].map(match => unescape(match[1]!))
  const targets = new Map([...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(([element]) => [attribute(element, 'Id')!, attribute(element, 'Target')!]))
  const sheets = [...xml('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)].map(([element]) => {
    const target = targets.get(attribute(element, 'r:id')!)!
    return { name: unescape(attribute(element, 'name')!), path: target.startsWith('/') ? target.slice(1) : `xl/${target}` }
  })
  function rows(index: number) {
    const table: string[][] = []
    for (const [, column, row, attributes, inner = ''] of xml(sheets[index]!.path).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const formula = inner.match(/<f>([\s\S]*?)<\/f>/)?.[1]
      const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      const cell = formula !== undefined ? `formula:${unescape(formula)}` : value === undefined ? '' : /\st="s"/.test(attributes!) ? strings[Number(value)]! : value
      ;(table[Number(row) - 1] ??= [])[column!.charCodeAt(0) - 65] = cell
    }
    return Array.from(table, cells => Array.from(cells ?? [], cell => cell ?? ''))
  }
  // 칸마다 붙은 서식 번호(s="…")를 서식 문자열로 바꿔 준다. 숫자 서식을 확인할 때 쓴다.
  function formatOf(index: number, address: string) {
    const styles = xml('xl/styles.xml')
    const formats = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map(match => [match[1]!, unescape(match[2]!)]))
    const xfs = [...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '').matchAll(/<xf\b[^>]*>/g)].map(([element]) => attribute(element, 'numFmtId'))
    const cell = xml(sheets[index]!.path).match(new RegExp(`<c r="${address}"([^>]*?)(?:/>|>)`))?.[1] ?? ''
    const style = attribute(cell, 's')
    const id = style === undefined ? undefined : xfs[Number(style)]
    return id === undefined ? undefined : formats.get(id) ?? id
  }
  return { names: sheets.map(sheet => sheet.name), rows, formatOf }
}
