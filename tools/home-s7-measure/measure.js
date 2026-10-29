() => {
  const root = document.querySelector('[data-s5-variant]')
  if (!root) return { error: 'no root' }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rgbCache = new Map()
  const rgba = color => {
    if (rgbCache.has(color)) return rgbCache.get(color)
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const value = [r, g, b, a / 255]
    // 완전 투명 판별은 원문으로
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(color) || / \/ 0\)$/.test(color)) value[3] = 0
    rgbCache.set(color, value)
    return value
  }
  const hex = c => '#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')
  const lum = ([r, g, b]) => {
    const f = v => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    if (s.position === 'absolute' && r.width <= 1 && r.height <= 1) return false
    return true
  }
  const all = [...root.querySelectorAll('*')].filter(visible)
  const page = el => {
    const r = el.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
  }
  const bgOf = el => {
    let node = el
    while (node && node !== document.documentElement) {
      const c = rgba(getComputedStyle(node).backgroundColor)
      if (c[3] > 0.5) return c
      node = node.parentElement
    }
    return [249, 250, 251, 1]
  }
  // 글자 요소: 바로 아래에 글이 있는 요소
  const texts = all.filter(el =>
    [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0),
  )
  const sectionOf = el => {
    const s = el.closest('section[aria-labelledby]')
    return s ? s.getAttribute('aria-labelledby') : null
  }
  const textInfo = texts.map(el => {
    const s = getComputedStyle(el)
    const c = rgba(s.color)
    return {
      el,
      text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(),
      size: parseFloat(s.fontSize),
      weight: Number(s.fontWeight),
      color: hex(c),
      underline: s.textDecorationLine.includes('underline'),
      contrast: contrast(c, bgOf(el)),
      section: sectionOf(el),
      tag: el.tagName.toLowerCase(),
    }
  })
  const G900 = '#101828', G500 = '#6a7282'
  const ALLOWED = {
    [`16/600/${G900}`]: 'H1',
    [`14/500/${G900}`]: 'R',
    [`14/600/${G900}`]: 'R+',
    [`12/400/${G500}`]: 'M',
    [`12/600/${G900}`]: 'M+',
    [`12/500/${G900}`]: 'L',
    ['14/500/#ffffff']: '[새 행사](강조 채움)',
  }
  const combos = {}
  const offCombos = []
  for (const t of textInfo) {
    const key = `${t.size}/${t.weight}/${t.color}`
    combos[key] = (combos[key] || 0) + 1
    if (!ALLOWED[key]) offCombos.push(`${key} '${t.text.slice(0, 20)}'`)
  }
  const sizes = [...new Set(textInfo.map(t => t.size))].sort((a, b) => b - a)
  // 구역마다 H1 > 다른 글자 크기, H1 색이 줄 제목보다 옅지 않음
  const hierarchy = []
  for (const sec of root.querySelectorAll('section[aria-labelledby]')) {
    const id = sec.getAttribute('aria-labelledby')
    const h = document.getElementById(id)
    if (!h || id === 's7-greeting' || id === 's7-available') continue
    const hs = getComputedStyle(h)
    const inner = textInfo.filter(t => sec.contains(t.el) && t.el !== h)
    const maxSize = Math.max(0, ...inner.map(t => t.size))
    const titles = inner.filter(t => t.size === 14)
    const hl = lum(rgba(hs.color))
    const lighter = titles.some(t => lum(rgba(getComputedStyle(t.el).color)) < hl - 1e-6)
    hierarchy.push({ id, h1: parseFloat(hs.fontSize), maxRow: maxSize, ok: parseFloat(hs.fontSize) > maxSize && !lighter })
  }
  // K6 가운뎃점: 블록 요소마다 그 안의 인라인 글(안쪽 블록 제외)의 '·' 수
  const isInline = el => getComputedStyle(el).display.startsWith('inline')
  const inlineText = el => {
    let out = ''
    for (const n of el.childNodes) {
      if (n.nodeType === 3) out += n.textContent
      else if (n.nodeType === 1 && visible(n) && isInline(n)) out += inlineText(n)
    }
    return out
  }
  const dots = []
  for (const el of all) {
    if (isInline(el)) continue
    const t = inlineText(el)
    const n = (t.match(/·/g) || []).length
    if (n > 1) dots.push(`${n} '${t.trim().slice(0, 40)}'`)
  }
  // K4 상자
  const boxes = all.filter(el => {
    const r = el.getBoundingClientRect()
    if (r.width < 120 || r.height < 40) return false
    const s = getComputedStyle(el)
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(
      side => parseFloat(s[`border${side}Width`]) > 0 && rgba(s[`border${side}Color`])[3] > 0,
    ).length
    return sides >= 3 || s.boxShadow !== 'none'
  })
  const shadows = all.filter(el => getComputedStyle(el).boxShadow !== 'none')
  const depth = Math.max(0, ...boxes.map(b => boxes.filter(o => o !== b && o.contains(b)).length + 1))
  const bands = all.filter(el => {
    const r = el.getBoundingClientRect()
    if (r.width < 150) return false
    const c = rgba(getComputedStyle(el).backgroundColor)
    if (c[3] < 0.5) return false
    const neutral = Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3)) < 12
    const white = c[0] > 252 && c[1] > 252 && c[2] > 252
    return neutral && !white
  })
  // K3 칩
  const badges = [...root.querySelectorAll('[data-slot="badge"]')].filter(visible)
  const filledBadges = badges.filter(b => {
    const c = rgba(getComputedStyle(b).backgroundColor)
    return c[3] > 0.1 && !(c[0] > 248 && c[1] > 248 && c[2] > 248)
  })
  // K9 잘림
  const chipRow = root.querySelector('[aria-label="메시지함"]')
  const ellipsis = all.filter(el => getComputedStyle(el).textOverflow === 'ellipsis' && getComputedStyle(el).overflow !== 'visible')
  const clamp = all.filter(el => {
    const v = getComputedStyle(el).webkitLineClamp
    return v && v !== 'none'
  })
  const overflow = texts.filter(el => !(chipRow && chipRow.contains(el)) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline')
  // K10 간격
  const OK = new Set([0, 4, 8, 12, 16, 24, 32])
  const spacing = []
  for (const el of all) {
    const s = getComputedStyle(el)
    const props = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap']
    for (const p of props) {
      const raw = s[p]
      if (!raw.endsWith('px')) continue
      const v = Math.abs(Math.round(parseFloat(raw) * 100) / 100)
      if (!OK.has(v)) spacing.push(`${el.tagName.toLowerCase()}.${(el.className.baseVal ?? el.className).toString().slice(0, 50)} ${p}=${raw}`)
    }
  }
  // K11 대비
  const lowContrast = textInfo.filter(t => t.contrast < 4.5).map(t => `${t.contrast.toFixed(2)} '${t.text}'`)
  const minContrast = Math.min(...textInfo.map(t => t.contrast))
  // 구역 위치
  const rects = {}
  for (const sec of root.querySelectorAll('section[aria-labelledby]')) {
    const s = getComputedStyle(sec)
    const r = page(sec)
    const pt = parseFloat(s.paddingTop), pb = parseFloat(s.paddingBottom), pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight)
    rects[sec.getAttribute('aria-labelledby')] = {
      box: r,
      content: { x: r.x + pl, y: r.y + pt, w: r.w - pl - pr, h: r.h - pt - pb },
    }
  }
  // K13 내용
  const secText = id => {
    const s = root.querySelector(`section[aria-labelledby="${id}"]`)
    return s ? s.innerText : ''
  }
  const rowsIn = id => {
    const s = root.querySelector(`section[aria-labelledby="${id}"]`)
    return s ? [...s.querySelectorAll('li')].filter(visible).length : 0
  }
  const icons = [...root.querySelectorAll('svg.lucide-circle-alert')].filter(visible).length
  const strong = textInfo.filter(t => t.weight === 600 && t.size <= 14 && t.text.length > 0).map(t => `${t.size}:${t.text}`)
  const flat = id => secText(id).replace(/\n+/g, ' | ')
  const head = root.querySelector('section[aria-labelledby="s7-attention"] h2')
  const headCount = head ? (head.parentElement.innerText.match(/(\d+)건/) || [])[1] ?? null : null
  const content = {
    attentionRows: rowsIn('s7-attention'),
    attentionHeadCount: headCount === null ? null : Number(headCount),
    icons,
    attentionText: flat('s7-attention'),
    eventsText: flat('s7-events'),
    todoRows: rowsIn('s7-todo'),
    todoText: flat('s7-todo'),
    weekRows: rowsIn('s7-week'),
    weekText: flat('s7-week'),
    greetingText: flat('s7-greeting'),
    availableText: flat('s7-available'),
    strong,
    buttons: [...root.querySelectorAll('button')].filter(visible).map(b => b.innerText.trim()).filter(t => ['묻기', '구매 요청', '안건 올리기', '새 행사'].includes(t)),
  }
  // K12 중복과 나오면 안 되는 것
  const KEYS = ['체험 부스 구성안 확정', '동아리 지원금 신청서 제출', '부스 전기 사용 신청', '진로 특강 현장 운영 순서표 만들기', '진로 특강 다과 구매', '학생회실 비품 목록 정리', '총학생회 대표자 회의 자료 제출', '학생회 운영 세칙 개정안 정리', '신입생 환영회', '진로 특강 포스터']
  const ids = ['s7-attention', 's7-events', 's7-todo', 's7-week', 's7-available']
  const dup = KEYS.filter(k => ids.filter(id => secText(id).includes(k)).length > 1)
  const pageText = root.innerText
  const FORBIDDEN = ['겨울 MT 숙소 후보 알아보기', '진로 특강 참가 신청', '행사 시작', '중간고사 기간 시작', '정산과 기록', '메시지함', '18/30', '기획 중', '진행 중', '확인 필요 없음', '담당자 없음']
  const removed = FORBIDDEN.filter(k => pageText.includes(k))
  const attentionAll = secText('s7-attention')
  const removedFromAttention = ['총학생회 대표자 회의 자료 제출', '학생회 운영 세칙 개정안 정리'].filter(k => attentionAll.includes(k))
  const meters = root.querySelectorAll('progress, meter, [role="progressbar"]').length
  // K14 누르는 줄 높이
  const rowHeights = [...root.querySelectorAll('section li')].filter(visible).map(li => Math.round(li.getBoundingClientRect().height))
  const buttonHeights = [...root.querySelectorAll('section button')].filter(visible).filter(b => !b.className.includes('after:absolute')).map(b => [b.innerText.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)])
  const chips = chipRow ? [...chipRow.querySelectorAll('button')].filter(visible).map(b => Math.round(b.getBoundingClientRect().height)) : []
  const greeting = root.querySelector('section[aria-labelledby="s7-greeting"]')
  const attention = root.querySelector('section[aria-labelledby="s7-attention"]')
  return {
    root: page(root),
    sizes,
    combos,
    offCombos,
    hierarchy,
    dots,
    boxes: boxes.map(b => ({ tag: b.tagName.toLowerCase(), ...page(b) })),
    shadows: shadows.length,
    depth,
    bands: bands.map(b => `${b.tagName.toLowerCase()} ${Math.round(b.getBoundingClientRect().width)} ${getComputedStyle(b).backgroundColor}`),
    badges: badges.length,
    filledBadges: filledBadges.length,
    greetingH: greeting ? Math.round(greeting.getBoundingClientRect().height * 10) / 10 : null,
    attentionBottom: attention ? Math.round(page(attention).y + page(attention).h) : null,
    attentionTop: attention ? Math.round(page(attention).y) : null,
    ellipsis: ellipsis.length,
    clamp: clamp.length,
    overflow: overflow.map(el => `${el.tagName} '${el.textContent.slice(0, 20)}' ${el.scrollWidth}>${el.clientWidth}`),
    spacing: [...new Set(spacing)],
    lowContrast,
    minContrast: Math.round(minContrast * 100) / 100,
    rects,
    content,
    dup,
    removed,
    removedFromAttention,
    meters,
    buttonHeights,
    rowHeights,
    chips,
    textCount: textInfo.length,
    pageH: document.documentElement.scrollHeight,
  }
}
