import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { shipments } from '../db/schema.js'
import type { DeliveryDatabase } from './database.js'
import { enqueueDeliveryJob } from './job-repository.js'

// URL 소유 확인용 capability이며 Delivery Tracker의 발신자 서명이 아니다.
export function createCallbackAddress(baseURL: string, secret: string) {
  const origin = new URL(baseURL)
  if (secret.trim().length < 32 || secret.length > 1024 || origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('INVALID_DELIVERY_WEBHOOK_CONFIGURATION')
  // 늦은 외부 등록 응답이 새 콜백 URL을 과거 URL로 교체하지 않도록 배송별 URL은 고정한다.
  const token = (id: string) => createHmac('sha256', secret).update(JSON.stringify(['delivery-callback-v1', id])).digest('hex')
  return {
    url: (id: string) => `${origin.origin}/api/delivery-webhooks/${encodeURIComponent(id)}/${token(id)}`,
    verify(id: string, candidate: string) {
      return /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(token(id), 'hex'))
    },
  }
}
export type CallbackAddress = ReturnType<typeof createCallbackAddress>

export function createDeliveryWebhook(db: DeliveryDatabase, address: CallbackAddress, clock = () => new Date()) {
  const routes = new Hono()
  routes.onError((_, c) => c.json({ error: 'DELIVERY_CALLBACK_UNAVAILABLE' }, 503))
  routes.post('/delivery-webhooks/:shipmentId/:token', bodyLimit({ maxSize: 4096, onError: c => c.body(null, 413) }), async c => {
    c.header('Cache-Control', 'no-store')
    const id = c.req.param('shipmentId')
    if (id.length > 200 || !address.verify(id, c.req.param('token'))) return c.body(null, 404)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return c.body(null, 415)
    let body: unknown
    try { body = await c.req.json() } catch { return c.body(null, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.body(null, 400)
    const value = body as Record<string, unknown>
    // 실제 공급자는 문서에 없는 필드(projectId 등)를 함께 보낸다. 모르는 필드는 읽지도 저장하지도 않는다.
    if (typeof value.carrierId !== 'string' || typeof value.trackingNumber !== 'string') return c.body(null, 400)
    const accepted = await db.transaction(async tx => {
      const [row] = await tx.select().from(shipments).where(eq(shipments.id, id)).for('update')
      // 유효했던 과거 URL은 ACK만 하여 외부 무한 재시도를 유발하지 않는다.
      if (!row || !row.trackingActive) return true
      if (value.carrierId !== row.carrierId || value.trackingNumber !== row.trackingNumber) return false
      const now = clock()
      const runAfter = new Date(Math.max(now.getTime(), (row.lastAttemptAt?.getTime() ?? 0) + 60_000))
      await enqueueDeliveryJob(tx, id, 'refresh', runAfter)
      return true
    })
    return c.body(null, accepted ? 202 : 400)
  })
  return routes
}
