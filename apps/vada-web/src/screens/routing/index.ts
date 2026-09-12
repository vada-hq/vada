import { accessScreens } from './access'
import { homeScreens } from './home'
import { operationsScreens } from './operations'
import { meetingsScreens } from './meetings'
import { eventsScreens } from './events'
import { financeScreens } from './finance'
import { organizationScreens } from './organization'
import { publicScreens } from './public'
import { recordsScreens } from './records'
import { messagesScreens } from './messages'
import { createScreenRegistry } from './registry'

// 화면 추가·연결 변경은 해당 업무 등록부에서 한다.
export const SCREEN_RENDERERS = createScreenRegistry([
  accessScreens,
  homeScreens,
  operationsScreens,
  meetingsScreens,
  eventsScreens,
  financeScreens,
  organizationScreens,
  publicScreens,
  recordsScreens,
  messagesScreens,
])
