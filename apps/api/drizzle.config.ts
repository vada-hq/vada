import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './src/db',
  dialect: 'postgresql',
} satisfies Config
