import { Alert } from '@/components/ui/alert'

// '부서 배정 전' 띠(DEC-87, 기능 020 정한 것 12): 학생회 직급도 부서도 없는 운영진의 홈 맨 위. 누가 정하는지 한 문장으로 알린다.
// 홈 틀의 맨 위 자리(HomeFrame assignBand)에 들어간다. 배정되면 다음 읽기에서 사라진다.
export default function UnassignedBand() {
  return (
    <Alert tone="info" role="status" className="text-sm">
      <strong className="font-semibold">부서 배정 전</strong> 부서는 회장단이 정해요.
    </Alert>
  )
}
