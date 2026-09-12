import { OPSCAL01Screen } from '../OPSCAL01Screen'
import { OPS00Screen } from '../OPS00Screen'
import { TASK01Screen } from '../TASK01Screen'
import type { ScreenRegistration } from './types'

export const operationsScreens = [
  {
    screenIds: ['OPS-00'],
    render: ({ onNavigate }) => {
      // 운영 허브다. 고를 것은 갈 곳뿐이라 상태 스코프를 참조하지 않는다.
      return <OPS00Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-CAL-01'],
    render: ({ onNavigate }) => {
      // 읽기 전용 캘린더다. 좁혀 보는 값은 화면 안의 조회 인자라 스코프에 담지 않는다.
      return <OPSCAL01Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['TASK-01'],
    render: ({ onNavigate }) => {
      // 칸반 보드다. 보는 범위는 목록을 거르는 화면 안의 값이라 스코프에 담지 않는다.
      return <TASK01Screen onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
