import { Calendar, Check, CircleAlert, ClipboardList, Receipt, Star } from 'lucide-react'
import FeaturedEvents, { type TilesRead } from '@/home/FeaturedEvents'
import HomeCard, { type CardRead } from '@/home/HomeCard'
import HomeFrame from '@/home/HomeFrame'
import HomeGreeting from '@/home/HomeGreeting'
import { CouncilLayout, GridLayout } from '@/home/HomeLayout'
import { Section } from './GallerySection'
import {
  AssignBand,
  asOf,
  eventTiles,
  failed,
  inbox,
  issues,
  loading,
  mineRows,
  noop,
  MORE_THAN_SHOWN,
  participatingRows,
  PushBand,
  ready,
  schedule,
  shortcut,
  tilesRead,
  today,
  whoCreates,
  Width,
} from './home-frame-samples'

// 홈 틀과 공통 부품(기능 027 조각 5, DEC-95). 실제 홈은 아직 바꾸지 않았다.

// 회장단(HOME-01C): 메시지함은 인사 카드 오른쪽, 주요 행사 타일 없음, 행사 현황(가로 전체) → 3열.
function CouncilHome({ read }: { read?: CardRead }) {
  return (
    <HomeFrame
      asOf={asOf}
      today={today}
      greeting={
        <HomeGreeting
          today={today}
          name="김바다"
          description="학생회 행사와 확인할 일을 봐요"
          inbox={inbox}
          shortcuts={shortcut}
        />
      }
    >
      <CouncilLayout
        top={
          <HomeCard
            title="전체 행사 진행 현황"
            icon={Star}
            unit="개"
            tiles
            read={read ?? ready(eventTiles)}
            aside="기획 중 3 · 진행 중 1 · 후속 정리 중 0"
            empty="진행할 행사 없음"
          />
        }
        columns={[
          <HomeCard
            key="a"
            title="확인이 필요한 운영 상황"
            icon={CircleAlert}
            read={read ?? ready(issues, MORE_THAN_SHOWN)}
            empty="확인할 일 없음"
            onSeeAll={noop}
            footnote={{ label: '미배정 구성원', text: '2명', onOpen: noop }}
          />,
          <HomeCard
            key="b"
            title="후속 정리 중인 행사"
            icon={Check}
            unit="개"
            read={read ?? ready([])}
            empty="후속 정리 중인 행사 없음"
          />,
          <HomeCard
            key="c"
            title="가까운 주요 일정"
            icon={Calendar}
            read={read ?? ready(schedule)}
            empty="7일 안 일정 없음"
          />,
        ]}
      />
    </HomeFrame>
  )
}

type MemberProps = { tiles?: TilesRead; read?: CardRead; firstDay?: boolean }

// 부원(HOME-01M): 인사 카드(메시지함, 주요 행사 타일 3) → 2×2.
function MemberHome({ tiles = tilesRead, read, firstDay = false }: MemberProps) {
  return (
    <HomeFrame
      asOf={asOf}
      today={today}
      assignBand={firstDay && <AssignBand />}
      pushBand={firstDay && <PushBand />}
      greeting={
        <HomeGreeting
          today={today}
          name="정하늘"
          description="학생회 주요 행사와 참여 행사·일정을 봐요"
          inbox={inbox}
          featured={<FeaturedEvents read={tiles} />}
        />
      }
    >
      <GridLayout
        cards={[
          <HomeCard
            key="a"
            title="참여 행사 진행"
            icon={Star}
            unit="개"
            read={read ?? ready(firstDay ? [] : participatingRows)}
            empty="참여 행사 없음"
            emptyAction={whoCreates}
          />,
          <HomeCard
            key="b"
            title="가까운 일정"
            icon={Calendar}
            read={read ?? ready(schedule, MORE_THAN_SHOWN)}
            empty="7일 안 일정 없음"
          />,
          <HomeCard
            key="c"
            title="내 요청"
            icon={Receipt}
            read={read ?? ready([])}
            empty="내 요청 없음"
          />,
          <HomeCard
            key="d"
            title="내 업무·메시지"
            icon={ClipboardList}
            read={read ?? ready(mineRows)}
            aside="바로가기"
            empty="맡은 업무 없음"
          />,
        ]}
      />
    </HomeFrame>
  )
}

export function HomeFrameSection() {
  return (
    <Section title="홈 틀·인사 카드·카드">
      <Width
        label="1280px 창(회장단: 5건 전체 보기, 0건, 3건, 미배정 조건부 줄)"
        className="w-248 shrink-0"
      >
        <CouncilHome />
      </Width>
      <Width label="1024px 창(회장단)" className="w-184 shrink-0">
        <CouncilHome />
      </Width>
      <Width label="420px 창(회장단, 읽기 실패)" className="w-97 shrink-0">
        <CouncilHome read={failed} />
      </Width>
      <Width label="1280px 창(부원)" className="w-248 shrink-0">
        <MemberHome />
      </Width>
      <Width label="1024px 창(부원, 읽기 전)" className="w-184 shrink-0">
        <MemberHome tiles={{ kind: 'loading' }} read={loading} />
      </Width>
      <Width label="420px 창(막 들어온 운영진: 띠 둘, 참여 행사 없음)" className="w-97 shrink-0">
        <MemberHome firstDay />
      </Width>
    </Section>
  )
}
