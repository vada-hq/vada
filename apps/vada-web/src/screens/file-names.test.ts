import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// **git이 든 이름과 디스크의 이름이 같은가.**
//
// Windows는 파일 이름의 대소문자를 가리지 않는다. 그래서 `SignInScreen.tsx`를 지우고
// `SIGNINScreen.tsx`를 만들면 **git이 둘을 같은 파일로 보고 상쇄한다** — 새 내용이 옛
// 이름으로 저장된다. 이 기계에서는 아무 일도 안 일어나고, Linux에서 도는 CI가 그때
// 처음 붉어진다(2026-09-02에 실제로 그랬다).
//
// 여기서는 **git이 아는 이름**과 **디스크에 있는 이름**을 맞대 본다. 갈리면 이 기계에서
// 멈춘다 — 밀어내고 6분 기다린 다음에 아는 것보다 낫다.

const here = fileURLToPath(new URL('.', import.meta.url))
const root = fileURLToPath(new URL('../../../../', import.meta.url))

function trackedNames(): string[] {
  const out = execFileSync('git', ['ls-files', 'apps/vada-web/src/screens/'], {
    cwd: root,
    encoding: 'utf8',
  })
  return out
    .split('\n')
    .filter((line) => line.endsWith('.tsx') || line.endsWith('.ts'))
    .map((line) => line.slice(line.lastIndexOf('/') + 1))
    .sort()
}

describe('git이 든 이름과 디스크가 같다', () => {
  it('화면 파일 이름이 대소문자까지 맞는다', () => {
    const onDisk = readdirSync(here)
      .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
      .sort()
    expect(trackedNames()).toEqual(onDisk)
  })
})
