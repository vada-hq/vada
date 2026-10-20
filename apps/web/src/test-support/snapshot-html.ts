// 스냅숏용 화면 글. React가 붙이는 번호(useId, `_r_N_`)는 앞에 부품이 몇 개 있느냐에 따라 달라지므로
// 그려진 순서대로 안정된 이름(`_id1_`, `_id2_`…)으로 바꾼다. 같은 번호는 같은 이름이 된다.
export function snapshotHtml(): string {
  const names = new Map<string, string>()
  return document.body.innerHTML
    .replace(/_r_[0-9a-z]+_/g, id => {
      if (!names.has(id)) names.set(id, `_id${names.size + 1}_`)
      return names.get(id) ?? id
    })
    .replaceAll('><', '>\n<')
}
