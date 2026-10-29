import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import {
  FORM_QUESTION_MAX,
  QUESTION_CHOICE_MAX,
  SHORT_ANSWER_MAX,
  type EventApplicantsResponse,
  type MyRegistration,
} from '@vada/contracts'
import { MAX_BODY_BYTES } from '../http/guard.js'
import { answersOf, QUESTIONS } from '../test-support/questions.js'
import { korean, withRegistrations, type RegistrationKit } from '../test-support/registrations.js'
import { purgeRegistrations } from './purge.js'

const person = { name: '김신청', studentId: '202612345' }

// 질문 셋이 있는 받는 중 양식(참가비 없음)
async function questionForm(t: RegistrationKit, questions: unknown[] = QUESTIONS) {
  const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
  const { form } = await t.created(event, { questions })
  assert.equal((await t.post(`/registration-forms/${form.id}/activate`, {})).status, 200)
  return { event, form }
}
const answerRows = (t: RegistrationKit) => t.count('SELECT count(*) AS n FROM registration_answer')

test(
  '공개 양식은 질문의 번호·종류·제목·필수·선택지를 차례대로 준다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    const read = await t.publicForm(form.publicCode)
    assert.deepEqual(read.questions, form.questions)
  }),
)

test(
  '답과 함께 신청하면 답을 저장하고 개인 링크의 내 신청에 질문마다 답이 보인다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    const token = await t.applied(form.publicCode, { ...person, answers: answersOf(form) })
    assert.equal(await answerRows(t), 4)
    const mine = (await (await t.lookup(token)).json()) as MyRegistration
    assert.deepEqual(
      mine.answers.map(answer => [answer.title, answer.values]),
      [
        ['이니셜', ['KHS']],
        ['티셔츠 사이즈', ['S']],
        ['참가 종목', ['축구', '농구']],
      ],
    )
    // 답하지 않은 선택 질문은 빈 목록이다.
    const [initial, size, sports] = answersOf(form)
    const second = await t.applied(form.publicCode, {
      ...person,
      studentId: '202612346',
      answers: [initial, size, { ...sports, choiceIds: [] }],
    })
    const other = (await (await t.lookup(second)).json()) as MyRegistration
    assert.deepEqual(other.answers[2], {
      questionId: form.questions[2]!.id,
      title: '참가 종목',
      values: [],
    })
  }),
)

test(
  '필수 답이 비면 400, 질문이 빠지거나 모르는 질문·선택지·종류에 맞지 않는 모양이면 409 FORM_CHANGED이고 신청이 생기지 않는다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    const [initial, size, sports] = answersOf(form) as [
      { questionId: string; text: string },
      { questionId: string; choiceId: string },
      { questionId: string; choiceIds: string[] },
    ]
    const otherForm = (await questionForm(t)).form
    const cases: [string, unknown[], number][] = [
      ['필수 짧은 답 비움', [{ ...initial, text: null }, size, sports], 400],
      ['필수 하나 고르기 비움', [initial, { ...size, choiceId: null }, sports], 400],
      ['짧은 답 공백만', [{ ...initial, text: '   ' }, size, sports], 400],
      [
        '짧은 답 상한+1',
        [{ ...initial, text: '가'.repeat(SHORT_ANSWER_MAX) + '😀' }, size, sports],
        400,
      ],
      [
        '겹친 선택지',
        [initial, size, { ...sports, choiceIds: [sports.choiceIds[0], sports.choiceIds[0]] }],
        400,
      ],
      ['같은 질문 두 번', [initial, initial, size, sports], 400],
      ['모르는 키', [{ ...initial, extra: 1 }, size, sports], 400],
      ['질문 빠짐', [initial, size], 409],
      ['모르는 질문', [initial, size, sports, { questionId: randomUUID(), text: 'x' }], 409],
      [
        '다른 양식 선택지',
        [initial, { ...size, choiceId: otherForm.questions[1]!.choices[0]!.id }, sports],
        409,
      ],
      [
        '여럿 고르기에 하나 고르기 모양',
        [initial, size, { questionId: sports.questionId, choiceId: sports.choiceIds[0] }],
        409,
      ],
      [
        '하나 고르기에 여럿 모양',
        [initial, { questionId: size.questionId, choiceIds: [size.choiceId] }, sports],
        409,
      ],
      ['고르기에 글', [initial, { questionId: size.questionId, text: 'S' }, sports], 409],
      [
        '짧은 답에 선택지',
        [{ questionId: initial.questionId, choiceId: size.choiceId }, size, sports],
        409,
      ],
      ['다른 질문의 선택지', [initial, size, { ...sports, choiceIds: [size.choiceId] }], 409],
    ]
    for (const [label, answers, status] of cases) {
      const response = await t.apply(form.publicCode, { ...person, answers })
      assert.equal(response.status, status, label)
      if (status === 409) assert.deepEqual(await response.json(), { error: 'FORM_CHANGED' }, label)
    }
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 0)
    assert.equal(await answerRows(t), 0)
    // 답 없이(옛 화면) 보내면 질문이 빠진 것과 같다.
    assert.equal((await t.apply(form.publicCode, person)).status, 409)
    // 질문이 없는 양식에 답이 오면 409다.
    const plain = await questionForm(t, [])
    assert.equal(
      (await t.apply(plain.form.publicCode, { ...person, answers: [initial] })).status,
      409,
    )
    assert.equal((await t.apply(plain.form.publicCode, person)).status, 201)
  }),
)

test(
  '가장 큰 답 본문도 공통 가드 상한 안에서 받는다',
  withRegistrations(async t => {
    const questions = Array.from({ length: FORM_QUESTION_MAX }, (_, i) =>
      i % 2
        ? { kind: 'short_text', title: `글 ${i}`, required: true, choices: [] }
        : {
            kind: 'multiple_choice',
            title: `여럿 ${i}`,
            required: true,
            choices: Array.from({ length: QUESTION_CHOICE_MAX }, (_, j) => ({
              label: `선택 ${j}`,
            })),
          },
    )
    const { form } = await questionForm(t, questions)
    const answers = form.questions.map(question =>
      question.kind === 'short_text'
        ? { questionId: question.id, text: '\u0001'.repeat(SHORT_ANSWER_MAX) }
        : { questionId: question.id, choiceIds: question.choices.map(choice => choice.id) },
    )
    const body = {
      commandId: randomUUID(),
      name: '\u0001'.repeat(50),
      studentId: '202612345',
      answers,
    }
    assert.ok(JSON.stringify(body).length > MAX_BODY_BYTES * 0.6)
    assert.equal((await t.apply(form.publicCode, body)).status, 201)
  }),
)

test(
  '같은 명령 번호에 다른 답을 보내면 COMMAND_REUSED이고 같은 답이면 같은 신청이다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    const commandId = randomUUID()
    const answers = answersOf(form)
    assert.equal((await t.apply(form.publicCode, { commandId, ...person, answers })).status, 201)
    assert.equal((await t.apply(form.publicCode, { commandId, ...person, answers })).status, 201)
    const changed = [{ ...answers[0]!, text: 'ABC' }, answers[1], answers[2]]
    const reused = await t.apply(form.publicCode, { commandId, ...person, answers: changed })
    assert.equal(reused.status, 422)
    assert.deepEqual(await reused.json(), { error: 'COMMAND_REUSED' })
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 1)
    assert.equal(await answerRows(t), 4)
  }),
)

test(
  '스스로 취소, 운영진 취소, 입금 뒤 취소, 기한 비우기가 답을 지운다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    const apply = () => t.applied(form.publicCode, { ...person, answers: answersOf(form) })
    const idOf = async (token: string) =>
      (
        await t.pg.query<{ registration_id: string }>(
          'SELECT registration_id FROM registration_link WHERE token_hash = $1',
          [createHash('sha256').update(token).digest('hex')],
        )
      ).rows[0]!.registration_id
    const answersFor = (id: string) =>
      t.count('SELECT count(*) AS n FROM registration_answer WHERE registration_id = $1', [id])
    const mine = await apply()
    const mineId = await idOf(mine)
    assert.equal((await t.cancelMine(mine)).status, 200)
    assert.equal(await answersFor(mineId), 0)
    const staffId = await idOf(await apply())
    assert.equal((await t.post(`/registrations/${staffId}/cancel`, {})).status, 200)
    assert.equal(await answersFor(staffId), 0)
    const kept = await idOf(await apply())
    assert.equal(await answersFor(kept), 4)
    assert.equal(await answerRows(t), 4)
    await t.db.transaction(tx => purgeRegistrations(tx, korean('2027-11-03T00:00')))
    assert.equal(await answerRows(t), 0)
    // 질문과 선택지는 양식의 설정이라 남는다.
    assert.equal((await t.detail(form.id)).questions.length, 3)
  }),
)

test(
  '행사 명단은 질문마다 답을 주고 같은 열람 기록을 남긴다. 신청자 보기 권한이 있는 역할은 모두 답을 본다',
  withRegistrations(async t => {
    const event = await t.makeEvent({
      startsAt: new Date('2026-11-02T03:00:00Z'),
      ownerId: t.council.people.planningMember.memberId,
    })
    const { form } = await t.created(event, { questions: QUESTIONS })
    await t.post(`/registration-forms/${form.id}/activate`, {})
    await t.applied(form.publicCode, { ...person, answers: answersOf(form) })
    const expected = [
      { questionId: form.questions[0]!.id, title: '이니셜', values: ['KHS'] },
      { questionId: form.questions[1]!.id, title: '티셔츠 사이즈', values: ['S'] },
      { questionId: form.questions[2]!.id, title: '참가 종목', values: ['축구', '농구'] },
    ]
    const viewers: string[] = []
    for (const name of Object.keys(t.council.people)) {
      const logsBefore = await t.count('SELECT count(*) AS n FROM applicant_access_log')
      const response = await t.api.get(`${t.orgBase}/events/${event}/applicants`, `s-${name}`)
      if (response.status !== 200) continue
      const body = (await response.json()) as EventApplicantsResponse
      if (!body.canView) {
        assert.deepEqual(body.applicants, [], name)
        continue
      }
      viewers.push(name)
      assert.deepEqual(body.applicants[0]!.answers, expected, name)
      assert.equal(
        await t.count('SELECT count(*) AS n FROM applicant_access_log'),
        logsBefore + 1,
        name,
      )
    }
    for (const name of ['president', 'vicePresident', 'financeMember', 'planningMember'])
      assert.ok(viewers.includes(name), `${name}가 답을 보지 못한다`)
    assert.ok(!viewers.includes('plain'))
  }),
)

test(
  '다른 학생회 양식의 질문은 보이지 않는다(404)',
  withRegistrations(async t => {
    const theirs = await t.makeForm(await t.makeEvent({}, t.other), {}, t.other)
    const response = await t.api.get(`${t.orgBase}/registration-forms/${theirs}`, 's-president')
    assert.equal(response.status, 404)
    const { form } = await t.created(await t.makeEvent(), { questions: QUESTIONS })
    const otherUser = await t.api.get(
      `/api/organizations/${t.other.councilId}/registration-forms/${form.id}`,
      'o-president',
    )
    assert.equal(otherUser.status, 404)
  }),
)

// 되돌린 배포에서 이 표를 모르는 옛 코드가 돌아도 답이 남지 않는다(0027의 트리거와 연쇄 지우기).
test(
  '옛 코드처럼 신청을 취소하거나 이름만 비워도, 신청·양식 행을 지워도 답과 질문이 남지 않는다',
  withRegistrations(async t => {
    const { form } = await questionForm(t)
    for (let n = 0; n < 3; n++)
      await t.applied(form.publicCode, {
        ...person,
        studentId: `20261234${n}`,
        answers: answersOf(form),
      })
    const ids = (
      await t.pg.query<{ id: string }>('SELECT id FROM registration ORDER BY id')
    ).rows.map(row => row.id)
    await t.pg.query(
      'UPDATE registration SET cancelled_at = now(), student_id = NULL WHERE id = $1',
      [ids[0]],
    )
    await t.pg.query('UPDATE registration SET name = NULL, student_id = NULL WHERE id = $1', [
      ids[1],
    ])
    assert.equal(await answerRows(t), 4)
    // 옛 학생회 파기는 새 표를 모르고 신청·양식 행을 지운다.
    await t.pg.query('DELETE FROM registration_link')
    await t.pg.query('DELETE FROM command_receipt')
    await t.pg.query('DELETE FROM record_version WHERE record_id = ANY($1::uuid[])', [ids])
    await t.pg.query('DELETE FROM registration WHERE id = ANY($1::uuid[])', [ids])
    assert.equal(await answerRows(t), 0)
    await t.pg.query('DELETE FROM registration_form WHERE id = $1', [form.id])
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_question'), 0)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_question_choice'), 0)
  }),
)
