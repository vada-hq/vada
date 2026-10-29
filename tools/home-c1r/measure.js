// c1r 측정(DOM). measure.py가 page.evaluate로 부른다. 인자: { rows: [{title, fact, danger}], total }
(arg) => {
  const root = document.querySelector('[data-c1r-root]')
  if (!root) return { error: 'no root' }
  const rr = root.getBoundingClientRect()
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
  // 보이는가: 크기, display·visibility, 조상 불투명도, sr-only(1px 상자)
  const opacityOf = el => {
    let o = 1
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    return opacityOf(el) > 0.05
  }
  const all = [...root.querySelectorAll('*')].filter(visible)
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
  const texts = all.filter(el => ownText(el).length > 0)
  const bgOf = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (c[3] > 0.5) return c
    }
    return [255, 255, 255, 1]
  }
  const short = s => s.replace(/\s+/g, ' ').slice(0, 24)

  // K3 대비
  const contrasts = texts.map(el => ({ c: contrast(rgba(getComputedStyle(el).color), bgOf(el)), t: ownText(el) }))
  const minC = contrasts.reduce((m, x) => (x.c < m.c ? x : m), { c: 99, t: '' })
  const lowC = contrasts.filter(x => x.c < 4.5).map(x => `${x.c.toFixed(2)} '${short(x.t)}'`)

  // K2 잘림(말줄임·줄 수 제한 제외)
  const elided = el => {
    for (let n = el; n && n !== root; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) return true
    }
    return false
  }
  const clipped = []
  for (const el of texts) {
    if (elided(el)) continue
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const t = short(ownText(el))
    if (r.right > rr.right + 0.5 || r.left < rr.left - 0.5) clipped.push(`폭 밖 '${t}'`)
    else if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) clipped.push(`가로 넘침 '${t}'`)
    else if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) clipped.push(`세로 넘침 '${t}'`)
    else {
      for (let n = el.parentElement; n && n !== root.parentElement; n = n.parentElement) {
        const ns = getComputedStyle(n)
        if (ns.overflow === 'visible') continue
        const nr = n.getBoundingClientRect()
        if (r.right > nr.right + 0.5 || r.bottom > nr.bottom + 0.5 || r.left < nr.left - 0.5 || r.top < nr.top - 0.5) {
          clipped.push(`조상이 자름 '${t}'`)
          break
        }
      }
    }
  }

  // K4 누르는 자리: 줄 전체 덮개(::after absolute)는 덮는 상자를 잰다
  const INTERACTIVE = 'button, a[href], [role="button"], [role="link"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
  const targets = [...root.querySelectorAll(INTERACTIVE)]
    .filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'
    })
    .map(el => {
      let r = el.getBoundingClientRect()
      const after = getComputedStyle(el, '::after')
      if (after.content !== 'none' && after.position === 'absolute') {
        let n = el.parentElement
        while (n && getComputedStyle(n).position === 'static') n = n.parentElement
        if (n) r = n.getBoundingClientRect()
      }
      const name = el.getAttribute('aria-label') || el.innerText || el.tagName
      return { name: short(name), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, hidden: opacityOf(el) <= 0.05 }
    })

  // K5 위험 색을 써도 되는 자리: 지남·오늘 줄의 사실 글(그 글만 담은 바깥 상자까지)
  const dangerFacts = new Set(arg.rows.filter(r => r.danger).map(r => r.fact))
  const allowed = []
  for (const el of texts) {
    const t = ownText(el)
    if (!dangerFacts.has(t)) continue
    let box = el
    while (box.parentElement && box.parentElement !== root && box.parentElement.innerText.trim() === t) box = box.parentElement
    const r = box.getBoundingClientRect()
    allowed.push({ x: r.left - rr.left - 2, y: r.top - rr.top - 2, w: r.width + 4, h: r.height + 4 })
  }

  // K6 머리 건수: '전체 n건'과 제목 옆 수(목록이 없는 머리 상자 안의 수)
  const heads = []
  const text = root.innerText
  for (const m of text.matchAll(/전체\s*(\d+)\s*건/g)) heads.push(Number(m[1]))
  const h = root.querySelector('h1, h2, h3, h4, [role="heading"]')
  if (h) {
    let box = h
    while (box.parentElement && box.parentElement !== root && !box.parentElement.querySelector('li, ul, ol, [role="list"]'))
      box = box.parentElement
    const rest = box.innerText.replace(h.innerText, '')
    for (const m of rest.matchAll(/(\d+)/g)) if (!heads.includes(Number(m[1]))) heads.push(Number(m[1]))
  }

  // 덧: 보이는 줄 수(상한 5)와 같은 일 두 번
  const shown = arg.rows.filter(r => text.includes(r.title) || text.includes(r.title.slice(0, 12)))
  const twice = arg.rows.filter(r => text.split(r.title).length > 2).map(r => r.title)

  return {
    height: Math.round(rr.height * 10) / 10,
    minContrast: Math.round(minC.c * 100) / 100,
    minContrastText: short(minC.t),
    lowContrast: lowC,
    clipped,
    targets,
    allowed,
    heads,
    shown: shown.length,
    twice,
  }
}
