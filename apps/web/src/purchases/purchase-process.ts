import type { PurchaseArea } from '@vada/contracts'
import { columnOf, type BoardCard, type BoardColumn } from './purchase-board'

// 재정부 처리 단계의 업무 영역과 단계(와이어프레임 EVT-FIN-01B). 칸은 흐름 차례이고 예외 칸은 오른쪽에 따로 둔다.
// 지금 기록으로 채울 수 있는 칸만 column이 있다. 나머지 칸(보완, 선진행 동의, 대여·용역 이행, 환불)은 그 기록이 생기면 채운다.
type Lane = { label: string; column?: BoardColumn }
type Area = { label: string; flow: Lane[]; exceptions: Lane[] }

const ORDER_CANCEL: Lane = { label: '주문 취소 요청 확인' }

export const AREAS: Record<PurchaseArea, Area> = {
  review: {
    label: '요청 검토',
    flow: [{ label: '검토 대기', column: 'review' }],
    exceptions: [{ label: '보완 응답 대기' }, { label: '재검토 대기' }],
  },
  ready: {
    label: '구매 준비',
    flow: [{ label: '선진행 동의 대기' }, { label: '주문 대기', column: 'ready' }],
    exceptions: [{ label: '재주문 보류' }, { label: '구매 불가 처리 필요' }],
  },
  goods: {
    label: '물품 배송·수령',
    flow: [
      { label: '배송 대기' },
      { label: '배송 중', column: 'progress' },
      { label: '수령 확인 필요' },
    ],
    exceptions: [ORDER_CANCEL],
  },
  rental: {
    label: '대여 이행',
    flow: [{ label: '이행 대기' }, { label: '이행 중' }, { label: '반납 확인 필요' }],
    exceptions: [ORDER_CANCEL],
  },
  service: {
    label: '용역 이행',
    flow: [{ label: '이행 대기' }, { label: '이행 중' }],
    exceptions: [ORDER_CANCEL],
  },
  refund: {
    label: '환불',
    flow: [{ label: '환불 대기' }, { label: '환불 확인' }],
    exceptions: [{ label: '재주문 판단' }],
  },
}

export const laneCards = (cards: readonly BoardCard[], lane: Lane) =>
  lane.column ? cards.filter(card => columnOf(card) === lane.column) : []

export const areaCount = (cards: readonly BoardCard[], area: PurchaseArea) =>
  [...AREAS[area].flow, ...AREAS[area].exceptions].reduce(
    (sum, lane) => sum + laneCards(cards, lane).length,
    0,
  )
