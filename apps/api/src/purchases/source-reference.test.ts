import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ChatMessage } from '@vada/contracts'
import { detailOf, ITEM, runPurchases } from '../test-support/purchases.js'

test(
  '원문 참조는 지금 볼 수 있는 메시지에만 있고 권한·기수·삭제·학생회 경계를 다시 확인한다',
  runPurchases(async s => {
    const root = `/api/organizations/${s.council.councilId}`
    await s.api.get(`${root}/rooms`, 's-president')
    await s.pg.query("UPDATE room_membership SET joined_at = '2026-03-01T00:00:00Z'")
    const rooms = (
      await s.pg.query<{ id: string; type: string; name: string | null }>(
        `SELECT cr.id, cr.type, d.name FROM chat_room cr JOIN record r ON r.id=cr.id
     LEFT JOIN department d ON d.id=cr.department_id WHERE r.council_id=$1`,
        [s.council.councilId],
      )
    ).rows
    const room = rooms.find(r => r.name === '재정부')!.id
    const all = rooms.find(r => r.type === 'all_members')!.id
    const say = async (roomId: string) => {
      const response = await s.api.post(
        `${root}/rooms/${roomId}/messages`,
        { body: '원문 비공개 본문' },
        's-financeMember',
      )
      assert.equal(response.status, 201)
      return ((await response.json()) as ChatMessage).id
    }
    const id = await say(room)
    const request = await s.made(
      { title: '원문 확인', items: [ITEM], sourceMessageId: id },
      's-financeMember',
    )
    const read = async (user = 's-financeMember') => {
      const response = await s.api.get(`${s.base}/${request.id}`, user)
      assert.equal(response.status, 200)
      const raw = await response.clone().text()
      assert.ok(!raw.includes('원문 비공개 본문'))
      return { request: await detailOf(response), raw }
    }
    assert.deepEqual((await read()).request.sourceMessage, { id, roomId: room })
    // 요청을 보는 회장단에게도 부서방 원문 권한은 생기지 않는다.
    const hidden = await read('s-president')
    assert.equal(hidden.request.sourceMessage, null)
    assert.ok(!hidden.raw.includes(id) && !hidden.raw.includes(room))
    const me = s.council.people.financeMember.memberId
    // 참여시각 경계는 DB의 마이크로초까지 비교한다.
    await s.pg.query(
      `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id=$1)
    + interval '1 microsecond' WHERE room_id=$2 AND member_id=$3`,
      [id, room, me],
    )
    assert.equal((await read()).request.sourceMessage, null)
    await s.pg.query(
      `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id=$1)
    WHERE room_id=$2 AND member_id=$3`,
      [id, room, me],
    )
    assert.ok((await read()).request.sourceMessage)
    await s.pg.query('DELETE FROM room_membership WHERE room_id=$1 AND member_id=$2', [room, me])
    assert.equal((await read()).request.sourceMessage, null)
    // 같은 기수 공지방은 가입 전에도 되고 지난 기수는 안 된다.
    const notice = await say(all)
    await s.pg.query('UPDATE evidence_link SET message_id=$1 WHERE record_id=$2', [
      notice,
      request.id,
    ])
    await s.pg.query(
      `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id=$1)
    + interval '1 microsecond' WHERE room_id=$2 AND member_id=$3`,
      [notice, all, me],
    )
    assert.deepEqual((await read()).request.sourceMessage, { id: notice, roomId: all })
    await s.pg.query("UPDATE message SET sent_at='2025-10-25T03:00:00Z' WHERE id=$1", [notice])
    assert.equal((await read()).request.sourceMessage, null)
    await s.pg.query(
      "UPDATE message SET sent_at='2026-10-25T03:00:00Z', deleted_at=clock_timestamp(), body=null WHERE id=$1",
      [notice],
    )
    assert.equal((await read()).request.sourceMessage, null)
    // 잘못 남은 연결·참여 줄이 있어도 다른 학생회의 원문 참조는 노출되지 않는다.
    const otherRoot = `/api/organizations/${s.other.councilId}`
    await s.api.get(`${otherRoot}/rooms`, 'o-president')
    const otherRoom = (
      await s.pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id=cr.id
    WHERE r.council_id=$1 AND cr.type='all_members'`,
        [s.other.councilId],
      )
    ).rows[0]!.id
    const response = await s.api.post(
      `${otherRoot}/rooms/${otherRoom}/messages`,
      { body: '다른 학생회' },
      'o-president',
    )
    const otherId = ((await response.json()) as ChatMessage).id
    await s.pg.query('UPDATE evidence_link SET message_id=$1 WHERE record_id=$2', [
      otherId,
      request.id,
    ])
    await s.pg.query(
      "INSERT INTO room_membership(room_id,member_id,joined_at) VALUES($1,$2,'2026-03-01T00:00:00Z')",
      [otherRoom, me],
    )
    const foreign = await read()
    assert.equal(foreign.request.sourceMessage, null)
    assert.ok(!foreign.raw.includes(otherId) && !foreign.raw.includes(otherRoom))
    await s.pg.query(
      "UPDATE council_membership SET ends_at=starts_at + interval '1 second' WHERE member_id=$1 AND cohort_id=$2",
      [me, s.council.cohortId],
    )
    const denied = await s.api.get(`${s.base}/${request.id}`, 's-financeMember')
    assert.equal(denied.status, 403)
    assert.ok(!(await denied.text()).includes(otherId))
  }),
)
