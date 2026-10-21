import type { TaskVersion } from '@vada/contracts'
import { versionLine } from './task-text'

// 이력: 오래된 판부터 모두. 판마다 바꾼 사람·시각과 바뀐 칸이다(DEC-34, DEC-46).
export function TaskHistory({ history }: { history: TaskVersion[] }) {
  return (
    <section aria-label="이력" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">이력</h3>
      <ol className="flex flex-col gap-1 text-xs text-gray-500">
        {history.map(version => (
          <li key={version.versionNo} className="wrap-anywhere">
            {versionLine(version)}
          </li>
        ))}
      </ol>
    </section>
  )
}
