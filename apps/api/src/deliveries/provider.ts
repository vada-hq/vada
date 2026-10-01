import type { DeliveryCarriersResponse, DeliveryLookupRequest, DeliveryLookupResponse } from '@vada/contracts'

export interface DeliveryProvider {
  carriers(after?: string, search?: string): Promise<DeliveryCarriersResponse>
  lookup(input: DeliveryLookupRequest): Promise<DeliveryLookupResponse>
}

export interface TrackingProvider {
  lookup(input: DeliveryLookupRequest): Promise<DeliveryLookupResponse>
  register(input: DeliveryLookupRequest & { callbackUrl: string; expirationTime: string }): Promise<void>
}
