// figma.design.json이 assetRef로 가리키는 자산 파일의 주소표.
//
// 주소표는 동기적으로 읽되 그림 내용은 JS에 넣지 않는다. 작은 SVG도 해시가 붙은
// 개별 파일로 내보내면 <img>가 실제로 사용하는 그림만 요청하고 브라우저가 캐시한다.
// 단위 검사는 주소표만 대체한다(vite.config.ts). 실제 빌드의 원본 일치·이미지 로딩은
// e2e-ship/figma-assets.spec.ts가 검사한다.
const ASSET_URLS = import.meta.glob(
  '../../../../specs/figma/vada-wireframe/screens/*/assets/*.{svg,png}',
  { query: '?url&no-inline', import: 'default', eager: true },
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
