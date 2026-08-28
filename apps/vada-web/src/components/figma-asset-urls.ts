// figma.design.json이 assetRef로 가리키는 자산 파일의 주소표.
//
// 이 한 줄이 따로 있는 파일인 이유는 **값이 비싸기 때문**이다. eager glob은
// 파일 하나하나를 모듈로 바꾸는데 지금 1,199개이고 화면이 늘 때마다 는다.
// 브라우저로 묶을 때는 한 번이라 괜찮지만(빌드 20초), 검사는 워커마다 다시
// 하므로 그 값이 곱해진다 — 실측으로 앱 검사의 import가 125초였고 그중 대부분이
// 이것이었다.
//
// 그래서 검사에서는 이 파일만 갈아 끼운다(vite.config.ts의 test.alias).
// **화면 코드는 그대로다** — FigmaAsset은 여전히 assetUrl을 부르고, 대조는
// src가 아니라 data-asset-node-id로 그림을 짚으므로 주소가 무엇이든 상관없다.
const ASSET_URLS = import.meta.glob(
  '../../../../specs/figma/vada-wireframe/screens/*/assets/*.{svg,png}',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>

// 파일 이름은 nodeId의 ':'를 '-'로 바꾼 것이다(packages/contracts figmaAssetFileName).
export const urlByKey = new Map(
  Object.entries(ASSET_URLS).map(([path, url]) => {
    const parts = path.split('/')
    const fileName = parts[parts.length - 1]
    const screenId = parts[parts.length - 3]
    return [`${screenId}/${fileName.replace(/\.(svg|png)$/, '')}`, url]
  }),
)
