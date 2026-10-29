// 배치 시안 측정(DOM). measure.py가 page.evaluate로 부른다. 대비·잘림 계산은 tools/home-c35/measure.js를 본떴다.
// 상자는 페이지 좌표(맨 위로 스크롤한 상태 = 첫 화면 좌표)다.
;() => {
  const root = document.querySelector('[data-layout-root]')
  if (!root) return { error: 'no root' }
  const rr = root.getBoundingClientRect()
  const box = el => {
    const r = el.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, bottom: r.bottom + scrollY }
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rgba = color => {
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(color) || / \/ 0\)$/.test(color)) return [0, 0, 0, 0]
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
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    return opacityOf(el) > 0.05
  }
  const ownText = el =>
    [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent)
      .join('')
      .trim()
  const texts = [...root.querySelectorAll('*')].filter(visible).filter(el => ownText(el).length > 0)
  const bgOf = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (c[3] > 0.5) return c
    }
    return rgba(getComputedStyle(document.body).backgroundColor)
  }
  const short = s => s.replace(/\s+/g, ' ').slice(0, 24)

  // L4 대비
  const cs = texts.map(el => ({ c: contrast(rgba(getComputedStyle(el).color), bgOf(el)), t: ownText(el) }))
  const minC = cs.reduce((m, x) => (x.c < m.c ? x : m), { c: 99, t: '' })

  // L3 잘림(말줄임·줄 수 제한은 따로 센다)
  const elided = el => {
    for (let n = el; n && n !== root; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) return n
    }
    return null
  }
  const clipped = []
  const ellipsis = []
  for (const el of texts) {
    const t = short(ownText(el))
    const e = elided(el)
    if (e) {
      if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) ellipsis.push(t)
      continue
    }
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    if (r.right > rr.right + 0.5 || r.left < rr.left - 0.5) clipped.push(`폭 밖 '${t}'`)
    else if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) clipped.push(`가로 넘침 '${t}'`)
    else if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) clipped.push(`세로 넘침 '${t}'`)
    else {
      for (let n = el.parentElement; n && n !== root.parentElement; n = n.parentElement) {
        if (getComputedStyle(n).overflow === 'visible') continue
        const nr = n.getBoundingClientRect()
        if (r.right > nr.right + 0.5 || r.bottom > nr.bottom + 0.5 || r.left < nr.left - 0.5 || r.top < nr.top - 0.5) {
          clipped.push(`조상이 자름 '${t}'`)
          break
        }
      }
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 1)
    clipped.push(`페이지 가로 넘침 ${document.documentElement.scrollWidth}`)

  // 구역 상자
  const zones = {}
  for (const el of root.querySelectorAll('[data-layout-zone]')) {
    if (visible(el)) zones[el.dataset.layoutZone] = box(el)
  }
  // 단 높이: 단 맨 위에서 보이는 구역의 맨 아래 끝까지(L3 오른쪽 단은 늘어나 있어 단 상자 높이를 쓰지 않는다)
  const cols = {}
  for (const el of root.querySelectorAll('[data-layout-col]')) {
    const r = el.getBoundingClientRect()
    const kids = [...el.querySelectorAll('[data-layout-zone]')].filter(visible)
    const bottom = Math.max(...kids.map(k => k.getBoundingClientRect().bottom))
    cols[el.dataset.layoutCol] = { x: r.left, w: r.width, h: kids.length ? bottom - r.top : 0 }
  }
  const sideBySide = Boolean(cols.left && cols.right && cols.right.x > cols.left.x + 10)
  const tab = document.querySelector('nav[aria-label="휴대폰 메뉴"]')
  const tabBox = tab && visible(tab) ? box(tab) : null

  return {
    root: box(root),
    zones,
    cols,
    sideBySide,
    tabTop: tabBox ? tabBox.y : null,
    minContrast: Math.round(minC.c * 100) / 100,
    minContrastText: short(minC.t),
    clipped,
    ellipsis,
  }
}
