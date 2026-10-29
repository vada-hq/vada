import type { CouncilContent } from './types.js'

// 학생회와 운영진. 운영진 차례가 초대 코드로 들어오는 차례다(얼굴 색이 들어온 차례로 정해진다).
// 계정 자리(account)는 명령 인자의 실제 계정이 맡고, 나머지는 로그인할 수 없는 가상 인물이다.
export const COUNCIL: CouncilContent = {
  schoolName: '서울과학기술대학교',
  name: '제34대 올웨이즈 학생회',
  at: 'D-4 22:41',
  joinFrom: 'D-4 22:43',
  assignAt: 'D-4 22:50',
  // 재정부는 학생회를 만들 때 서버가 함께 만드는 재정 역할 부서다.
  departments: [
    { name: '재정부', color: 'emerald', finance: true },
    { name: '기획부', color: 'sky' },
    { name: '홍보부', color: 'pink' },
    { name: '소통부', color: 'orange' },
  ],
  staff: [
    { name: '김바다', account: 'president' },
    { name: '황성욱', account: 'financeHead', department: '재정부', head: true },
    { name: '백승훈', account: 'planningHead', department: '기획부', head: true },
    { name: '이서연', vicePresident: true },
    { name: '박지민', department: '홍보부', head: true },
    { name: '최유진', department: '소통부', head: true },
    { name: '김민준', department: '재정부' },
    { name: '정수빈', department: '재정부' },
    { name: '오현우', department: '재정부' },
    { name: '이지우', department: '기획부' },
    { name: '강도윤', department: '기획부' },
    { name: '윤채원', department: '기획부' },
    { name: '한서준', department: '홍보부' },
    { name: '임하린', department: '홍보부' },
    { name: '신예린', department: '홍보부' },
    { name: '조은호', department: '소통부' },
    { name: '권나연', department: '소통부' },
    { name: '송태윤', department: '소통부' },
  ],
}
