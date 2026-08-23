import tailwindColors from 'tailwindcss/colors'

// Tailwind 팔레트를 여기에 옮겨 적지 않는다 — 설치된 tailwindcss가 내보내는 색을
// 그대로 읽는다. 팔레트를 손으로 베끼면 그 순간 두 번째 진실이 생기고, Tailwind를
// 올리는 날 조용히 어긋난다.
//
// Tailwind는 색을 oklch로 적고 figma.design.json은 sRGB 16진수로 적는다. 그래서
// 한쪽을 다른 쪽 표기로 옮겨야 대조할 수 있다. 변환은 표준 OKLab 역행렬과 sRGB
// 감마다. 이 와이어프레임의 색은 Tailwind 팔레트와 그대로 맞아떨어진다
// (gray-50 → #F9FAFB 등). 양쪽이 각자 반올림해 끝자리가 갈리는 색만 예외인데,
// 그건 아래 sameColor가 채널당 1의 여유로 흡수한다.

function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  // OKLab → LMS(세제곱근 공간) → LMS
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  // LMS → 선형 sRGB
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  const channel = (value: number) => {
    const encoded =
      value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
    const byte = Math.round(Math.min(1, Math.max(0, encoded)) * 255)
    return byte.toString(16).padStart(2, '0')
  }

  return `#${linear.map(channel).join('')}`.toUpperCase()
}

function expandHex(value: string): string | null {
  const digits = value.slice(1)
  if (digits.length === 3) {
    return `#${digits.split('').map((d) => d + d).join('')}`.toUpperCase()
  }
  if (digits.length === 6) {
    return `#${digits}`.toUpperCase()
  }
  // 투명도가 붙은 색(8자리)은 대조 대상이 아니다 — design도 불투명 색만 쓴다.
  return null
}

function toHex(value: string): string | null {
  const oklch = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim())
  if (oklch) {
    return oklchToHex(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]))
  }
  return value.startsWith('#') ? expandHex(value) : null
}

// tailwindcss/colors는 `{ gray: { 500: 'oklch(...)' }, white: '#fff' }` 꼴이다.
// 유틸리티 클래스 이름과 같은 모양(`gray-500`, `white`)으로 펴서 담는다.
function flatten(palette: Record<string, unknown>): Map<string, string> {
  const colors = new Map<string, string>()
  for (const [name, value] of Object.entries(palette)) {
    if (typeof value === 'string') {
      const hex = toHex(value)
      if (hex !== null) {
        colors.set(name, hex)
      }
      continue
    }
    if (value === null || typeof value !== 'object') {
      continue
    }
    for (const [shade, shadeValue] of Object.entries(value as Record<string, unknown>)) {
      if (typeof shadeValue !== 'string') {
        continue
      }
      const hex = toHex(shadeValue)
      if (hex !== null) {
        colors.set(`${name}-${shade}`, hex)
      }
    }
  }
  return colors
}

const COLORS = flatten(tailwindColors as unknown as Record<string, unknown>)

/**
 * Tailwind 색 토큰(`gray-500`)의 sRGB 16진수. 색이 아닌 토큰이면 null.
 *
 * 임의 색(`[#0A1F44]`)도 읽는다 — 와이어프레임이 팔레트 밖 색을 쓰는 자리가 있고,
 * 그 자리를 그리려면 화면도 임의 색을 써야 하기 때문이다.
 */
export function colorOf(token: string): string | null {
  if (token.startsWith('[') && token.endsWith(']')) {
    const literal = token.slice(1, -1)
    return literal.startsWith('#') ? expandHex(literal) : null
  }
  return COLORS.get(token) ?? null
}

// 채널당 1까지는 같은 색으로 본다. Figma와 Tailwind가 같은 oklch를 각자 sRGB로
// 반올림하므로 끝자리가 갈리는 색이 있다(orange-200: design #FFD6A8, 계산 #FFD6A7).
// 2 이상 벌어지는 팔레트 색은 없으므로 이 여유가 다른 색을 같다고 하지는 않는다.
const CHANNEL_TOLERANCE = 1

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

export function sameColor(left: string | null, right: string | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  const a = channels(left)
  const b = channels(right)
  return a.every((value, index) => Math.abs(value - b[index]) <= CHANNEL_TOLERANCE)
}

// 대조 결과를 사람이 읽을 때 `#99A1AF`보다 `gray-400`이 쓸모 있다. 같은 색을 가진
// 토큰이 여럿이면 먼저 선언된 것을 쓴다.
const TOKEN_BY_COLOR = new Map<string, string>()
for (const [token, hex] of COLORS) {
  if (!TOKEN_BY_COLOR.has(hex)) {
    TOKEN_BY_COLOR.set(hex, token)
  }
}

/** sRGB 16진수를 Tailwind 토큰 이름으로. 팔레트에 없는 색이면 16진수 그대로. */
export function tokenOf(hex: string): string {
  const upper = hex.toUpperCase()
  const exact = TOKEN_BY_COLOR.get(upper)
  if (exact !== undefined) {
    return `${exact}(${upper})`
  }
  for (const [candidate, token] of TOKEN_BY_COLOR) {
    if (sameColor(candidate, upper)) {
      return `${token}(${upper})`
    }
  }
  return upper
}

/** Tailwind 굵기 유틸리티 이름 → 숫자. */
export const FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
}
