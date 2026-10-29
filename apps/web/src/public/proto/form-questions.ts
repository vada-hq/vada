// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. form-data.ts의 견본이 쓰는 추가 질문.
// ─────────────────────────────────────────────────────────────────────────────
import type { FormQuestion } from '@vada/contracts'

// 견본 번호. UUID 모양이라야 지금 구현의 칸 확인(계약 recordIdInput)이 통과한다. n은 세 자리.
export const id = (n: string) => `0199d1a0-0000-7000-8000-000000000${n}`

const choice = (n: string, label: string) => ({ id: id(n), label })

// main: 티셔츠 사이즈(필수), 버스 탑승(필수), 못 먹는 음식(선택)
export const MAIN_QUESTIONS: FormQuestion[] = [
  {
    id: id('101'),
    kind: 'single_choice',
    title: '티셔츠 사이즈',
    required: true,
    choices: [choice('111', 'S'), choice('112', 'M'), choice('113', 'L'), choice('114', 'XL')],
  },
  {
    id: id('102'),
    kind: 'single_choice',
    title: '버스 탑승',
    required: true,
    choices: [choice('121', '학교에서 함께 출발'), choice('122', '따로 갈게요')],
  },
  { id: id('103'), kind: 'short_text', title: '못 먹는 음식', required: false, choices: [] },
]

// long: 질문 여섯, 긴 질문 글, 선택지 7개짜리 하나
export const LONG_QUESTIONS: FormQuestion[] = [
  {
    id: id('201'),
    kind: 'single_choice',
    title:
      '첫째 날 오후 조별 활동 시간에 참여할 활동을 하나 골라 주세요. 인원이 많이 몰리면 운영진이 조를 다시 나눌 수 있어요',
    required: true,
    choices: [
      choice('211', '보드게임'),
      choice('212', '축구'),
      choice('213', '농구'),
      choice('214', '노래방'),
      choice('215', '방 탈출 게임'),
      choice('216', '숙소 둘레 산책과 단체 사진 찍기'),
      choice('217', '숙소에서 쉬기'),
    ],
  },
  {
    id: id('202'),
    kind: 'single_choice',
    title: '단체 티셔츠 사이즈(첫째 날 버스에서 나눠 드려요)',
    required: true,
    choices: [choice('221', 'S'), choice('222', 'M'), choice('223', 'L'), choice('224', 'XL')],
  },
  {
    id: id('203'),
    kind: 'single_choice',
    title: '버스 탑승(학교 정문에서 2월 23일 오전 9시 30분에 출발해요)',
    required: true,
    choices: [choice('231', '학교에서 함께 출발'), choice('232', '따로 갈게요')],
  },
  {
    id: id('204'),
    kind: 'multiple_choice',
    title: '둘째 날 저녁에 함께하고 싶은 프로그램을 모두 골라 주세요',
    required: false,
    choices: [
      choice('241', '레크리에이션'),
      choice('242', '선배와의 대화'),
      choice('243', '장기자랑'),
      choice('244', '영화 보기'),
    ],
  },
  {
    id: id('205'),
    kind: 'short_text',
    title: '못 먹는 음식이나 알레르기가 있으면 적어 주세요(식단 준비에만 써요)',
    required: false,
    choices: [],
  },
  {
    id: id('206'),
    kind: 'short_text',
    title:
      '운영진에게 미리 알려 주고 싶은 것이 있으면 자유롭게 적어 주세요(건강, 이동, 숙소 관련 등)',
    required: false,
    choices: [],
  },
]
