import type { DataRow } from '../data-sources/definitions'

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

/**
 * 보내고 나면 서버가 답을 준다. **만든 것의 id가 그 답에만 있다.**
 *
 * 개발용 응답은 mutations.json이 아니라 여기 있다 — 카탈로그는 계약(경로·상태
 * 문구)을 갖고, 무엇이 돌아오는지는 서버 대역이 정한다.
 */
const MUTATION_RESULTS: Record<string, DataRow> = {
  'message.room.create': { id: 'MR-01' },
  // **사람마다 다른 영수증.** QR·링크의 토큰으로 결과를 조회하면 같은 것을 쓴
  // 여러 사람이 서로의 이름과 결과를 본다 — 개발용 응답에서도 그 사실을 지킨다.
  //
  // 진짜 서버는 추측할 수 없는 값을 만들고 해시로 저장한다. 여기서는 어느 결과로
  // 이어지는지가 보여야 하므로 그 결과의 토큰을 붙여 둔다.
  'attendance.checkIn': { receiptToken: 'RCPT-B3N8P4' },
  'survey.apply': { receiptToken: 'RCPT-SVY-4f2a91c7' },
}

export async function submitDevelopmentMutation(key: string): Promise<DataRow> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  return MUTATION_RESULTS[key] ?? {}
}
