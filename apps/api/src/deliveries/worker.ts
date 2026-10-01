import type { TrackingProvider } from './provider.js'
import type { createDeliveryJobs } from './job-repository.js'
import type { CallbackAddress } from './webhook.js'

export function createDeliveryWorker(jobs: ReturnType<typeof createDeliveryJobs>, provider: TrackingProvider, address: CallbackAddress, clock = () => new Date()) {
  return {
    async runOne() {
      const claim = await jobs.claim()
      if (!claim) return false
      const { shipment, job } = claim
      const input = { carrierId: shipment.carrierId, trackingNumber: shipment.trackingNumber }
      let outcome: Parameters<typeof jobs.finish>[1]
      try {
        if (job.kind === 'unregister') {
          // 원격 만료를 앞당기면 늦게 도착한 해제가 재등록을 취소할 수 있다.
          // 비활성 URL은 수신만 ACK하고 갱신 중단 + 최대 48시간 TTL로 해제한다.
          outcome = { kind: shipment.trackingActive ? 'skip' : 'unregister' }
        } else if (!shipment.trackingActive) outcome = { kind: 'skip' }
        else if (job.kind === 'register') {
          const expiresAt = new Date(clock().getTime() + 48 * 60 * 60 * 1000)
          await provider.register({ ...input, callbackUrl: address.url(shipment.id), expirationTime: expiresAt.toISOString() })
          outcome = { kind: 'register', expiresAt }
        } else outcome = { kind: 'refresh', result: await provider.lookup(input) }
      } catch { outcome = { kind: 'error' } }
      // DB 실패는 외부 실패로 바꾸지 않는다. lease 만료 후 안전하게 회수한다.
      await jobs.finish(claim, outcome)
      return true
    },
  }
}
