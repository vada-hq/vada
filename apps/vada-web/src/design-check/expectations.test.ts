import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expectationsOf, formatExpectations } from './expectations'
import { registeredNodeIds, type ComparableScreen, type DesignFile } from '.'
import { colorOf, sameColor, FONT_WEIGHTS } from './palette'

// 이 도구는 그리기 전에 답을 알려준다. 그러니 **거짓말을 하면 안 된다** —
// 알려준 대로 적었는데 대조가 어긋났다고 하면 도구가 없느니만 못하다.
//
// 그래서 여기서 묻는 것은 출력의 모양이 아니라 **대조와 같은 것을 말하는가**다:
// 같은 노드 목록을 보는가, 이름 붙인 색이 design의 색과 같은 색인가.

const SCREENS_DIR = join(process.cwd(), '../../specs/figma/vada-wireframe/screens')

interface Loaded {
  screenId: string
  screen: ComparableScreen
  design: DesignFile
}

function loadAll(): Loaded[] {
  const loaded: Loaded[] = []
  for (const screenId of readdirSync(SCREENS_DIR)) {
    const specFile = join(SCREENS_DIR, screenId, 'screen.json')
    const designFile = join(SCREENS_DIR, screenId, 'figma.design.json')
    if (!existsSync(specFile) || !existsSync(designFile)) {
      continue
    }
    loaded.push({
      screenId,
      screen: JSON.parse(readFileSync(specFile, 'utf-8')) as ComparableScreen,
      design: JSON.parse(readFileSync(designFile, 'utf-8')) as DesignFile,
    })
  }
  return loaded
}

const SCREENS = loadAll()

describe('design이 말하는 것을 그리기 전에 알려준다', () => {
  it('저장소에 화면이 있다', () => {
    expect(SCREENS.length).toBeGreaterThan(30)
  })

  // 목록이 갈리면 알려준 자리와 견주는 자리가 달라진다.
  it('대조와 같은 노드를 본다', () => {
    for (const { screenId, screen, design } of SCREENS) {
      const told = expectationsOf(screen, design).map((node) => node.nodeId)
      expect(told, screenId).toEqual(registeredNodeIds(screen))
    }
  })

  // 이름 붙인 색이 design의 색과 다른 색이면 그대로 적었을 때 대조가 어긋난다.
  it('이름 붙인 색은 design의 색과 같은 색이다', () => {
    for (const { screenId, screen, design } of SCREENS) {
      for (const node of expectationsOf(screen, design)) {
        const named = [
          ...node.texts.map((text) => text.colorClass?.slice('text-'.length)),
          ...node.boxes.map((box) => box.backgroundClass?.slice('bg-'.length)),
          ...node.boxes.map((box) => box.borderClass?.slice('border-'.length)),
        ].filter((token): token is string => typeof token === 'string')

        for (const token of named) {
          expect(
            colorOf(token),
            `${screenId} ${node.nodeId}의 ${token}을(를) 팔레트가 모른다`,
          ).not.toBeNull()
        }
      }
    }
  })

  // 팔레트 밖 색을 임의 색 표기로 내놓을 때도 그 표기가 되읽혀야 한다.
  it('팔레트 밖 색도 되읽힌다', () => {
    expect(colorOf('[#0A1F44]')).toBe('#0A1F44')
    expect(sameColor(colorOf('[#0A1F44]'), '#0A1F44')).toBe(true)
  })

  it('굵기 이름은 Tailwind의 굵기다', () => {
    for (const { screenId, screen, design } of SCREENS) {
      for (const node of expectationsOf(screen, design)) {
        for (const text of node.texts) {
          if (text.weightClass === null) {
            continue
          }
          const name = text.weightClass.slice('font-'.length)
          expect(FONT_WEIGHTS[name], `${screenId} ${node.nodeId}`).toBeDefined()
        }
      }
    }
  })

  // 자리·크기·여백은 말하지 않는다 - 대조가 보지 않는 것을 여기서 말하면
  // 명세가 아니라 이 도구가 표현을 정하게 된다.
  it('대조가 보는 다섯 가지 밖은 말하지 않는다', () => {
    const [first] = SCREENS
    const [node] = expectationsOf(first.screen, first.design)
    expect(Object.keys(node).sort()).toEqual(
      ['assets', 'boxes', 'elementType', 'nodeId', 'texts'].sort(),
    )
    for (const text of node.texts) {
      expect(Object.keys(text).sort()).toEqual(['colorClass', 'content', 'weightClass'])
    }
  })

  it('사람이 읽을 꼴로 낸다', () => {
    const org00 = SCREENS.find((entry) => entry.screenId === 'ORG-00')
    expect(org00).toBeDefined()
    const text = formatExpectations('ORG-00', expectationsOf(org00!.screen, org00!.design))
    expect(text).toContain('text-gray-900 font-bold')
    expect(text).toContain('bg-white border-gray-200')
    expect(text).toContain('30:4397')
  })
})
