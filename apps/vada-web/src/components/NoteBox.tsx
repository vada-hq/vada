interface NoteBoxProps {
  text: string
}

// note 요소. 상자 14:222: bg #EFF6FF(blue-50), border #DBEAFE(blue-100),
// radius 3.5→4(rounded), padding 10.5→12(p-3).
// 텍스트 14:224: 10.5→12(text-xs) #155DFC(blue-600).
export function NoteBox({ text }: NoteBoxProps) {
  return (
    <p className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-600">{text}</p>
  )
}
