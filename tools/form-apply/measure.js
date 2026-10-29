// 간단 측정(DOM). shoot.py가 page.evaluate로 부른다. 페이지 맨 위 기준 CSS px.
// first: 첫 입력 칸(글 칸·고르기·체크) 윗변의 y. 없으면 null(done·closed 화면).
// overflow: 문서 가로 폭이 창보다 넓은가(가로 스크롤이 생김).
// small: 누르는 대상의 짧은 변이 44px 미만인 것. 라디오·체크처럼 label 안에 있으면 label 상자를 잰다.
;() => {
  const root = document.querySelector('[data-form-root]')
  if (!root) return { error: 'no root' }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  const FIELD =
    'input:not([type=hidden]), textarea, select, [role=radio], [role=checkbox], [role=combobox]'
  const fields = [...root.querySelectorAll(FIELD)].filter(visible)
  const first = fields.length ? Math.round(fields[0].getBoundingClientRect().top + scrollY) : null
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 0.5
  const INTERACTIVE =
    'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=radio], [role=checkbox], [tabindex]:not([tabindex="-1"])'
  const seen = new Set()
  const small = []
  for (const el of root.querySelectorAll(INTERACTIVE)) {
    if (!visible(el)) continue
    const box = el.closest('label') ?? el
    if (seen.has(box)) continue
    seen.add(box)
    const r = box.getBoundingClientRect()
    const side = Math.min(r.width, r.height)
    if (side < 44) {
      const name = (
        el.getAttribute('aria-label') ||
        el.labels?.[0]?.innerText ||
        box.innerText ||
        el.tagName
      )
        .replace(/\s+/g, ' ')
        .slice(0, 20)
      small.push(`${name}(${Math.round(r.width)}x${Math.round(r.height)})`)
    }
  }
  return {
    first,
    overflow,
    small,
    coarse: matchMedia('(pointer: coarse)').matches,
    height: Math.round(document.documentElement.scrollHeight),
  }
}
