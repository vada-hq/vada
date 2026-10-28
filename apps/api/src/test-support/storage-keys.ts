// 업로드가 만드는 네 구간을 유지해 정리 시험도 실제 키 검사와 같은 경계를 거친다.
export const storageKey = (area = 'chat', id = 1) =>
  `${area}/00000000-0000-7000-8000-000000000001/00000000-0000-7000-8000-000000000002/00000000-0000-4000-8000-${String(id).padStart(12, '0')}`

const key = storageKey()
export const invalidStorageKeys = [
  'chat/../evidence/B/x',
  key.replace('chat/', 'chat/../'),
  key.replace('chat/', 'chat/./'),
  key.replace('chat/', 'chat//'),
  key.replace('chat/', 'chat\\'),
  key.replace('chat/', 'chat/%2e%2e/'),
  key.replace('chat/', 'chat/%2F'),
  key.replace('chat/', 'chat/%2f'),
  key.replace('chat/', 'chat/%5C'),
  key.replace('chat/', 'chat/%252f'),
  key.replace('chat/', 'chat/\u0000'),
  key.replace('chat/', 'chat/\n'),
  key.replace('chat/', 'chat/\r'),
  key.replace('chat/', 'chat/\t'),
  key.replace('chat/', 'chat/\u007f'),
  key.replace('chat/', 'receipts/'),
  key.replace('chat/', 'chatty/'),
  key.replace('chat/', '/chat/'),
  `${key}/`,
  `${key}?x`,
  `${key}#x`,
  `${key}\n`,
  `${key}\r\n`,
  `${key}\u0085`,
  `${key}\ud800`,
  key.slice(0, -1),
  '',
]
