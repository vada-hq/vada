import { createCallbackAddress } from './webhook.js'

export function trackingConfig(env: NodeJS.ProcessEnv) {
  if (env.DELIVERY_TRACKING_ENABLED !== 'true') return null
  try {
    if (env.DELIVERY_ENABLED !== 'true' || !env.DELIVERY_TRACKER_CLIENT_ID?.trim() || !env.DELIVERY_TRACKER_CLIENT_SECRET?.trim()) throw new Error()
    return { address: createCallbackAddress(env.DELIVERY_PUBLIC_URL ?? '', env.DELIVERY_WEBHOOK_SECRET ?? '') }
  } catch { throw new Error('INVALID_DELIVERY_TRACKING_CONFIGURATION') }
}
