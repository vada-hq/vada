import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type DeliveryDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>
export type DeliveryTransaction = Parameters<Parameters<DeliveryDatabase['transaction']>[0]>[0]
