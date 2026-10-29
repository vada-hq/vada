// 간단 측정(DOM). shoot.py가 page.evaluate로 부른다. 페이지 맨 위 기준 CSS px(셸 자리 상자 포함).
// overflow: 문서 가로 폭이 창보다 넓은가(가로 스크롤이 생김).
// small: 누르는 대상의 짧은 변이 44px 미만인 것. 체크·라디오처럼 label 안에 있으면 label 상자를 잰다.
//   편집기 미리보기(inert 안, 누를 수 없음)는 세지 않는다.
// copy / qr / submit: [링크 복사]·포스터용 QR·[만들기]([저장]) 아랫변 y. 없으면 null.
//   안이 data-measure="copy-link" | "qr" | "submit"를 달면 그것을 먼저 본다. 없으면 글자·aria-label로 찾는다.
;() => {
  const root = document.querySelector('[data-form-root]')
  if (!root) return { error: 'no root' }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  const bottom = el => (el ? Math.round(el.getBoundingClientRect().bottom + scrollY) : null)
  const live = [...root.querySelectorAll('*')].filter(el => !el.closest('[inert]'))
  const text = el => el.innerText.replace(/\s+/g, ' ').trim()
  const marked = name => live.find(el => el.dataset.measure === name && visible(el))
  const clickable = live.filter(el => el.matches('button, a[href], [role=button]') && visible(el))
  const copy = marked('copy-link') ?? clickable.find(el => text(el).includes('링크 복사'))
  const qr =
    marked('qr') ??
    live.find(el => el.matches('svg, img, canvas') && /QR/.test(el.getAttribute('aria-label') ?? el.getAttribute('alt') ?? '') && visible(el))
  const submit =
    marked('submit') ??
    clickable.find(el => ['만들기', '저장'].includes(text(el)) && el.closest('form'))
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 0.5
  const INTERACTIVE =
    'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=radio], [role=checkbox], [tabindex]:not([tabindex="-1"])'
  const seen = new Set()
  const small = []
  for (const el of live) {
    if (!el.matches(INTERACTIVE) || !visible(el)) continue
    const box = el.closest('label') ?? el
    if (seen.has(box)) continue
    seen.add(box)
    const r = box.getBoundingClientRect()
    if (Math.min(r.width, r.height) < 44) {
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
    overflow,
    small,
    copy: bottom(copy),
    qr: bottom(qr),
    submit: bottom(submit),
    coarse: matchMedia('(pointer: coarse)').matches,
    height: Math.round(document.documentElement.scrollHeight),
  }
}
