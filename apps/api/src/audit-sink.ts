import type { AuditEntry, AuditSink } from './audit.ts'
import type { Db } from './db/client.ts'
import { auditLogs } from './db/schema.ts'

// 접속 기록을 **실제로 표에 쓴다.**
//
// 오랫동안 `AuditSink`는 인터페이스뿐이었고 표에 쓰는 코드가 없었다 — 검사가
// 배열에 담을 뿐이었다. 인터페이스만 있는 기록은 기록이 아니고, 그 사실이
// 검사에서는 보이지 않았다(2026-08-31 교차검토).
//
// **지난 일은 소급해 기록할 수 없다.** 그래서 서버가 서는 첫날부터 이것이 붙어야 한다.

export interface AuditIds {
  /** 줄 하나의 이름표. 밖에서 받으므로 검사가 정할 수 있다. */
  newId: () => string
}

export function databaseAudit(db: Db, ids: AuditIds): AuditSink {
  return {
    async write(entry: AuditEntry) {
      await db.insert(auditLogs).values({
        id: ids.newId(),
        at: entry.at,
        orgId: entry.orgId,
        userId: entry.userId,
        action: entry.action,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        failed: entry.failed,
        ip: entry.ip,
        userAgent: entry.userAgent,
      })
    },
  }
}
