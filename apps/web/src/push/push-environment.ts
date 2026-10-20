import { deviceOf, isIosHomeScreenApp, type Device } from '@/lib/platform'
import { browserPush, type PushBrowser } from './push-client'

export type PushEnvironment = { browser: PushBrowser; device: Device; homeScreenApp: boolean }

export const currentEnvironment = (): PushEnvironment => ({
  browser: browserPush(),
  device: deviceOf(navigator.userAgent, navigator.maxTouchPoints),
  homeScreenApp: isIosHomeScreenApp(navigator as { standalone?: boolean }),
})
