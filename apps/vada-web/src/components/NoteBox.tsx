interface NoteBoxProps {
  /** design 대조가 이 안내를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  text: string
}

// note 요소. 상자 14:222: bg #EFF6FF(blue-50), border #DBEAFE(blue-100),
// radius 3.5→4(rounded), padding 10.5→12(p-3).
// 텍스트 14:224: 10.5→12(text-xs) #155DFC(blue-600).
export function NoteBox({ nodeId, text }: NoteBoxProps) {
  return (
    <p data-node-id={nodeId} className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-600">{text}</p>
  )
}
