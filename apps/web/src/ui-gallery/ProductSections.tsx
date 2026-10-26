import { useState } from 'react'
import type { ChatMessage, ProductInfo } from '@vada/contracts'
import MessageItem from '@/chat/MessageItem'
import type { ProductState } from '@/chat/product-info'
import { ProductOpenContext, type ProductTarget } from '@/chat/product-open'
import ProductDetails from '@/chat/ProductDetails'
import { ProductPanelFrame } from '@/chat/ProductPanel'
import { Button } from '@/components/ui/button'
import { Section } from './GallerySection'

const noop = () => {}
const COUPANG = 'https://www.coupang.com/vp/products/7334523?itemId=18698271&vendorItemId=85839281'
const OTHER = 'https://smartstore.naver.com/booth/products/4417'
const SAMPLE: ProductInfo = {
  name: '모나미 네임펜 F 12색 세트, 행사 부스 안내판·이름표용 유성 마커 대용량 묶음',
  items: [
    { itemId: '18698271', name: '12색 1세트', price: 9900, listPrice: 12000 },
    { itemId: '18698272', name: '24색 1세트', price: 17800, listPrice: 17800 },
    {
      itemId: '18698273',
      name: '12색 3세트(학교·단체 묶음 특가 구성)',
      price: 27500,
      listPrice: null,
    },
  ],
  selectedItemId: '18698271',
  shipping: '무료배송',
  deliveryEta: '내일(화) 도착 보장',
  rocket: true,
}
const STATES: { label: string; state: ProductState }[] = [
  { label: '불러옴', state: { kind: 'ready', product: SAMPLE } },
  { label: '불러오는 중', state: { kind: 'loading' } },
  { label: '실패', state: { kind: 'none' } },
]

const sample = (id: string, body: string, options: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderId: 'g-ha',
  senderName: '정하늘',
  body,
  sentAt: '2026-10-23T00:30:00Z',
  deletedAt: null,
  photos: [],
  made: [],
  replyCount: 0,
  lastReplyAt: null,
  ...options,
})
const MESSAGES: ChatMessage[] = [
  sample('p1', `부스 이름표용으로 이거 사 주세요\n${COUPANG}\n${OTHER}`),
  // 요청이 막고(대기 중), 지출은 취소돼 막지 않는다: 메뉴는 '구매 요청 보기'와 '지출 적기'다.
  sample('p2', '현수막 2개 주문해 주세요. 디자인은 드라이브에 있어요.', {
    made: [
      { kind: 'purchase_request', id: 'g-r1', title: '현수막 2개 주문', blocking: true },
      { kind: 'expense', id: 'g-e1', title: '현수막 계약금(취소)', blocking: false },
    ],
  }),
  // 지출만 막는다: '구매 요청 만들기'와 '지출 보기'.
  sample('p3', '테이블 대여비 영수증이에요', {
    senderId: 'g-me',
    senderName: '박해랑',
    made: [{ kind: 'expense', id: 'g-e2', title: '테이블 8개 대여비', blocking: true }],
  }),
]

function Flow() {
  return (
    <ul className="mt-auto flex flex-col">
      {MESSAGES.map(item => (
        <MessageItem
          key={item.id}
          councilId="sample"
          message={item}
          continued={false}
          mine={item.senderId === 'g-me'}
          canRequest
          onRequest={noop}
          canWriteExpense
          onWriteExpense={noop}
        />
      ))}
    </ul>
  )
}

// 상품 정보 패널(022 조각 6, 와이어프레임 P-15): 쿠팡 상품 링크를 누르면 오른쪽(1280px 이상은 본문 옆, 768~1279px은 겹쳐, 휴대폰은 전체 화면)에 열린다.
// 다른 링크(스마트스토어)는 새 탭이다. 메시지 아래에는 만든 기록이 있고, 막힌 메시지의 '…'는 '구매 요청 보기'·'지출 보기'다.
// 실제 상품 읽기 대신 고른 상태(불러옴, 불러오는 중, 실패)를 넣는다.
export function ProductPanelSection() {
  const [open, setOpen] = useState<{ url: string; state: ProductState } | null>(null)
  const opener = (target: ProductTarget) => setOpen({ url: target.url, state: STATES[0]!.state })
  return (
    <Section title="상품 정보 패널">
      <ProductOpenContext value={opener}>
        {STATES.map(({ label, state }) => (
          <Button key={label} variant="outline" onClick={() => setOpen({ url: COUPANG, state })}>
            {`상품 정보 열기 (${label})`}
          </Button>
        ))}
        <div className="flex h-160 w-full overflow-hidden rounded-lg border bg-white">
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
            <h3 className="text-base font-semibold text-gray-900">기획부 방</h3>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <Flow />
            </div>
          </div>
          {open && (
            <ProductPanelFrame focusKey={open.url} onClose={() => setOpen(null)}>
              <ProductDetails
                state={open.state}
                url={open.url}
                request={<Button touch>구매 요청 만들기</Button>}
              />
            </ProductPanelFrame>
          )}
        </div>
      </ProductOpenContext>
    </Section>
  )
}
