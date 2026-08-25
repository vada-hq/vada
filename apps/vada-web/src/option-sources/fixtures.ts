// 개발용 mock 데이터. 실제 데이터의 내용·id 규칙은 명세 번들에 없어 임시로 정했다
// (docs/pilot-onb01.md 마찰 로그 참조). 응답 형태는 option-sources.json 계약을 따른다.
import type { Option } from './catalog'

export const SCHOOLS: Option[] = [
  { value: 'sch-001', label: '바다대학교' },
  { value: 'sch-002', label: '한국해양대학교' },
  { value: 'sch-003', label: '부산바다대학교' },
  { value: 'sch-004', label: '서울과학기술대학교' },
  { value: 'sch-005', label: '바다시립대학교' },
]

export const COLLEGES: Record<string, Option[]> = {
  'sch-001': [
    { value: 'col-101', label: '해양과학대학' },
    { value: 'col-102', label: '공과대학' },
    { value: 'col-103', label: '인문사회대학' },
  ],
  'sch-002': [
    { value: 'col-201', label: '해사대학' },
    { value: 'col-202', label: '해양인문사회대학' },
  ],
  'sch-003': [
    { value: 'col-301', label: '자연과학대학' },
    { value: 'col-302', label: '경영대학' },
  ],
  'sch-004': [
    { value: 'col-401', label: '공과대학' },
    { value: 'col-402', label: '정보통신대학' },
  ],
  'sch-005': [{ value: 'col-501', label: '도시과학대학' }],
}

export const DEPARTMENTS: Record<string, Option[]> = {
  'sch-001:col-101': [
    { value: 'dep-1', label: '해양생명과학부' },
    { value: 'dep-2', label: '해양환경학과' },
  ],
  'sch-001:col-102': [
    { value: 'dep-3', label: '조선해양공학과' },
    { value: 'dep-4', label: '컴퓨터공학부' },
  ],
  'sch-001:col-103': [{ value: 'dep-5', label: '국어국문학과' }],
  'sch-002:col-201': [
    { value: 'dep-6', label: '항해융합학부' },
    { value: 'dep-7', label: '기관시스템공학부' },
  ],
  'sch-002:col-202': [{ value: 'dep-8', label: '해양행정학과' }],
  'sch-003:col-301': [{ value: 'dep-9', label: '수학과' }],
  'sch-003:col-302': [{ value: 'dep-10', label: '경영학부' }],
  'sch-004:col-401': [
    { value: 'dep-11', label: '기계시스템디자인공학과' },
    { value: 'dep-12', label: '신소재공학과' },
  ],
  'sch-004:col-402': [{ value: 'dep-13', label: '컴퓨터공학과' }],
  'sch-005:col-501': [{ value: 'dep-14', label: '도시행정학과' }],
}

// 행사 참가자를 거르는 선택지 넷. 디자인에는 빈 드롭다운으로만 있고, 무엇이 오는지는
// 그 행사에 실제로 신청한 사람과 조직이 정한 상태 목록이 정한다.
export const PARTICIPANT_AFFILIATIONS: Record<string, Option[]> = {
  'E-01': [
    { value: '컴퓨터학부', label: '컴퓨터학부' },
    { value: 'ICT융합학부', label: 'ICT융합학부' },
    { value: '인공지능학과', label: '인공지능학과' },
  ],
}

export const PARTICIPANT_APPLY_STATUS: Option[] = [
  { value: '신청 완료', label: '신청 완료' },
  { value: '대기 중', label: '대기 중' },
]

export const PARTICIPANT_PAY_STATUS: Option[] = [
  { value: '납부 확인', label: '납부 확인' },
  { value: '미납', label: '미납' },
  { value: '미확인', label: '미확인' },
]

export const PARTICIPANT_ATTEND_STATUS: Option[] = [
  { value: '참석', label: '참석' },
  { value: '불참', label: '불참' },
  { value: '미확인', label: '미확인' },
]
