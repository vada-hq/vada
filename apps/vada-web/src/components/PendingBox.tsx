import type { PendingSpec } from '../spec/types'

interface PendingBoxProps {
  /** 그림에서 이 상자의 자리. design 대조가 이것으로 찾아온다. */
  nodeId: string
  spec: PendingSpec
  /** 그림이 그린 상자의 꼴. 자리마다 테두리와 채움이 다르므로 화면이 준다. */
  className: string
}

/**
 * 아직 정하지 않은 칸(spec.type: pending).
 *
 * **그림이 그린 상자를 그대로 그리고 안은 비운다.** 글을 넣으면 그것이 명세에 없는
 * 말이 되고, 아예 안 그리면 그림에 있는 자리가 화면에서 사라진다 — 어느 쪽도
 * 조용한 대체다.
 *
 * 왜 비어 있는지는 명세가 안다(`note`). 그 글을 화면에 그리지 않고 이름과 풍선말로만
 * 실어 나른다 — 그려 버리면 design 대조가 그림에 없는 글을 보게 된다.
 */
export function PendingBox({ nodeId, spec, className }: PendingBoxProps) {
  return (
    <div
      data-node-id={nodeId}
      role="note"
      aria-label={spec.note}
      title={spec.note}
      className={className}
    />
  )
}
