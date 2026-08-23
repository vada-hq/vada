import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: string
  icon?: ReactNode
  // 바탕은 쓰임에 따라 갈린다: 행사 건수 타일(16:102)은 흰 카드, 재정 요약 안의
  // 타일(16:295)은 카드 안에 놓이므로 gray-50이다 — design의 사실이다.
  tone?: 'card' | 'inset'
  // 값의 색도 타일마다 다르다(진행 중 blue-600, 예정 indigo-600, 이번 주 orange-600).
  valueClass?: string
}

// 값 하나를 크게 보여주는 타일(summary의 한 항목).
// 16:102: 흰 배경, radius 9.25→rounded-xl, padding 14→4, 테두리 gray-200.
// 라벨 10.5→text-xs gray-500, 값 17.5→text-xl semibold.
export function StatTile({
  label,
  value,
  icon,
  tone = 'card',
  valueClass = 'text-gray-900',
}: StatTileProps) {
  // 아이콘은 라벨 왼쪽에 온다(16:102). 아이콘 31.5→size-9, 간격 10.5→gap-3.
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-4 ${
        tone === 'card' ? 'border border-gray-200 bg-white' : 'bg-gray-50'
      }`}
    >
      {icon}
      <div className="min-w-0">
        {/* 라벨 굵기도 쓰임에 따라 갈린다(16:104는 500, 재정 안의 16:297은 400). */}
        <p className={`text-xs text-gray-400 ${tone === 'card' ? 'font-medium' : 'font-normal'}`}>
          {label}
        </p>
        <p className={`pt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}
