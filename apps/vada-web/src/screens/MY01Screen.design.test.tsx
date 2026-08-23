import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ScreenRouter } from './ScreenRouter'
import { my01 } from '../spec/screens'
import { compareScreen, report } from '../design-check'
import type { DesignFile } from '../design-check'
import my01Design from '../../../../specs/figma/vada-wireframe/screens/MY-01/figma.design.json'

// 화면이 design과 같은 모습인지 대조한다.
//
// 대조 대상은 등록 노드의 안쪽이다 — 명세가 source.nodeId로 지목한 자리이므로,
// design과 화면이 만나야 하는 자리가 바로 거기다. 셸(사이드바·헤더)은 등록에서
// 빠져 있으므로 여기서도 빠진다.

const design = my01Design as unknown as DesignFile

describe('MY-01 design 대조', () => {
  it('등록 노드의 글을 design과 같은 색·굵기로 그린다', () => {
    render(
      <ScreenRouter
        screenId="MY-01"
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )

    const differences = compareScreen(document.body, my01, design)

    expect(differences, report('MY-01', differences)).toEqual([])
  })
})
