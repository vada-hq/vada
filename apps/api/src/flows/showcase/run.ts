import { koreanDateOf, koreanOf } from '@vada/contracts'
import { createPerson } from '../people.js'
import type { EvidenceUploader } from '../rehearsal-kit.js'
import type { Flow } from '../server.js'
import type { AccountRole, ShowcaseContent } from './content/types.js'
import { emptyWorld, type Member, type ShowcaseCtx } from './kit.js'
import { createCalendar } from './moment.js'
import { planOf, timeline } from './plan.js'

// 시연 학생회 실행기: 내용 파일을 읽어 단계마다 그 일을 할 사람으로 실제 화면이 부르는 HTTP 경로를 부른다(리허설과 같은 방식).
// 서비스 함수나 SQL로 상태를 만들지 않으므로 규칙 검사를 모두 거치고, 기능이 바뀌면 이 시나리오의 시험이 깨진다.

export type ShowcaseOptions = {
  content: ShowcaseContent
  // 학교 이름과 학생회 이름(명령 인자, 없으면 내용 파일의 기본값)
  council: { name: string; schoolName: string }
  // 돌리는 때. 마지막 단계가 이 때이고, 내용의 D0이 이 때의 한국 날짜다.
  finalAt: Date
  // 자리마다 쓸 실제 계정(users.id). 없는 자리는 같은 이름의 가상 인물이 맡는다.
  accounts: Partial<Record<AccountRole, string>>
  uploadEvidence: EvidenceUploader
}

// 흐름 서버를 시작할 시각(첫 단계, 학생회 만들기)
export const showcaseStart = (content: ShowcaseContent, finalAt: Date) =>
  createCalendar(koreanDateOf(finalAt)).dateOf(content.council.at)

// 실제 계정은 흐름 세션에 들이기만 하고(계정은 만들지 않는다), 나머지는 로그인 수단이 없는 가상 인물을 만든다.
async function castOf(flow: Flow, options: ShowcaseOptions) {
  const people = new Map<string, Member>()
  for (const [index, entry] of options.content.council.staff.entries()) {
    const userId = entry.account ? options.accounts[entry.account] : undefined
    if (userId) {
      flow.flowSession.admit(userId)
      people.set(entry.name, {
        userId,
        name: entry.name,
        api: flow.driver.as(userId),
        memberId: '',
        virtual: false,
      })
    } else {
      const person = await createPerson(flow, `showcase-${index}`, entry.name)
      people.set(entry.name, { ...person, memberId: '', virtual: true })
    }
  }
  return people
}

export async function runShowcase(flow: Flow, options: ShowcaseOptions) {
  const ctx: ShowcaseCtx = {
    flow,
    cal: createCalendar(koreanDateOf(options.finalAt)),
    content: options.content,
    council: options.council,
    people: await castOf(flow, options),
    w: emptyWorld(),
    uploadEvidence: options.uploadEvidence,
  }
  const start = showcaseStart(options.content, options.finalAt)
  const steps = timeline(planOf(ctx), options.finalAt, options.content, start)
  for (const step of steps) {
    try {
      await flow.driver.travelTo(step.at)
      await step.run()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`시연 단계 '${step.label}'(${koreanOf(step.at)}): ${reason}`, {
        cause: error,
      })
    }
  }
  return { councilId: ctx.w.councilId, people: ctx.people, steps: steps.length }
}
