import type { Db } from '../../db/types.js'

// 점검 도구가 DB와 주고받는 연결의 모양. 실제 실행은 postgres-js, 시험은 PGlite나 가짜가 이 모양을 맞춘다.
export type SmokeSql = {
  // SQL 하나를 실행해 행을 돌려준다. 자리표시자($1)에 넣을 값은 글자로만 넘긴다.
  unsafe: (text: string, params?: string[]) => Promise<Record<string, unknown>[]>
}
export type SmokeConnection = {
  // 서비스 함수가 쓰는 drizzle 핸들
  db: Db
  // 서비스 밖의 SQL(SHOW, CREATE DATABASE, 판 읽기)용 날것 핸들
  sql: SmokeSql
  end: () => Promise<void>
}
