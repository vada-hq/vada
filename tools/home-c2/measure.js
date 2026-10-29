// c2 측정(DOM). measure.py가 page.evaluate로 부른다. 인자: { events: [{id, name, signals: [{text, danger}]}], total, shown }
// 표시 속성(판 문서 c2-board.md): 행사 하나를 감싸는 요소 [data-c2-event="<id>"], 위험 색을 쓰는 신호 요소 [data-c2-danger].
(arg) => {
  const root = document.querySelector('[data-c2-root]')
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
  const rel = r => ({ x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height })

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

  // K5 위험 색을 써도 되는 자리: [data-c2-danger] 요소 상자(+2px). 그 글에 '지남'이나 '초과'가 없으면 잘못 단 표시.
  const allowed = []
  const badDanger = []
  for (const el of root.querySelectorAll('[data-c2-danger]')) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    allowed.push({ x: r.left - rr.left - 2, y: r.top - rr.top - 2, w: r.width + 4, h: r.height + 4 })
    const t = el.innerText.trim()
    if (!/지남|초과/.test(t)) badDanger.push(short(t || el.tagName))
  }

  // 행사 표시: [data-c2-event="<id>"]의 높이(K7)와 보이는 수·두 번
  const eventEls = [...root.querySelectorAll('[data-c2-event]')].filter(visible)
  const eventBoxes = eventEls.map(el => ({ id: el.getAttribute('data-c2-event'), ...rel(el.getBoundingClientRect()) }))
  const known = new Set(arg.events.map(e => e.id))
  const unknownIds = eventBoxes.filter(b => !known.has(b.id)).map(b => b.id)
  const seen = {}
  for (const b of eventBoxes) seen[b.id] = (seen[b.id] ?? 0) + 1
  const twiceIds = Object.entries(seen)
    .filter(([, n]) => n > 1)
    .map(([id]) => id)

  // K6 머리 수: '전체 n개'와 제목 옆 수(목록·행사가 없는 머리 상자 안의 수)
  const heads = []
  const text = root.innerText
  for (const m of text.matchAll(/전체\s*(\d+)\s*개/g)) heads.push(Number(m[1]))
  const h = root.querySelector('h1, h2, h3, h4, [role="heading"]')
  if (h) {
    let box = h
    while (
      box.parentElement &&
      box.parentElement !== root &&
      !box.parentElement.querySelector('li, ul, ol, [role="list"], [data-c2-event]')
    )
      box = box.parentElement
    const rest = box.innerText.replace(h.innerText, '')
    for (const m of rest.matchAll(/(\d+)/g)) if (!heads.includes(Number(m[1]))) heads.push(Number(m[1]))
  }

  // 덧: 이름으로 본 보이는 행사 수(표시가 없어도 잼, 말줄임 대비 앞 12자)
  const shownByName = arg.events.filter(e => text.includes(e.name) || text.includes(e.name.slice(0, 12))).length

  return {
    height: Math.round(rr.height * 10) / 10,
    minContrast: Math.round(minC.c * 100) / 100,
    minContrastText: short(minC.t),
    lowContrast: lowC,
    clipped,
    targets,
    allowed,
    badDanger,
    eventBoxes,
    unknownIds,
    twiceIds,
    heads,
    shownByName,
  }
}
