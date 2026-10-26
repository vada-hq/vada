// 입력칸의 '/이름'(DEC-90, 와이어프레임 MSG-04): 첫 글자가 '/'면 보내지 않고 1:1 대화할 사람을 찾는다.
// 찾는 글은 '/' 뒤 첫 낱말이고, 그 뒤에 친 글은 연 1:1의 입력칸으로 옮긴다(보내지는 않는다).
export function slashQuery(body: string): { query: string; rest: string } | null {
  if (!body.startsWith('/')) return null
  const after = body.slice(1)
  const query = after.split(/\s/, 1)[0] ?? ''
  return { query, rest: after.slice(query.length).trim() }
}

type Person = { id: string; name: string }

// 나를 뺀, 찾는 글이 이름에 든 사람(부르기 '@'와 같은 거르기).
export const directMatches = <P extends Person>(people: P[], query: string, meId: string) =>
  people.filter(person => person.id !== meId && person.name.includes(query))
