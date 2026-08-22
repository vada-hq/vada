import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: string
  icon?: ReactNode
}

// 값 하나를 크게 보여주는 타일(summary의 한 항목).
// 16:102: 흰 배경, radius 9.25→rounded-xl, padding 14→4, 테두리 gray-200.
// 라벨 10.5→text-xs gray-500, 값 17.5→text-xl semibold.
export function StatTile({ label, value, icon }: StatTileProps) {
  // 아이콘은 라벨 왼쪽에 온다(16:102). 아이콘 31.5→size-9, 간격 10.5→gap-3.
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="pt-1 text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
