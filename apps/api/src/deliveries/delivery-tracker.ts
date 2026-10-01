import type { DeliveryProvider, TrackingProvider } from './provider.js'
import { DeliveryError } from './validation.js'
import { deliveryStatus } from './status.js'

type Options = { clientId?: string; clientSecret?: string; fetch?: typeof fetch }
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
  return value as Record<string, unknown>
}
function string(value: unknown, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
  return value
}
export function createDeliveryTracker(options: Options): DeliveryProvider & TrackingProvider {
  const request = options.fetch ?? fetch
  async function graphql(query: string, variables: Record<string, unknown>) {
    if (!options.clientId?.trim() || !options.clientSecret?.trim()) throw new DeliveryError('DELIVERY_NOT_CONFIGURED', 503)
    try {
      const response = await request('https://apis.tracker.delivery/graphql', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `TRACKQL-API-KEY ${options.clientId}:${options.clientSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
      if (!response.ok) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
      const body = record(await response.json())
      if (body.errors && (!Array.isArray(body.errors) || body.errors.length)) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
      return record(body.data)
    } catch { throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502) }
  }
  return {
    async register(input) {
      const data = await graphql('mutation($input: RegisterTrackWebhookInput!) { registerTrackWebhook(input: $input) }', { input })
      if (data.registerTrackWebhook !== true) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
    },
    async lookup(input) {
      const data = await graphql(`query($carrierId: ID!, $trackingNumber: String!) {
        track(carrierId: $carrierId, trackingNumber: $trackingNumber) { lastEvent { time status { code } } }
      }`, { carrierId: input.carrierId, trackingNumber: input.trackingNumber })
      if (data.track === null) throw new DeliveryError('DELIVERY_NOT_FOUND', 404)
      const track = record(data.track)
      const checkedAt = new Date().toISOString()
      if (track.lastEvent === null) return { status: 'unknown', providerStatus: null, lastEventAt: null, checkedAt }
      const event = record(track.lastEvent)
      const providerStatus = string(record(event.status).code, 100)
      const time = string(event.time, 100)
      if (!/^\d{4}-\d{2}-\d{2}T/.test(time) || !Number.isFinite(Date.parse(time))) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
      return { status: deliveryStatus(providerStatus), providerStatus, lastEventAt: new Date(time).toISOString(), checkedAt }
    },
    async carriers(after, search) {
      const data = await graphql(`query($after: String, $search: String) {
        carriers(first: 50, after: $after, searchText: $search) { edges { node { id name } } pageInfo { hasNextPage endCursor } }
      }`, { after: after ?? null, search: search ?? null })
      const connection = record(data.carriers)
      if (!Array.isArray(connection.edges) || connection.edges.length > 50) throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
      const carriers = connection.edges.map(edge => {
        const node = record(record(edge).node)
        return { id: string(node.id, 100), name: string(node.name, 200) }
      })
      const page = record(connection.pageInfo)
      if (typeof page.hasNextPage !== 'boolean') throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502)
      return { carriers, nextCursor: page.hasNextPage ? string(page.endCursor, 2000) : null }
    },
  }
}
