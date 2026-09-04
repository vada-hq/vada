import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { day, moment } from '../time.ts'

// 문서를 보는 다섯 화면이 함께 쓰는 **완성된 글과 색**.
//
// 화면 다섯이 한 표를 보는데(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02) 그
// 다섯이 같은 사실을 저마다의 말로 옮기면 같은 문서가 화면마다 다른 상태로 보인다.
// 그래서 옮기는 규칙을 여기 한 곳에 둔다 — 표에 담긴 것은 `reviewing`이고
// '검토 중'은 여기서 붙는다.

export type DocumentStatus = 'notStarted' | 'drafting' | 'reviewing' | 'confirmed'

/** 거르개의 선택지 넷. **명세가 고정했다**(`event.documentStatus`의 '전체'를 뺀 넷). */
const STATUSES: readonly DocumentStatus[] = ['notStarted', 'drafting', 'reviewing', 'confirmed']

/**
 * 단계를 사람이 읽는 말과 색으로.
 *
 * **화면이 이 규칙을 알면 단계가 늘 때마다 화면을 고친다.** 색 이름은 화면의
 * 딱지가 아는 것 중에서 고른다(`design/tones.ts`의 STATE_CHIP) — 모르는 이름을
 * 주면 화면이 조용히 무채색으로 그린다.
 */
export const STATUS: Record<DocumentStatus, { label: string; tone: string }> = {
  notStarted: { label: '작성 전', tone: 'gray' },
  drafting: { label: '작성 중', tone: 'blue' },
  reviewing: { label: '검토 중', tone: 'yellow' },
  confirmed: { label: '확정', tone: 'green' },
}

/**
 * 상태 거르개가 고른 값. **안 넘기면 좁히지 않는다.**
 *
 * 거르개의 '전체'가 거르지 않는다는 뜻인 것과 같다(업무 보드의 보는 범위가 이미
 * 그 길이다). 값은 화면 안의 칸에 살아서 **그릇이 미리 받을 때는 아직 없을 수
 * 있다** — 그때 막으면 화면이 그려지기도 전에 통째로 오류가 된다.
 *
 * 틀리게 넘긴 것은 막는다. 그대로 넘기면 PostgreSQL이 던져 500이 되고, 500은
 * 받는 쪽이 '내가 잘못 물었다'와 '서버가 고장났다'를 가릴 수 없게 만든다.
 */
export function readFilter(asked: string | undefined): DocumentStatus | null {
  const wanted = (asked ?? '').trim()
  if (wanted === '' || wanted === 'all') return null
  if (STATUSES.includes(wanted as DocumentStatus)) return wanted as DocumentStatus
  throw new Blocked('명세에 없는 문서 상태입니다')
}

/**
 * 국면(카테고리)의 색.
 *
 * **표에 색 열이 없다.** 이 저장소가 그렇게 정했다 — 색 이름은 표현이라 열이
 * 아니고 읽을 때 만든다(`db/schema.ts` 머리). 명세가 '국면은 조직이 늘릴 수 있으므로
 * 색도 데이터가 갖는다'고 적은 것은 **색이 국면을 따라다닌다**는 뜻이고, 국면은
 * 조직이 부르는 말이므로 그 조직이 쓰고 있는 국면들에서 고른다.
 *
 * **행사별이 아니라 조직 전체로 센다.** 행사마다 다시 세면 같은 '기획'이 행사마다
 * 다른 색이 되고, 그러면 색이 국면을 가리키는 구실을 잃는다.
 *
 * 팔레트가 셋뿐인 까닭은 **화면이 아는 색이 그것뿐**이기 때문이다(`ACCENT_BAR`가
 * blue·amber·violet·gray를 안다). 모르는 이름을 주면 줄이 조용히 전부 무채색이 된다.
 */
const PALETTE = ['blue', 'amber', 'violet'] as const

/** 국면이 아직 없는 문서. 팔레트의 색이 아니라 '색이 없다'는 뜻이다. */
export const NO_CATEGORY = '분류 미정'
export const NO_CATEGORY_TONE = 'gray'

export async function categoryTones(db: Db, orgId: string): Promise<Map<string, string>> {
  const rows = await db
    .selectDistinct({ category: documents.category })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), isNotNull(documents.category)))
    .orderBy(asc(documents.category))
  return new Map(
    rows
      .map((row) => (row.category ?? '').trim())
      .filter((category) => category !== '')
      .map((category, index) => [category, PALETTE[index % PALETTE.length]!]),
  )
}

/** 국면이 그 문서에 실제로 적혀 있는가. 빈 글은 안 적힌 것과 같다. */
export function phaseOf(category: string | null): string | null {
  const wanted = (category ?? '').trim()
  return wanted === '' ? null : wanted
}

/** 아직 아무도 안 적은 설명. **빈 글을 주면 화면이 빈 자리를 그린다.** */
export const NO_DESCRIPTION = '설명이 아직 등록되지 않았습니다.'

/**
 * 아직 시작하지 않은 문서를 **언제 쓸 것인가**.
 *
 * 명세가 '아직 시작하지 않은 문서는 언제 쓸 것인지로 온다 — 오늘이 언제인지 화면이
 * 알 수 없다'고 적었다. **표에는 그 때를 담는 열이 없다.** 아는 사실은 '아직
 * 시작하지 않았다' 하나뿐이라, 행사 문서가 행사와 함께 끝난다는 것만 말한다.
 * 문서마다 예정을 잡는 자리가 명세에 생기는 날 이 상수가 열이 된다.
 */
const WILL_WRITE = '행사 종료 후'

/** 손댄 사람이 표에 안 남았을 때. **빈 글을 주면 '아무도 안 만졌다'로 읽힌다.** */
const NO_EDITOR = '기록 없음'

/**
 * 마지막으로 손댄 때와 사람(`07. 18 · 박해랑`).
 *
 * **완성된 문구를 서버가 만든다.** 두 사실(때 · 사람)을 화면이 이으면 화면마다 다른
 * 꼴이 나오고, 아직 시작하지 않은 문서를 무엇으로 그릴지도 화면이 정하게 된다.
 */
export function updatedNote(
  status: DocumentStatus,
  updatedAt: Date,
  editor: string | null,
): string {
  if (status === 'notStarted') return WILL_WRITE
  return `${day(updatedAt).slice(6)} · ${editor ?? NO_EDITOR}`
}

/** `최종 수정일 2026-07-12` — 참고 문서가 쓰는 꼴. 명세가 이 문구를 적었다. */
export function lastModifiedNote(updatedAt: Date): string {
  return `최종 수정일 ${moment(updatedAt).slice(0, 10)}`
}

/**
 * 파일인가 문서인가.
 *
 * **표에 갈래 열이 없다** — `documents`는 파일을 담지 않고 이름과 상태만 든다
 * (`db/schema.ts`가 그렇게 적어 두었다). 그래서 아는 사실은 이름뿐이고, 이름 끝에
 * 확장자가 붙어 있다는 것이 곧 '올린 파일'이라는 뜻이다(`현수막 시안 v2.png`).
 * 파일을 어디에 두는지가 정해지는 날 그것이 열이 되고, 고칠 자리는 여기 하나다.
 */
export function kindOf(title: string): string {
  return /\.[A-Za-z0-9]{1,8}$/.test(title.trim()) ? '파일' : '문서'
}

/**
 * 공식 문서에 반영됐는가.
 *
 * **표에 반영 여부 열이 없다.** 문서마다 아는 사실은 상태뿐이고, 확정된 문서는
 * 더 고칠 것이 없다는 뜻이므로 그것을 반영으로 읽는다. 업무의 결과가 공식 문서로
 * 옮겨졌는지를 따로 적는 자리가 명세에 생기는 날 열이 된다.
 */
export function officialReflection(status: DocumentStatus): string {
  return status === 'confirmed' ? '반영' : '미반영'
}
