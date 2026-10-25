import type { CouncilUnit } from '@vada/contracts'

// 학생회 유형의 표시 이름(기능 020 정한 것 2). 만들기, 설정, 초대 확인이 같은 이름으로 부른다.
export const unitLabels: Record<CouncilUnit, string> = {
  department: '학부·학과 학생회',
  college: '단과대 학생회',
  university: '총학생회',
}
// 고르는 차례는 넓은 범위부터다(와이어프레임 ORG-01). 만들기와 설정이 같은 차례를 쓴다.
export const unitChoices: CouncilUnit[] = ['university', 'college', 'department']
