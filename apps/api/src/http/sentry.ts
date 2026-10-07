import * as Sentry from '@sentry/node'
import type { ErrorEvent, NodeOptions } from '@sentry/node'
import { setErrorReporter } from './on-error.js'

// 오류 종류·스택·태그만 보낸다. 메시지·요청·사용자·브레드크럼·추가 데이터·서버 이름은 비밀이나 개인정보를 담을 수 있어 지운다.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.message
  delete event.server_name
  delete event.request
  delete event.user
  delete event.breadcrumbs
  delete event.extra
  for (const exception of event.exception?.values ?? []) delete exception.value
  return event
}

// SENTRY_DSN이 있을 때만 켠다. 자동 계측은 쓰지 않고, 서버 쪽 실패만 직접 보낸다. transport는 테스트에서만 바꾼다.
export function startErrorReporting(dsn: string | undefined, environment: string, transport?: NodeOptions['transport']) {
  const value = dsn?.trim()
  if (!value) return false
  // OTLP 주소처럼 DSN이 아닌 값이면 SDK가 조용히 꺼지므로, 켜지 않고 원인만 남긴다(값은 남기지 않는다).
  if (!/^https?:\/\/[^@/\s]+@[^/\s]+\/\d+$/.test(value)) {
    console.error('SENTRY_DSN 형식이 DSN이 아니라 오류 알림을 켜지 않습니다. Sentry 프로젝트 설정의 Client Keys에서 DSN 값을 넣으세요.')
    return false
  }
  Sentry.init({
    dsn: value, environment, maxBreadcrumbs: 0, beforeSend: scrubEvent, defaultIntegrations: false, ...(transport ? { transport } : {}),
    // 자동 계측용 모듈 로더 후크를 켜지 않는다. 켜면 Render(Linux, Node 22.23)에서 서버 시작이 멈췄다(Windows 22.13에서는 재현 안 됨).
    enableRuntimeChannelInjection: false,
    integrations: [Sentry.onUncaughtExceptionIntegration(), Sentry.onUnhandledRejectionIntegration(), Sentry.linkedErrorsIntegration(), Sentry.contextLinesIntegration()],
  })
  setErrorReporter((error, fields) => Sentry.withScope(scope => {
    for (const [key, value] of Object.entries(fields)) scope.setTag(key, String(value))
    // 같은 라우트·같은 종류의 실패는 한 이슈로 묶는다.
    scope.setFingerprint(['request_failed', String(fields.route), String(fields.code ?? fields.error ?? fields.status), String(fields.sqlState ?? '')])
    scope.setTransactionName(String(fields.route))
    // 요청을 실패시킨 오류다. 처리되지 않음으로 표시해야 체험·유료 플랜에서도 높은 우선순위로 알림이 온다.
    Sentry.captureException(error, { mechanism: { type: 'vada.request_failed', handled: false } })
  }))
  return true
}

// 종료 전에 보내지 못한 오류를 내보낸다. 켜지 않았으면 바로 끝난다.
export async function stopErrorReporting() {
  await Sentry.close(2000)
}
