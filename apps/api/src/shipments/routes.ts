import { Hono, type Context } from 'hono'
import {
  ShipmentSchema,
  CancelShipmentSchema,
  type ShipmentResponse,
  type ShipmentTrackingResponse,
} from '@vada/contracts'
import { authorize, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { json } from '../http/validate.js'
import { requestRowOf } from '../purchases/queries.js'
import { shipmentRowOf } from './queries.js'
import { saveShipment, cancelShipment } from './service.js'
import { createTracking, trackingUrlOf } from './tracking.js'
import type { DeliveryLookup } from './provider.js'
import type { ShipmentCarrier } from '@vada/contracts'

const ROOT = '/organizations/:councilId/purchase-requests/:requestId/shipments'
const CREATED = 201
const targetOf = (c: Context<SessionEnv>) => ({
  requestId: recordIdOf(c.req.param('requestId')),
  shipmentId: recordIdOf(c.req.param('shipmentId')),
})

export function createShipmentRoutes(
  db: Db,
  session: SessionReader,
  options: { clock?: () => Date; lookup?: DeliveryLookup | undefined } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(session)
  const track = createTracking({ ...options, clock })
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.post(ROOT, json(ShipmentSchema), auth, async c => {
    const input = c.req.valid('json')
    const target = { requestId: recordIdOf(c.req.param('requestId')) }
    const shipment = await inCouncilChange(db, asked(c), (tx, actor) =>
      saveShipment(tx, actor, target, input),
    )
    return c.json({ shipment } satisfies ShipmentResponse, CREATED)
  })
  routes.post(`${ROOT}/:shipmentId`, json(ShipmentSchema), auth, async c => {
    const input = c.req.valid('json')
    const target = targetOf(c)
    const shipment = await inCouncilChange(db, asked(c), (tx, actor) =>
      saveShipment(tx, actor, target, input),
    )
    return c.json({ shipment } satisfies ShipmentResponse)
  })
  routes.post(`${ROOT}/:shipmentId/cancel`, json(CancelShipmentSchema), auth, async c => {
    const input = c.req.valid('json')
    const target = targetOf(c)
    const shipment = await inCouncilChange(db, asked(c), (tx, actor) =>
      cancelShipment(tx, actor, target, input),
    )
    return c.json({ shipment } satisfies ShipmentResponse)
  })
  addTrackingRoute({ routes, auth, db, track, asked })
  return routes
}

type TrackingKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  db: Db
  track: ReturnType<typeof createTracking>
  asked: (c: Context<SessionEnv>) => {
    userId: string
    councilId: string | undefined
    action: 'council.view'
    now: Date
  }
}
function addTrackingRoute({ routes, auth, db, track, asked }: TrackingKit) {
  routes.get(`${ROOT}/:shipmentId/tracking`, auth, async c => {
    const target = targetOf(c)
    const shipment = await db.transaction(
      async tx => {
        const actor = await authorize(tx, { ...asked(c), councilId: c.req.param('councilId') })
        await requestRowOf(tx, actor, target.requestId)
        return shipmentRowOf(tx, actor, target)
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    )
    const parcel = {
      carrierId: shipment.carrierId as ShipmentCarrier,
      trackingNumber: shipment.trackingNumber,
    }
    return c.json(
      (shipment.cancelledAt
        ? { lastEvent: null, reason: 'cancelled', trackingUrl: trackingUrlOf(parcel.carrierId) }
        : await track(parcel)) satisfies ShipmentTrackingResponse,
    )
  })
}
