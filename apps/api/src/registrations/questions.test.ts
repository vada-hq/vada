import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHOICE_LABEL_MAX,
  FORM_QUESTION_MAX,
  QUESTION_CHOICE_MAX,
  QUESTION_TITLE_MAX,
  type RegistrationForm,
} from '@vada/contracts'
import { MAX_BODY_BYTES } from '../http/guard.js'
import { answersOf, QUESTIONS } from '../test-support/questions.js'
import {
  FORM,
  MISSING,
  withRegistrations,
  type RegistrationKit,
} from '../test-support/registrations.js'

const shapeOf = (form: RegistrationForm) =>
  form.questions.map(question => [
    question.kind,
    question.title,
    question.required,
    question.choices.map(choice => choice.label),
  ])
const update = (
  t: RegistrationKit,
  form: RegistrationForm,
  body: Record<string, unknown>,
  user?: string,
) =>
  t.post(
    `/registration-forms/${form.id}`,
    {
      ...FORM,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      capacity: form.capacity,
      notice: form.notice,
      collectsStudentId: form.collectsStudentId,
      payerFee: form.payerFee,
      nonPayerFee: form.nonPayerFee,
      feeAccountId: form.feeAccount?.id ?? null,
      ...body,
    },
    user,
  )

test(
  '양식을 만들 때 질문 셋을 차례대로 저장하고 선택지마다 번호가 있다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { status, form } = await t.created(event, { questions: QUESTIONS })
    assert.equal(status, 201)
    assert.deepEqual(shapeOf(form), [
      ['short_text', '이니셜', true, []],
      ['single_choice', '티셔츠 사이즈', true, ['S', 'M', 'L']],
      ['multiple_choice', '참가 종목', false, ['축구', '농구']],
    ])
    const ids = form.questions.flatMap(question => [
      question.id,
      ...question.choices.map(c => c.id),
    ])
    assert.equal(new Set(ids).size, 8)
    assert.deepEqual(shapeOf(await t.detail(form.id)), shapeOf(form))
    assert.deepEqual(shapeOf((await t.list(event)).forms[0]!), shapeOf(form))
    // 질문 없이 만들면 빈 목록이다.
    assert.deepEqual((await t.created(event)).form.questions, [])
  }),
)

test(
  '신청이 없으면 질문을 더하고 고치고 지운다. 같은 질문을 다시 보내면 번호가 그대로다',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const same = await update(t, form, { questions: QUESTIONS })
    assert.equal(same.status, 200)
    const kept = ((await same.json()) as { form: RegistrationForm }).form
    assert.deepEqual(kept.questions, form.questions)
    const changed = [
      { ...QUESTIONS[1]!, title: '티셔츠 크기', choices: [{ label: 'M' }, { label: 'XL' }] },
      { kind: 'short_text', title: '하고 싶은 말', required: false, choices: [] },
    ]
    const response = await update(t, form, { questions: changed })
    assert.equal(response.status, 200)
    const next = ((await response.json()) as { form: RegistrationForm }).form
    assert.deepEqual(shapeOf(next), [
      ['single_choice', '티셔츠 크기', true, ['M', 'XL']],
      ['short_text', '하고 싶은 말', false, []],
    ])
    // 질문을 빼면(키 없음) 그대로 두고, 빈 목록이면 모두 지운다.
    assert.deepEqual(shapeOf(await t.detail(form.id)), shapeOf(next))
    assert.equal((await update(t, form, {})).status, 200)
    assert.deepEqual(shapeOf(await t.detail(form.id)), shapeOf(next))
    assert.equal((await update(t, form, { questions: [] })).status, 200)
    assert.deepEqual((await t.detail(form.id)).questions, [])
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_question_choice'), 0)
  }),
)

// 운영진이 고치는 사이 신청 화면을 연 학생의 답은 화면이 질문 번호로 들고 있다. 안 바뀐 질문의 번호가 남아야 답이 남는다(결정 11).
test(
  '질문을 고쳐도 안 바뀐 질문과 선택지는 번호가 그대로다: 차례 바꾸기, 필수 바꾸기, 선택지 더하기·빼기',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const [initial, size, sports] = form.questions
    const response = await update(t, form, {
      questions: [
        { ...QUESTIONS[2]!, required: true },
        { kind: 'short_text', title: '하고 싶은 말', required: false, choices: [] },
        QUESTIONS[0],
        { ...QUESTIONS[1]!, choices: [{ label: 'L' }, { label: 'XL' }, { label: 'M' }] },
      ],
    })
    assert.equal(response.status, 200)
    const next = ((await response.json()) as { form: RegistrationForm }).form
    assert.deepEqual(shapeOf(next), [
      ['multiple_choice', '참가 종목', true, ['축구', '농구']],
      ['short_text', '하고 싶은 말', false, []],
      ['short_text', '이니셜', true, []],
      ['single_choice', '티셔츠 사이즈', true, ['L', 'XL', 'M']],
    ])
    assert.deepEqual(next.questions[0], { ...sports!, required: true })
    assert.deepEqual(next.questions[2], initial)
    assert.equal(next.questions[3]!.id, size!.id)
    const choiceId = (label: string) => size!.choices.find(c => c.label === label)!.id
    assert.equal(next.questions[3]!.choices[0]!.id, choiceId('L'))
    assert.equal(next.questions[3]!.choices[2]!.id, choiceId('M'))
    const before = form.questions.flatMap(q => [q.id, ...q.choices.map(c => c.id)])
    assert.ok(!before.includes(next.questions[1]!.id))
    assert.ok(!before.includes(next.questions[3]!.choices[1]!.id))
    // 빠진 선택지 S는 행이 남지 않고, 차례는 1부터 빈틈이 없다.
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_question_choice'), 5)
    assert.deepEqual(await t.detail(form.id), next)
    const { rows } = await t.pg.query<{ position: number }>(
      'SELECT position FROM registration_question WHERE form_id = $1 ORDER BY position',
      [form.id],
    )
    assert.deepEqual(
      rows.map(row => row.position),
      [1, 2, 3, 4],
    )
  }),
)

test(
  '제목이나 종류가 바뀐 질문은 다른 질문이라 새 번호이고, 같은 제목이 둘이면 앞에서부터 짝짓는다',
  withRegistrations(async t => {
    const twin = { kind: 'short_text', title: '이름표', required: false, choices: [] }
    const { form } = await t.created(await t.makeEvent(), {
      questions: [twin, twin, QUESTIONS[1]],
    })
    const ids = form.questions.map(question => question.id)
    const response = await update(t, form, {
      questions: [twin, { ...QUESTIONS[1]!, kind: 'multiple_choice' }, { ...twin, title: '별명' }],
    })
    assert.equal(response.status, 200)
    const next = ((await response.json()) as { form: RegistrationForm }).form
    assert.equal(next.questions[0]!.id, ids[0])
    for (const question of next.questions.slice(1)) assert.ok(!ids.includes(question.id))
  }),
)

test(
  '열린 화면의 답: 질문이 더해지면 옛 번호만 보낸 신청은 409이고, 남은 질문의 번호로 새 질문까지 답하면 된다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const { form } = await t.created(event, { questions: QUESTIONS })
    assert.equal((await t.post(`/registration-forms/${form.id}/activate`, {})).status, 200)
    const open = JSON.parse((await t.publicRead(form.publicCode)).text) as {
      questions: RegistrationForm['questions']
    }
    const added = { kind: 'short_text', title: '하고 싶은 말', required: false, choices: [] }
    const changed = await update(t, form, { questions: [...QUESTIONS, added] })
    assert.equal(changed.status, 200)
    const next = ((await changed.json()) as { form: RegistrationForm }).form
    const stale = await t.apply(form.publicCode, {
      name: '김신청',
      studentId: '202612345',
      answers: answersOf(open),
    })
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), { error: 'FORM_CHANGED' })
    await t.applied(form.publicCode, {
      name: '김신청',
      studentId: '202612345',
      answers: [...answersOf(open), { questionId: next.questions[3]!.id, text: null }],
    })
  }),
)

test(
  '질문을 고쳐도 양식의 판이 늘지 않고 같은 학생회의 다른 양식 질문은 그대로다',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const { form: neighbor } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const versions = () =>
      t.count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [form.id])
    const before = await versions()
    const swapped = await update(t, form, { questions: [QUESTIONS[1], QUESTIONS[0]] })
    assert.equal(swapped.status, 200)
    assert.equal(await versions(), before)
    assert.deepEqual((await t.detail(neighbor.id)).questions, neighbor.questions)
  }),
)

test(
  '신청이 한 명이라도 있으면 질문 더하기·고치기·지우기가 409이고 같은 질문으로 다른 칸을 고치는 것은 된다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const { form } = await t.created(event, { questions: QUESTIONS })
    await t.post(`/registration-forms/${form.id}/activate`, {})
    await t.applied(form.publicCode, {
      name: '김신청',
      studentId: '202612345',
      answers: answersOf(form),
    })
    const attempts = [
      [...QUESTIONS, { kind: 'short_text', title: '추가', required: false, choices: [] }],
      [{ ...QUESTIONS[0]!, required: false }, QUESTIONS[1], QUESTIONS[2]],
      [QUESTIONS[0], { ...QUESTIONS[1]!, choices: [{ label: 'S' }, { label: 'M' }] }, QUESTIONS[2]],
      [QUESTIONS[1], QUESTIONS[0], QUESTIONS[2]],
      QUESTIONS.slice(1),
      [],
    ]
    for (const questions of attempts) {
      const response = await update(t, form, { questions })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'FORM_HAS_APPLICANTS' })
    }
    assert.deepEqual((await t.detail(form.id)).questions, form.questions)
    const renamed = await update(t, form, { questions: QUESTIONS, name: '새 이름' })
    assert.equal(renamed.status, 200)
    assert.equal(((await renamed.json()) as { form: RegistrationForm }).form.name, '새 이름')
    assert.equal((await update(t, form, { capacity: 10 })).status, 200)
    assert.deepEqual((await t.detail(form.id)).questions, form.questions)
  }),
)

test(
  '질문 수·선택지 수·제목·선택지 이름의 상한+1과 종류에 맞지 않는 선택지, 겹친 선택지, 모르는 키는 400이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const short = (title: string) => ({ kind: 'short_text', title, required: false, choices: [] })
    const choice = (labels: string[]) => ({
      kind: 'single_choice',
      title: '고르기',
      required: false,
      choices: labels.map(label => ({ label })),
    })
    const labels = (n: number) => Array.from({ length: n }, (_, i) => `선택 ${i}`)
    const bad = [
      Array.from({ length: FORM_QUESTION_MAX + 1 }, (_, i) => short(`질문 ${i}`)),
      [choice(labels(QUESTION_CHOICE_MAX + 1))],
      [short('가'.repeat(QUESTION_TITLE_MAX) + '😀')],
      [choice(['가'.repeat(CHOICE_LABEL_MAX) + '😀'])],
      [short('   ')],
      [short('\u0000')],
      [choice([])],
      [{ ...short('짧은 답'), choices: [{ label: 'A' }] }],
      [choice(['A', 'A'])],
      [{ ...short('짧은 답'), extra: 1 }],
      [{ ...choice(['A']), choices: [{ label: 'A', capacity: 1 }] }],
      [{ kind: 'long_text', title: '긴 글', required: false, choices: [] }],
      [{ title: '종류 없음', required: false, choices: [] }],
    ]
    for (const questions of bad)
      assert.equal(
        (await t.create(event, { ...FORM, questions })).status,
        400,
        JSON.stringify(questions).slice(0, 80),
      )
    const max = Array.from({ length: FORM_QUESTION_MAX }, (_, i) => ({
      ...choice(
        labels(QUESTION_CHOICE_MAX).map(
          label =>
            `${label}${'가'.repeat(CHOICE_LABEL_MAX - label.length - 2)}${String(i).padStart(2, '0')}`,
        ),
      ),
      title: `${'가'.repeat(QUESTION_TITLE_MAX - 3)}${String(i).padStart(3, '0')}`,
    }))
    const body = { ...FORM, questions: max }
    assert.ok(Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES)
    const response = await t.create(event, body)
    assert.equal(response.status, 201)
    const { form } = (await response.json()) as { form: RegistrationForm }
    assert.equal(form.questions.length, FORM_QUESTION_MAX)
    assert.equal(form.questions[0]!.choices.length, QUESTION_CHOICE_MAX)
  }),
)

test(
  '질문 고치기도 양식 고치기 권한이고 다른 학생회 양식은 404, 미인증은 401이다',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const theirs = await t.makeForm(await t.makeEvent({}, t.other), {}, t.other)
    for (const user of ['s-plain', 's-financeMember'])
      assert.equal((await update(t, form, { questions: [] }, user)).status, 403, user)
    assert.equal((await update(t, { ...form, id: theirs }, { questions: [] })).status, 404)
    assert.equal((await update(t, { ...form, id: MISSING }, { questions: [] })).status, 404)
    assert.equal(
      (
        await t.api.post(`${t.orgBase}/registration-forms/${form.id}`, {
          ...FORM,
          opensAt: null,
          capacity: null,
          notice: null,
          collectsStudentId: true,
          payerFee: null,
          nonPayerFee: null,
          feeAccountId: null,
          questions: [],
        })
      ).status,
      401,
    )
    assert.deepEqual((await t.detail(form.id)).questions, form.questions)
  }),
)
