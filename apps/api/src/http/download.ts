// 내려받기 응답 머리글(RFC 6266). 한글 이름은 filename*로 주고, 못 읽는 프로그램을 위해 ASCII 이름도 같이 둔다.
// 개인정보가 든 파일이라 어디에도 저장되지 않게 no-store다.

// 윈도 파일 이름에 못 쓰는 글자와 제어 문자는 _로 바꾼다. 끝의 점과 공백도 윈도가 떼어 내므로 바꾼다.
// oxlint-disable-next-line no-control-regex -- 파일 이름에 못 쓰는 제어 문자를 걸러 내려고 일부러 쓴다
const FORBIDDEN_IN_NAME = /[<>:"/\\|?*\u0000-\u001f\u007f]/g
const HEX = 16
const TRAILING = /[. ]+$/

export function safeFileName(name: string): string {
  const cleaned = name.replace(FORBIDDEN_IN_NAME, '_').replace(TRAILING, '_')
  return cleaned === '' ? '_' : cleaned
}

// attr-char가 아닌 글자(' ( ) *)는 encodeURIComponent가 두므로 따로 퍼센트로 쓴다.
const encodeValue = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*]/g,
    char => `%${char.charCodeAt(0).toString(HEX).toUpperCase()}`,
  )

const asciiFallback = (name: string) => name.replace(/[^\x20-\x7e]|["\\%]/g, '_')

export function attachmentHeaders(fileName: string, contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${encodeValue(fileName)}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
}
