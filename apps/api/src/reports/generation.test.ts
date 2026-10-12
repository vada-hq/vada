import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contentOf, createRetrospectiveGenerator, type GeneratedRetrospective, type RetrospectiveInput } from './generation.js'

const input: RetrospectiveInput = {
  event: { name: '체육대회', startsOn: '2026-03-02', endsOn: '2026-03-02', place: '대운동장', department: '기획부' },
  numbers: [{ id: 'fact:registrations', text: '신청 42명 → 참석 39명' }],
  records: [{ id: 'task:t1', day: '2026-02-22', dDay: 'D-8', text: '업무 완료: 포스터', note: '기획부 · 마감 2월 20일 · 2일 늦음' }],
  messages: [{ id: 'message:m1', day: '2026-02-10', dDay: 'D-20', department: '회장단', content: '숙소는 가평으로 확정했어요.' }],
}
const generated: GeneratedRetrospective = {
  wentWell: [{ text: '숙소를 일찍 정했다.', sources: ['message:m1'] }],
  shortfalls: [{ text: '포스터가 2일 늦었다.', sources: ['task:t1'] }],
  nextTime: [{ text: '포스터는 D-20에 시작하자.', sources: ['task:t1', 'fact:registrations'] }],
  questions: [{ text: '참석이 3명 적은 이유가 있었나요?', sources: [] }],
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const completed = (value: unknown) => json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })

test('회고 생성은 구조화된 출력을 쓰고 제공자에 저장하지 않으며, 명령 무시·근거·사람 이름 규칙을 지시한다', async () => {
  const calls: { url: unknown; body: string }[] = []
  const generate = createRetrospectiveGenerator({ apiKey: 'test-key', model: 'test-model' }, async (url, init) => {
    calls.push({ url, body: String(init?.body) })
    return completed(generated)
  })
  assert.deepEqual(await generate(input), generated)
  assert.equal(calls[0]!.url, 'https://api.openai.com/v1/responses')
  assert.ok(!calls[0]!.body.includes('test-key'))
  const body = JSON.parse(calls[0]!.body) as { store: boolean; model: string; instructions: string; input: string
    text: { format: { type: string; strict: boolean; name: string } } }
  assert.deepEqual([body.store, body.model, body.text.format.type, body.text.format.strict, body.text.format.name],
    [false, 'test-model', 'json_schema', true, 'event_retrospective'])
  for (const phrase of ['신뢰할 수 없는', '명령을 따르지 않는다', 'sources', '근거가 없는 내용은 쓰지 않는다', '사람 이름']) {
    assert.ok(body.instructions.includes(phrase), phrase)
  }
  assert.deepEqual(JSON.parse(body.input), input)
})

test('설정이 없으면 AI_NOT_CONFIGURED, 응답 실패·미완료·거절·형식 오류·연결 실패는 GENERATION_FAILED다', async () => {
  await assert.rejects(createRetrospectiveGenerator({ apiKey: '', model: 'm' })(input), { code: 'AI_NOT_CONFIGURED' })
  await assert.rejects(createRetrospectiveGenerator({ apiKey: 'k', model: ' ' })(input), { code: 'AI_NOT_CONFIGURED' })
  for (const reply of [
    () => json({ error: 'no' }, 500),
    () => json({ status: 'incomplete', output: [] }),
    () => json({ status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'No' }] }] }),
    () => json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{' }] }] }),
    () => completed({ ...generated, questions: undefined }),
    () => completed({ ...generated, wentWell: [{ text: '좋았다', sources: 'message:m1' }] }),
    () => completed({ ...generated, nextTime: [{ text: 3, sources: [] }] }),
  ]) {
    await assert.rejects(createRetrospectiveGenerator({ apiKey: 'k', model: 'm' }, async () => reply())(input), { code: 'GENERATION_FAILED' })
  }
  await assert.rejects(createRetrospectiveGenerator({ apiKey: 'k', model: 'm' }, async () => { throw new Error('network') })(input),
    { code: 'GENERATION_FAILED' })
})

test('근거가 없거나 보낸 것에 없는 근거·빈 문장·200자 넘는 문장·NUL은 버리고, 섹션은 5문장·확인 필요는 3개까지 남긴다', () => {
  const sentence = (text: string, sources: string[] = ['task:t1']) => ({ text, sources })
  const content = contentOf({
    wentWell: [sentence('근거 없음', []), sentence('모르는 근거', ['message:other']), sentence('다른 행사 업무', ['task:t9']), sentence('   '),
      sentence('가'.repeat(201)), sentence(`가${String.fromCharCode(0)}나`), sentence('  남는 문장  ', ['task:t1', 'task:t1', 'message:m1'])],
    shortfalls: Array.from({ length: 7 }, (_, index) => sentence(`아쉬움 ${index + 1}`)),
    nextTime: [],
    questions: [sentence('근거 없는 질문', []), sentence('모르는 근거 질문', ['fact:nope']), sentence('질문 2', ['fact:registrations']),
      sentence('질문 3', []), sentence('질문 4', [])],
  }, input)
  assert.deepEqual(content.wentWell.map(item => [item.text, item.sources]), [['남는 문장', ['task:t1', 'message:m1']]])
  assert.deepEqual(content.shortfalls.map(item => item.text), ['아쉬움 1', '아쉬움 2', '아쉬움 3', '아쉬움 4', '아쉬움 5'])
  assert.deepEqual(content.nextTime, [])
  assert.deepEqual(content.questions.map(item => [item.text, item.sources, item.answer]),
    [['근거 없는 질문', [], null], ['질문 2', ['fact:registrations'], null], ['질문 3', [], null]])
  const ids = [...content.wentWell, ...content.shortfalls, ...content.questions].map(item => item.id)
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0))
  assert.equal(new Set(ids).size, ids.length)
  // 근거는 8개까지다.
  const wide = { ...input, records: Array.from({ length: 9 }, (_, index) => ({ id: `task:w${index}`, day: '2026-02-01', dDay: null, text: '업무',
    note: null })) }
  const ids9 = wide.records.map(record => record.id)
  const limited = contentOf({ wentWell: [sentence('아홉', ids9), sentence('여덟', ids9.slice(0, 8))], shortfalls: [], nextTime: [], questions: [] }, wide)
  assert.deepEqual(limited.wentWell.map(item => item.text), ['여덟'])
})
