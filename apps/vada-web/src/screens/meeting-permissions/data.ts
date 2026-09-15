import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { opsMeet04b } from '../../spec/screen-specs/opsMeet04b'
import { permissionSpecs } from './spec'

/** 권한 안내와 생성자 정보를 읽고, 회의가 없으면 명시적인 빈 상태를 만든다. */
export function readMeetingPermissionView(screenParams: Record<string, string>) {
  const specs = permissionSpecs()
  const meta = opsMeet04b.meta
  if (meta === undefined) throw new Error('OPS-MEET-04B의 화면 카피가 없습니다.')

  const missingParam = (opsMeet04b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const crumb = opsMeet04b.breadcrumb
  const meeting =
    missingParam === undefined && crumb !== undefined
      ? readObjectSourceOrNull(crumb.dataSourceKey, resolveParams(crumb.params, { screenParams }))
      : null
  const ownerRow =
    missingParam === undefined
      ? readObjectSourceOrNull(
          specs.owner.dataSourceKey,
          resolveParams(specs.owner.params, { screenParams }),
        )
      : null
  const permission =
    missingParam === undefined
      ? readObjectSourceOrNull(
          specs.notice.dataSourceKey,
          resolveParams(specs.notice.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || meeting === null || ownerRow === null || permission === null) {
    return {
      status: 'unavailable' as const,
      meta,
      message:
        missingParam?.missingNote ?? findDataSource(specs.owner.dataSourceKey).messages.empty,
    }
  }
  return { status: 'ready' as const, meta, specs, meeting, ownerRow, permission }
}

export type MeetingPermissionView = Extract<
  ReturnType<typeof readMeetingPermissionView>,
  { status: 'ready' }
>

export function readPermissionPeople(
  view: MeetingPermissionView,
  screenParams: Record<string, string>,
  queryValue: string,
) {
  return readListSource(
    view.specs.people.dataSourceKey,
    resolveParams(view.specs.people.params, {
      screenParams,
      fields: { [view.specs.query.fieldKey]: queryValue },
    }),
  )
}
