// 검사에서 쓰는 주소표. 실제 파일을 모듈로 바꾸지 않는다.
//
// **주소를 지어내는 것이 아니라, 주소가 검사의 관심 밖이라는 사실을 쓰는 것이다.**
// design 대조는 `src`가 아니라 화면이 내놓는 `data-asset-node-id`로 그림을 짚는다
// (design-check/index.ts의 ASSET_ATTRIBUTE) — src는 번들러가 만든 주소라
// 되짚을 수 없기 때문이다. 그림의 **내용**은 대조기가 파일에서 직접 읽는다.
//
// 지목이 틀렸는지는 여전히 잡힌다. 검증기가 명세의 자산 참조와 실제 파일의
// 일치를 강제하고(validate-specs), 대조기가 design이 그림으로 뽑아 둔 자리를
// 화면이 모두 그렸는지 본다. 여기서 빠지는 것은 '주소 문자열' 하나뿐이다.
//
// 없는 자산을 물었을 때 조용히 넘어가지 않는 것은 그대로다 — 이 표는 무엇을
// 물어도 답하지 않고, assetUrl이 던진다. 다만 그 판정이 검사에서는 '파일이
// 있는가'가 아니라 '명세가 아는 자리인가'가 된다.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const SCREENS_DIR = join(process.cwd(), '../../specs/figma/vada-wireframe/screens')

function collect(): Map<string, string> {
  const urls = new Map<string, string>()
  for (const screenId of readdirSync(SCREENS_DIR)) {
    let files: string[]
    try {
      files = readdirSync(join(SCREENS_DIR, screenId, 'assets'))
    } catch {
      continue
    }
    for (const name of files) {
      if (!name.endsWith('.svg') && !name.endsWith('.png')) {
        continue
      }
      const key = `${screenId}/${name.replace(/\.(svg|png)$/, '')}`
      urls.set(key, `/specs/${screenId}/assets/${name}`)
    }
  }
  return urls
}

export const urlByKey = collect()
