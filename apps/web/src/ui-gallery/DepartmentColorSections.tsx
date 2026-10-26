import { useState } from 'react'
import type { DepartmentColorKey } from '@vada/contracts'
import { DepartmentColorOptions } from '@/team/DepartmentColorOptions'
import { Section } from './GallerySection'

export function DepartmentColorSection() {
  const [color, setColor] = useState<DepartmentColorKey>('violet')
  return (
    <Section title="부서 색상">
      <div className="max-w-md">
        <DepartmentColorOptions color={color} onColor={setColor} />
      </div>
    </Section>
  )
}
