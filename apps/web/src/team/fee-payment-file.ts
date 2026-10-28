import { FEE_PAYMENT_BATCH_MAX, FEE_PAYMENT_TEXT_MAX, STUDENT_ID_PATTERN } from '@vada/contracts'

const UTF8_BYTES_PER_CHARACTER = 4
const FEE_PAYMENT_FILE_MAX = FEE_PAYMENT_TEXT_MAX * UTF8_BYTES_PER_CHARACTER
export const FEE_PAYMENT_FILE_ERROR = '학번 열이 있는 UTF-8 CSV·TSV 파일을 골라 주세요.'

// 따옴표 안의 쉼표·줄바꿈은 이름이나 메모에도 들어간다. 열을 먼저 나눠 학번 열만 남긴다.
function rowsOf(text: string) {
  const tab = text.split(/\r?\n/, 1)[0]!.includes('\t')
  const separator = tab ? '\t' : ','
  const cells = tab
    ? /("(?:[^"]|"")*"|[^"\t\r\n]*)(\t|\r\n|\r|\n|$)/gy
    : /("(?:[^"]|"")*"|[^",\r\n]*)(,|\r\n|\r|\n|$)/gy
  const rows: string[][] = []
  let row: string[] = []
  let cursor = 0
  while (cursor < text.length) {
    cells.lastIndex = cursor
    const match = cells.exec(text)
    if (!match || !match[0].length) throw new Error(FEE_PAYMENT_FILE_ERROR)
    const raw = match[1]!
    row.push(raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw)
    cursor = cells.lastIndex
    if (match[2] !== separator) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push(row)
  return rows.filter(values => values.some(value => value.trim()))
}

export function studentsFromFile(text: string) {
  const [header = [], ...rows] = rowsOf(text.replace(/^\ufeff/, ''))
  const columns = header.flatMap((value, index) => (value.trim() === '학번' ? [index] : []))
  if (columns.length !== 1 || !rows.length || rows.length > FEE_PAYMENT_BATCH_MAX)
    throw new Error(FEE_PAYMENT_FILE_ERROR)
  const students = rows.map(row => row[columns[0]!]?.trim() ?? '')
  if (students.some(student => !STUDENT_ID_PATTERN.test(student)))
    throw new Error(FEE_PAYMENT_FILE_ERROR)
  return students.join('\n')
}

export const readFeePaymentFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > FEE_PAYMENT_FILE_MAX || !/\.(csv|tsv)$/i.test(file.name)) {
      reject(new Error(FEE_PAYMENT_FILE_ERROR))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(studentsFromFile(typeof reader.result === 'string' ? reader.result : ''))
      } catch {
        reject(new Error(FEE_PAYMENT_FILE_ERROR))
      }
    }
    reader.onerror = () => reject(new Error(FEE_PAYMENT_FILE_ERROR))
    reader.readAsText(file)
  })
