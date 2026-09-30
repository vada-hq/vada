import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { assignDepartment, seedTestCouncil } from './test-data.js'

test('test data is repeatable and assignment never silently changes a department', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
    await seedTestCouncil(db)
    await seedTestCouncil(db)
    assert.equal((await pg.query('SELECT * FROM organizations')).rows.length, 1)
    assert.equal((await pg.query('SELECT * FROM departments')).rows.length, 2)
    assert.equal((await pg.query('SELECT * FROM users')).rows.length, 0)
    await assert.rejects(assignDepartment(db, 'missing', 'planning'))
    await pg.exec(`INSERT INTO users (id,name,email) VALUES ('u1','Tester','test@example.test'),('u2','Tester 2','test2@example.test')`)
    await assert.rejects(assignDepartment(db, 'u1', 'planning'))
    await pg.exec(`INSERT INTO accounts (id,user_id,provider_id,account_id) VALUES ('a1','u1','google','sub1'),('a2','u2','google','sub2')`)
    await assignDepartment(db, 'u1', 'planning')
    await assignDepartment(db, 'u1', 'planning')
    await assert.rejects(assignDepartment(db, 'u1', 'finance'))
    await assignDepartment(db, 'u2', 'finance')
    const rows = await pg.query<{user_id:string;handles_finance:boolean}>(`SELECT m.user_id,d.handles_finance FROM memberships m JOIN departments d ON d.id=m.department_id ORDER BY m.user_id`)
    assert.deepEqual(rows.rows, [{ user_id: 'u1', handles_finance: false }, { user_id: 'u2', handles_finance: true }])
    await pg.exec(`UPDATE departments SET handles_finance=true WHERE id='m1-test-planning'`)
    await assert.rejects(seedTestCouncil(db))
  } finally { await pg.close() }
})
