import { useState } from 'react'
import {
  CalendarDays,
  CircleDot,
  Clock,
  Download,
  Eye,
  Landmark,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  QrCode as QrIcon,
  ScanLine,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import type { FormActivationCondition } from '@vada/contracts'
import { valuesOfForm } from '../../registration-form'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { MainButton, MoreMenu, PageIcon, PropRow, StatusMark, TextAction, type Tone } from './parts'
import { CountValue, Items, LinkValue, Missing } from './card-values'
import { PreviewSheet } from './preview'
import { PosterQr, QrSheet } from './qr'
import { radius, shadow, size, space, type } from './tokens'

// 양식 카드 = 회색 쟁반 위 문서 한 장. 안은 편집기와 같은 속성 줄이다(한 문법).
// 빠진 조건은 따로 체크리스트를 두지 않고 그 줄의 값 자리에 '비어 있음 · 채우기'로 보인다(값 자리의 '비어 있음' 축).
// 활성이면 '공개 링크'·'포스터용 QR' 줄이 상태·신청 바로 아래로 올라온다(K3).

const isDraft = ({ form }: CardForm) => form.paused && form.applicantCount === 0

function toneOf(item: CardForm): Tone {
  if (isDraft(item)) return 'draft'
  if (item.form.status === 'open') return 'open'
  return item.form.status === 'paused' ? 'paused' : 'closed'
}

type Fill = (condition: FormActivationCondition) => void

function StatusRows({ item, tone }: { item: CardForm; tone: Tone }) {
  const missing = item.conditions.filter(condition => !condition.done).length
  return (
    <>
      <PropRow icon={CircleDot} label="상태">
        <span className="flex flex-wrap items-center gap-x-2">
          <StatusMark tone={tone} label={item.text.status} />
          {tone === 'draft' && missing > 0 && (
            <span className="text-fg-muted">빠진 칸 {missing}개</span>
          )}
        </span>
      </PropRow>
      <PropRow icon={Users} label="신청">
        <CountValue item={item} />
      </PropRow>
    </>
  )
}

function ShareRows({ item, props, tone }: { item: CardForm; props: BuilderProps; tone: Tone }) {
  const [big, setBig] = useState(false)
  if (!item.text.link) return null
  return (
    <>
      <PropRow icon={Link2} label="공개 링크">
        <LinkValue item={item} props={props} main={tone === 'open'} />
      </PropRow>
      <PropRow icon={QrIcon} label="포스터용 QR">
        <span className="flex flex-wrap items-center gap-x-2 py-1">
          <PosterQr link={item.text.link} name={item.form.name} onOpen={() => setBig(true)} />
          <TextAction icon={Download} onClick={() => props.onSaveQr(item.form.id)}>
            QR 저장
          </TextAction>
        </span>
      </PropRow>
      {big && (
        <QrSheet
          link={item.text.link}
          name={item.form.name}
          onSave={() => props.onSaveQr(item.form.id)}
          onClose={() => setBig(false)}
        />
      )}
    </>
  )
}

function SettingRows({ item, props, fill }: { item: CardForm; props: BuilderProps; fill: Fill }) {
  const done = (key: FormActivationCondition) =>
    item.conditions.find(c => c.key === key)?.done ?? true
  const draft = isDraft(item)
  const { text } = item
  return (
    <>
      {draft && (
        <PropRow icon={CalendarDays} label="행사 일시">
          {done('event_starts_at') ? (
            <span className="text-fg-secondary">
              {props.data.eventText.when} · {props.data.eventText.place}
            </span>
          ) : (
            <Missing onFill={() => props.onEditEvent('startsAt')} />
          )}
        </PropRow>
      )}
      <PropRow icon={Clock} label="신청 마감">
        {done('closes_at') ? (
          <span className="flex flex-wrap items-center gap-x-2">
            {text.period}
            {!done('registration_period') && (
              <>
                <span className="text-danger">신청 시작보다 이름</span>
                <TextAction strong onClick={() => fill('registration_period')}>
                  고치기
                </TextAction>
              </>
            )}
          </span>
        ) : (
          <Missing onFill={() => fill('closes_at')} />
        )}
      </PropRow>
      <PropRow icon={Wallet} label="참가비">
        {text.fee}
      </PropRow>
      {text.account !== '계좌 없음' && (
        <PropRow icon={Landmark} label="참가비 받을 계좌">
          {text.account ?? <Missing onFill={() => fill('fee_account')} />}
        </PropRow>
      )}
      <PropRow icon={UserRound} label="정원">
        {text.capacity}
      </PropRow>
      <PropRow icon={ListChecks} label="받는 항목">
        <Items item={item} />
      </PropRow>
    </>
  )
}

function Head({
  item,
  props,
  onPreview,
}: {
  item: CardForm
  props: BuilderProps
  onPreview: () => void
}) {
  const { form } = item
  const canPause = form.status === 'open' && form.actions.includes('form.pause')
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <PageIcon />
      <h3 className={`min-w-0 flex-1 ${type.cardTitle} text-fg wrap-anywhere`}>{item.text.name}</h3>
      <div className="flex items-center max-sm:-ml-2 max-sm:w-full sm:-mr-2">
        <TextAction icon={Eye} onClick={onPreview}>
          미리보기
        </TextAction>
        {form.actions.includes('form.update') && (
          <TextAction icon={Pencil} onClick={() => props.onEdit(form.id)}>
            고치기
          </TextAction>
        )}
        {canPause && (
          <MoreMenu
            label="양식 더보기"
            items={[{ label: '멈추기', onPick: () => props.onPause(form.id) }]}
          />
        )}
      </div>
    </div>
  )
}

// 상태마다 주 행동 하나: 초안(다 참) [설문 링크 활성화], 잠시 멈춤 [다시 받기]. 활성의 주 행동은 [링크 복사](강조 글자).
function MainAction({ item, props }: { item: CardForm; props: BuilderProps }) {
  const { form } = item
  const allDone = item.conditions.every(condition => condition.done)
  if (isDraft(item) && allDone && form.actions.includes('form.activate'))
    return (
      <MainButton wide onClick={() => props.onActivate(form.id)}>
        설문 링크 활성화
      </MainButton>
    )
  if (!isDraft(item) && form.status === 'paused' && form.actions.includes('form.resume'))
    return (
      <MainButton wide onClick={() => props.onResume(form.id)}>
        다시 받기
      </MainButton>
    )
  return null
}

function FormSheet({ item, props }: { item: CardForm; props: BuilderProps }) {
  const [previewing, setPreviewing] = useState(false)
  const tone = toneOf(item)
  const fill: Fill = condition => props.onFill(item.form.id, condition)
  return (
    <article
      aria-label={item.text.name}
      className={`mx-auto flex w-full ${size.sheet} flex-col gap-4 bg-white ${radius.sheet} ${space.sheet} ${shadow.sheet}`}
    >
      <Head item={item} props={props} onPreview={() => setPreviewing(true)} />
      <div className="flex flex-col gap-1 sm:gap-0">
        <StatusRows item={item} tone={tone} />
        <ShareRows item={item} props={props} tone={tone} />
        <SettingRows item={item} props={props} fill={fill} />
      </div>
      <MainAction item={item} props={props} />
      {previewing && (
        <PreviewSheet
          values={valuesOfForm(item.form)}
          event={props.data.event}
          councilName={props.data.councilName}
          onClose={() => setPreviewing(false)}
        />
      )}
    </article>
  )
}

function Toolbar(props: BuilderProps) {
  const creatable = props.data.listActions.includes('form.create')
  const scannable = props.data.forms.some(item => item.form.actions.includes('form.check_in'))
  return (
    <div
      className={`mx-auto flex w-full ${size.sheet} flex-wrap items-center gap-x-1 px-2 sm:px-0`}
    >
      <h2 className={`mr-auto ${type.small} font-semibold text-fg-tertiary`}>신청 양식</h2>
      {creatable && (
        <TextAction icon={Plus} onClick={props.onCreate}>
          참여 설문 만들기
        </TextAction>
      )}
      {scannable && (
        <TextAction icon={ScanLine} onClick={props.onScan}>
          QR로 출석 확인
        </TextAction>
      )}
    </div>
  )
}

function EmptySheet(props: BuilderProps) {
  return (
    <article
      className={`mx-auto flex w-full ${size.sheet} flex-col items-center gap-5 bg-white px-4 py-10 text-center sm:py-12 ${radius.sheet} ${shadow.sheet}`}
    >
      <div className="flex flex-col items-center gap-3">
        <PageIcon large />
        <h3 className={`${type.cardTitle} text-fg`}>신청 양식 없음</h3>
      </div>
      {props.data.listActions.includes('form.create') && (
        <MainButton onClick={props.onCreate}>
          <Plus aria-hidden className="size-4" />
          참여 설문 만들기
        </MainButton>
      )}
    </article>
  )
}

export function CardScreen(props: BuilderProps) {
  const { forms } = props.data
  return (
    <section
      aria-label="신청 양식"
      className={`flex flex-col gap-3 bg-surface-muted ${radius.tray} ${space.tray}`}
    >
      {forms.length > 0 && <Toolbar {...props} />}
      {forms.length === 0 ? (
        <EmptySheet {...props} />
      ) : (
        forms.map(item => <FormSheet key={item.form.id} item={item} props={props} />)
      )}
    </section>
  )
}
