// 보드 시안 측정(DOM). measure.py가 page.evaluate로 부른다. 인자 { expect: {todo, doing, done} }
// 표시 속성: 보드 [data-board-root], 휴대폰 목록 [data-list-root], 조작 줄 [data-toolbar], 카드 [data-card],
// 열 [data-column=<status>] 안의 [data-count], 카드 '⋯' [data-card-menu], 칩 넘김 칸 [data-chip-scroll].
arg => {
  const shown = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.display === 'none' || s.visibility === 'hidden') return false
    }
    return true
  }
  const board = document.querySelector('[data-board-root]')
  const list = document.querySelector('[data-list-root]')
  const root = shown(board) ? board : list
  const vw = innerWidth,
    vh = innerHeight
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rgba = color => {
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(color)) return [0, 0, 0, 0]
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const lum = ([r, g, b]) => {
    const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const opacityOf = el => {
    let o = 1
    for (let n = el; n && n !== document.documentElement; n = n.parentElement)
      o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const bgOf = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (c[3] > 0.5) return c
    }
    return rgba(getComputedStyle(document.body).backgroundColor)
  }
  const ownText = el =>
    [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent)
      .join('')
      .trim()
  const short = s => s.replace(/\s+/g, ' ').slice(0, 20)
  const all = [...root.querySelectorAll('*')].filter(el => shown(el) && opacityOf(el) > 0.05)

  // K1·K3·K4 첫 카드 위 끝, K2 첫 화면 안에 다 보이는 카드
  const cards = [...root.querySelectorAll('[data-card]')].filter(shown)
  const firstTop = cards.length ? Math.min(...cards.map(c => c.getBoundingClientRect().top)) : null
  const fully = cards.filter(c => {
    const r = c.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw
  }).length

  // K5 대비(보드 자리 글자 전부)
  const texts = all.filter(el => ownText(el).length > 0)
  let minC = { c: 99, t: '' }
  const lowC = []
  for (const el of texts) {
    const c = contrast(rgba(getComputedStyle(el).color), bgOf(el))
    if (c < minC.c) minC = { c, t: ownText(el) }
    if (c < 4.5) lowC.push(`${c.toFixed(2)} '${short(ownText(el))}'`)
  }

  // K6 위험 색: 글자·면·선이 빨강 계열(r>180, g<120, b<120 또는 옅은 빨강 면/선)인 요소 중 '지남'을 말하지 않는 것
  const reddish = c => c[3] > 0.05 && c[0] > 150 && c[1] < 110 && c[2] < 70
  const paleRed = c =>
    c[3] > 0.05 &&
    c[0] > 240 &&
    c[1] < 215 &&
    c[2] < 215 &&
    c[0] - c[1] > 30 &&
    Math.abs(c[1] - c[2]) < 25
  const dangerEls = all.filter(el => {
    const s = getComputedStyle(el)
    const fg = rgba(s.color),
      bg = rgba(s.backgroundColor),
      bd = rgba(s.borderTopColor)
    const hasText = ownText(el).length > 0
    return (
      (hasText && reddish(fg)) ||
      reddish(bg) ||
      paleRed(bg) ||
      (parseFloat(s.borderTopWidth) > 0 && (reddish(bd) || paleRed(bd)))
    )
  })
  const dangerBad = dangerEls
    .filter(el => !el.closest('[data-overdue]'))
    .map(el => short(el.textContent || el.tagName))

  // K7 잘림(말줄임·줄 수 제한 제외)·가로 넘침
  const elided = el => {
    for (let n = el; n && n !== root; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none'))
        return true
    }
    return false
  }
  const clipped = []
  const rr = root.getBoundingClientRect()
  for (const el of texts) {
    if (elided(el) || el.closest('[data-chip-scroll]')) continue
    const r = el.getBoundingClientRect(),
      t = short(ownText(el))
    if (r.right > rr.right + 0.5 || r.left < rr.left - 0.5) {
      clipped.push(`폭 밖 '${t}'`)
      continue
    }
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
      clipped.push(`가로 넘침 '${t}'`)
      continue
    }
    for (let n = el.parentElement; n && n !== root.parentElement; n = n.parentElement) {
      const ns = getComputedStyle(n)
      if (ns.overflow === 'visible') continue
      const nr = n.getBoundingClientRect()
      if (
        r.right > nr.right + 0.5 ||
        r.bottom > nr.bottom + 0.5 ||
        r.left < nr.left - 0.5 ||
        r.top < nr.top - 0.5
      ) {
        clipped.push(`조상이 자름 '${t}'`)
        break
      }
    }
  }
  const pageOverflow =
    document.documentElement.scrollWidth > vw + 0.5 ||
    [...document.querySelectorAll('[data-board-scroll]')].some(
      m => m.scrollWidth > m.clientWidth + 1,
    )
  const chipScroll = [...root.querySelectorAll('[data-chip-scroll]')]
    .filter(shown)
    .map(el => ({ hidden: Math.max(0, Math.round(el.scrollWidth - el.clientWidth - 24)) }))
  const toolbar = root.querySelector('[data-toolbar]')
  const toolbarH = toolbar ? toolbar.getBoundingClientRect().height : null

  // K9 열 머리 수 = 데이터 수(넓은 화면 열, 휴대폰 상태 탭)
  const counts = {}
  for (const col of root.querySelectorAll('[data-column]')) {
    if (!shown(col)) continue
    counts[col.dataset.column] = {
      head: col.querySelector('[data-count]')?.textContent.trim(),
      cards: col.querySelectorAll('[data-card]').length,
    }
  }
  const tabs = [...root.querySelectorAll('[role=tab]')]
    .filter(shown)
    .map(t => t.textContent.replace(/\s+/g, ' ').trim())

  // K10 누르는 자리 ≥ 44(휴대폰 목록 안의 단추·고르기·입력칸·탭)
  // 제목 단추를 ::after로 카드 크기로 늘린 곳은 카드가 누르는 자리다.
  const hit = el =>
    (getComputedStyle(el, '::after').position === 'absolute' && el.closest('[data-card]')) || el
  const small = [...root.querySelectorAll('button, select, input, [role=tab]')]
    .filter(shown)
    .filter(el => {
      const r = hit(el).getBoundingClientRect()
      return r.height < 44 - 0.5 || r.width < 44 - 0.5
    })
    .map(el => {
      const r = hit(el).getBoundingClientRect()
      return `${Math.round(r.width)}x${Math.round(r.height)} '${short(el.getAttribute('aria-label') || el.textContent)}'`
    })

  // K8 '⋯' 평소 투명도
  const menu = [...root.querySelectorAll('[data-card-menu]')].find(
    m => m.getBoundingClientRect().width > 1,
  )
  const menuOpacity = menu ? opacityOf(menu) : null

  return {
    firstTop,
    fully,
    cardCount: cards.length,
    minC: { c: +minC.c.toFixed(2), t: short(minC.t) },
    lowC: lowC.slice(0, 8),
    dangerCount: dangerEls.length,
    dangerBad: dangerBad.slice(0, 8),
    clipped: clipped.slice(0, 8),
    pageOverflow,
    chipScroll,
    toolbarH,
    counts,
    tabs,
    small: small.slice(0, 12),
    smallCount: small.length,
    menuOpacity,
  }
}
