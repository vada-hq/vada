import type { ShowcaseContent } from './content/types.js'

// 명령의 미리 보기가 보이는 만들 개수. 이름과 학번 같은 값은 담지 않는다.
export function summaryOf(content: ShowcaseContent) {
  const applicants = content.forms.flatMap(form => form.applications?.list ?? [])
  const expenses = [
    ...content.expenses,
    ...content.purchases.flatMap(entry => (entry.expense ? [entry.expense] : [])),
  ]
  return [
    `운영진 ${content.council.staff.length}명`,
    `부서 ${content.council.departments.length}`,
    `행사 ${content.events.length}`,
    `업무 ${content.tasks.length}`,
    `회의 ${content.meetings.length}`,
    `일정 ${content.schedule.length}`,
    `예산 항목 ${content.finance.budgetItems.length}`,
    `수입 ${content.finance.incomes.length}`,
    `구매 요청 ${content.purchases.length}`,
    `지출 ${expenses.length}(증빙 ${expenses.filter(item => item.evidenceAt).length})`,
    `메시지 ${content.messages.length}`,
    `신청 양식 ${content.forms.length}`,
    `신청 ${applicants.length}(입금 ${applicants.filter(item => item.deposit).length})`,
    `학생회비 명단 ${content.feeRoster.studentIds.length}명`,
  ].join(', ')
}
