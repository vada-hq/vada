// 학교마다 같은 이름(총학생회)이 흔해서, 초대 확인과 학생회 고르기 메뉴는 학생회를 이 글로 가린다(DEC-87).

// 대표 범위 글: '학교 · 단과대학 · 학부·학과'에서 있는 칸만 잇는다. 지금은 학교만 있다.
export const scopeText = (council: { schoolName: string }) =>
  [council.schoolName]
    .map(part => part.trim())
    .filter(part => part !== '')
    .join(' · ')

// 운영 연도 글: 운영 연도로 만든 기수 이름은 '2026'이라 '2026년'으로 보인다. 설정에서 바꾼 이름은 그대로, 지금 기수가 없으면 빈 글이다.
const YEAR_NAME = /^\d{4}$/
export const operatingYearText = (cohortName: string | null) =>
  cohortName === null ? '' : YEAR_NAME.test(cohortName) ? `${cohortName}년` : cohortName
