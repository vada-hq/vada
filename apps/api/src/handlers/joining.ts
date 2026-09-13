import type { Context } from 'hono'
import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types.d.ts'
import type { Deps, Handlers } from '../deps.ts'
import {
  collegeOptions as educationCollegeOptions,
  departmentOptions as educationDepartmentOptions,
  schoolOptions,
} from '../org/education.ts'
import { createOrg, invitedOrganization, joinOrg, verifyInviteCode } from '../org/joining.ts'

// 들어오는 길 — 로그인하고, 학교를 고르고, 학생회를 만들거나 초대를 확인한다.
//
// **여기서는 `orgOf(c)`를 쓰지 않는다.** 아직 어느 학생회의 것도 아닌 사람이 부르는
// 자리이기 때문이다(계약의 `public`과 `signedIn`). 안쪽(`org.ts`)과 갈리는 점이 그것이다.

async function startSignIn(c: Context, d: Deps, provider: string) {
  const { url, headers } = await d.signIn.start(provider)
  // state는 URL만으로 검증할 수 없다. 시작한 브라우저에 검증 쿠키도 전달해야 한다.
  for (const cookie of headers.getSetCookie()) {
    c.header('set-cookie', cookie, { append: true })
  }
  return { url }
}

export const joiningHandlers: Handlers = {
  // ── 들어오는 자리 (SIGN-IN) ────────────────────────────────────────────
  //
  // **로그인 자리는 로그인이 필요 없다**(계약의 `public`). 아직 아무도 아닌 사람이
  // 부르므로 권한 미들웨어가 그냥 지나간다.
  //
  // 한동안 이 셋이 계약 밖에 있었다(`serve.ts`가 따로 매달았다). 로그인 화면에 그림이
  // 없어 명세가 없었고, 명세가 없으니 계약에도 없었다. 그림을 그리자 셋 다 들어왔다.
  // **앱을 열면 어디부터인가.** 아는 쪽이 답한다 — 로그인했는지와 어느 학생회에
  // 속했는지는 세션이 정하고 그것은 여기 있다. 화면이 판정하면 세션을 못 읽는다.
  //
  // 한동안 앱이 무조건 소속 입력으로 갔다(2026-09-08에 사람이 겪었다). 이미 들어온
  // 사람도 열 때마다 그 화면부터 봤고, 로그인 화면으로 가는 길은 아예 없었다.
  'app.start': async (c): Promise<ApiResponse<'app.start'>> => {
    const sender = c.get('sender')
    if (sender === null || sender === undefined) return { screenId: 'SIGN-IN' }
    return { screenId: sender.membership === null ? 'ONB-01' : 'HOME-01K' }
  },
  'auth.ways': async (_c, d) => d.signIn.open(),
  'auth.signInGoogle': async (c, d) => startSignIn(c, d, 'google'),
  'auth.signInKakao': async (c, d) => startSignIn(c, d, 'kakao'),
  // **나가는 길.** 들어오는 길이 셋인데 나가는 길이 없었다 — 한번 들어온 사람은
  // 브라우저의 쿠키를 직접 지워야 나갈 수 있었다(2026-09-09에 사람이 물었다).
  //
  // 돌려주는 값이 없다. 나간 것은 나간 것이고, 화면은 로그인 자리로 간다.
  'auth.signOut': async (c, d) => {
    // **쿠키를 거두라는 말을 그대로 넘긴다.** 안 넘기면 저장소의 세션은 지워지는데
    // 브라우저는 죽은 쿠키를 계속 들고 다닌다.
    for (const said of (await d.signIn.end(c.req.raw)).getSetCookie()) {
      c.header('set-cookie', said, { append: true })
    }
    return {}
  },


  // ── 학교의 편제 (ONB-01 · ORG-01 · INV-01) ─────────────────────────────
  //
  // **여기 '학부·학과'는 학생회의 부서가 아니다.** 아래 `org.departments`가 그리는
  // 것은 이 학생회가 스스로 나눈 부서(재정부·기획부)이고 이 셋은 학교의 편제다.
  //
  // 셋이 서로에게 걸려 있다 — 단과대는 학교에, 학부·학과는 그 학교의 그 단과대에.
  // 받은 인자를 전부 넘기는 까닭이 그것이다.
  'education.schools.options': async (c, d) => schoolOptions(d.db, c.req.query('q') ?? ''),
  'education.colleges.options': async (c, d) =>
    educationCollegeOptions(d.db, c.req.query('schoolId') ?? ''),
  'education.departments.options': async (c, d) =>
    educationDepartmentOptions(
      d.db,
      c.req.query('schoolId') ?? '',
      c.req.query('collegeId') ?? '',
    ),


  // ── 들어오기 (ORG-01 · ORG-02 · INV-00 · INV-01) ───────────────────────
  //
  // 여기 셋만 **아직 어느 학생회의 것도 아닌 사람**이 부른다(계약의 `signedIn`).
  // 그래서 `orgOf(c)`를 쓰지 않는다 — 그것은 소속이 이미 있는 사람의 자리다.
  'org.create': async (c, d) => {
    const who = c.get('sender')!
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const made = await createOrg(d.db, who.userId, draft, {
      newId: d.newId,
      now: d.invite.now,
      // 첫 초대의 코드도 여기서 받는다. 만드는 자리가 정하면 검사가 못 정한다.
      newCode: d.invite.newCode,
    })
    // **누구의 것을 다뤘나**: 이 요청이 만든 것은 이 사람의 구성원 줄이다.
    c.set('auditSubject', { type: 'user', id: who.userId })
    // 어느 학생회를 만들었는지도 남긴다. 보낸 사람에게 아직 소속이 없어 기록 층이
    // 이 칸을 채우지 못한다 — 비워 두면 '학생회가 언제 생겼나'를 기록으로 못 찾는다.
    c.set('orgId', made.orgId)
    // 계약이 '돌려주는 값이 없다'고 적었다.
    return {}
  },
  'organization.verifyInviteCode': async (c, d) => {
    const who = c.get('sender')!
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const checked = await verifyInviteCode(d.db, who.userId, draft)
    c.set('auditSubject', { type: 'organization', id: checked.orgId })
    // 계약이 '돌려주는 값이 없다'고 적었다. 어느 학생회인지는 다음 자리가 답한다.
    return {}
  },
  // **여기서 사람이 구성원이 된다.** 앞의 확인은 묻기만 한다.
  'org.join': async (c, d) => {
    const who = c.get('sender')!
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const joined = await joinOrg(d.db, who.userId, draft, { newId: d.newId, now: d.invite.now })
    c.set('auditSubject', { type: 'user', id: who.userId })
    // 보낸 사람에게 아직 소속이 없어 기록 층이 이 칸을 못 채운다 — 비워 두면
    // '누가 언제 어느 학생회에 들어왔나'를 기록으로 찾을 수 없다.
    c.set('orgId', joined.orgId)
    // 계약이 '돌려주는 값이 없다'고 적었다.
    return {}
  },
  'org.invitedOrganization': async (c, d) => {
    const found = await invitedOrganization(d.db, c.req.param('inviteCode')!)
    c.set('auditSubject', { type: 'organization', id: found.orgId })
    // **코드를 어디에도 쌓지 않는다.** 감사 기록은 이미 지우고(x-secret), 답이
    // 캐시에 남으면 그 자리로 학생회 이름이 새어 나간다.
    c.header('Cache-Control', 'no-store')
    return found.card
  },
}
