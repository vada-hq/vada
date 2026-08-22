// figma.design.json이 assetRef로 가리키는 자산(아이콘 SVG·래스터 PNG)을 그린다.
//
// 자산의 단위는 벡터 하나가 아니라 '벡터만 품은 가장 바깥 노드'라서, 파일 하나가
// 곧 아이콘 하나다. 색·배경까지 포함된 완결된 그림이므로 그대로 그리면 된다.
//
// 어떤 자리에 어떤 자산이 오는지는 명세가 아니라 design이 갖는다(시각). 그래서
// 호출부가 nodeId로 지목한다.
const ASSET_URLS = import.meta.glob(
  '../../../../specs/figma/vada-wireframe/screens/*/assets/*.{svg,png}',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>

// 파일 이름은 nodeId의 ':'를 '-'로 바꾼 것이다(packages/contracts figmaAssetFileName).
const urlByKey = new Map(
  Object.entries(ASSET_URLS).map(([path, url]) => {
    const parts = path.split('/')
    const fileName = parts[parts.length - 1]
    const screenId = parts[parts.length - 3]
    return [`${screenId}/${fileName.replace(/\.(svg|png)$/, '')}`, url]
  }),
)

export function assetUrl(screenId: string, nodeId: string): string {
  const key = `${screenId}/${nodeId.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const url = urlByKey.get(key)
  if (!url) {
    // 조용히 빈 자리를 남기면 디자인과 어긋난 채로 통과한다. 검증기가
    // 참조와 파일의 일치를 이미 강제하므로, 여기서 없다면 지목이 틀린 것이다.
    throw new Error(`자산을 찾지 못했습니다: ${key}`)
  }
  return url
}

interface FigmaAssetProps {
  screenId: string
  nodeId: string
  className?: string
  /** 뜻을 나르는 그림만 채운다. 장식은 빈 문자열로 두어 스크린리더가 건너뛴다. */
  alt?: string
}

export function FigmaAsset({ screenId, nodeId, className, alt = '' }: FigmaAssetProps) {
  return <img src={assetUrl(screenId, nodeId)} alt={alt} className={className} />
}
