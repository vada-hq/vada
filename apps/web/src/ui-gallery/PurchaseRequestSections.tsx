import { useState } from 'react'
import type { ProductInfo } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProductPreview } from '@/finance/ProductPreview'
import { PurchaseColumns } from '@/finance/PurchaseColumns'
import { RequestEstimateFields } from '@/finance/RequestEstimateFields'
import { RequestSummary } from '@/finance/RequestSummary'
import { emptyRequest } from '@/finance/request-form'
import { Section } from './GallerySection'
import { RequestProgress } from '@/finance/RequestProgress'
import { purchaseDetail } from '@/test-support/purchase-fixtures'

const product: ProductInfo = {
  name: '행사 안내판용 네임펜, 검정 12개 1세트',
  selectedItemId: '11',
  items: [{ itemId: '11', name: '검정 12개 1세트', price: 9900, listPrice: 12000 }],
  shipping: '무료배송',
  deliveryEta: '내일 도착 예정',
  rocket: true,
  inStock: true,
  imageUrl: null,
  fetchedAt: '2026-10-27T01:00:00.000Z',
}
const progressRequest = purchaseDetail('sample', { status: 'approved' })
progressRequest.items = progressRequest.items.map(item => ({
  ...item,
  status: 'approved',
  paid: false,
}))

// 실제 부품의 열 배치·긴 상품명·사진 없음·배송비 미확인. 외부 API나 저장은 부르지 않는다.
export function PurchaseRequestSection() {
  const [values, setValues] = useState(() => {
    const initial = emptyRequest()
    return {
      ...initial,
      title: '새내기 배움터 준비물 구매',
      neededBy: '2026-11-02',
      items: initial.items.map(item => ({
        ...item,
        name: product.name,
        quantity: '2',
        loadedPrice: 9900,
        loadedProduct: product,
        estimatedUnitPrice: '9900',
      })),
    }
  })
  const item = values.items[0]!
  return (
    <Section title="구매 요청 작성 페이지">
      <nav className="text-xs text-fg-muted">구매 / 구매 요청 / 새 요청</nav>
      <PurchaseColumns
        summary={
          <>
            <RequestSummary values={values} />
            <div className="flex justify-end gap-2">
              <Button variant="outline">취소</Button>
              <Button>내기</Button>
            </div>
          </>
        }
      >
        <div className="flex flex-col gap-3 rounded-sm border bg-white p-4">
          <h3 className="font-semibold">기본 정보</h3>
          <Field label="제목" required>
            <Input
              value={values.title}
              onChange={event => setValues({ ...values, title: event.target.value })}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-3 rounded-sm border bg-white p-4">
          <h3 className="font-semibold">요청 품목</h3>
          <ProductPreview product={product} />
          <RequestEstimateFields
            item="품목 1"
            values={item}
            disabled={false}
            errors={{}}
            onChange={next =>
              setValues({
                ...values,
                items: [{ ...next, loadedPrice: 9900, loadedProduct: product }],
              })
            }
          />
        </div>
      </PurchaseColumns>
      <h3 className="text-sm font-semibold">요청 진행 · 결재 후 결제 대기</h3>
      <RequestProgress request={progressRequest} />
    </Section>
  )
}
