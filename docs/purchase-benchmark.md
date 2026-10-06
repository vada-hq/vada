# 구매 흐름 벤치마킹

2026-10-04 조사. 설계 결정은 [purchase-model.md](purchase-model.md)에 따로 둔다. 이 문서는 근거 자료이며, 아래 "가져올 만한 것"은 아직 채택하지 않은 후보다.

표기: **[확인]** 원문을 직접 연 내용 · **[검색]** 검색 결과 요약만 본 내용 · **[미확인]** 근거를 찾지 못한 내용

## 결론

- "채팅 링크 → 공유 후보 → 품목별 승인 → 구매 → 배송 → 정산"을 한 흐름으로 묶은 서비스는 찾지 못했다. 확인 범위 안에서는 차별점이다.
- 가장 가까운 것은 기업 구매 도구의 punchout(쇼핑몰 장바구니를 요청서로 가져오기)이다. 다만 요청서 전체 단위로 승인하고, 계약된 공급처만 지원한다.
- 국내 학생회·모임 서비스는 돈이 나간 뒤의 기록과 영수증 정산이 중심이다. 구매 전 요청·승인 단계가 비어 있다.
- 국내에 학생회 구매 요청 전용 SaaS는 검색 범위에서 찾지 못했다.

## 대학 학생단체 플랫폼

| 서비스 | 흐름 | 특징 | 근거 |
|---|---|---|---|
| Anthology Engage | 구매·자금·예산 요청 폼 → 검토 단계(최대 5개) → 관리자 최종 승인 → 예산 항목 연결 | 검토자는 메모와 권고만 남긴다. 승인해도 잔액은 그대로이고 거래를 따로 입력한다. 사용 가능 금액과 잔액을 구분한다 | [확인] [요청 제출](https://help.anthology.com/engage/en/submitting-purchase,-funding,-and-budgeting-requests-for-your-organization.html), [검토 단계](https://help.anthology.com/engage/en/finance-stages-overview.html), [조직 회계](https://help.anthology.com/engage/en/walkthrough--organization-accounting.html) |
| CampusGroups | 예산 배정 승인 → 예산 항목마다 "Request Payment"(주문할 물품, 환급) → 증빙 첨부 | 결재 화면 안에서 신청자와 대화한다. 수정 요청, 반려, 처음 단계로 되돌리기가 있다 | [확인] [Case 대학 안내](https://case.edu/studentlife/services/campusgroups/using-workflows-campusgroups), [Cornell PDF](https://scl.cornell.edu/sites/scl/files/documents/How%20to%20Submit%20a%20Budget%20and%20Payment%20Request%20in%20CampusGroups.pdf). 영수증 원칙은 [검색] |
| Modern Campus Involve (구 Presence) | 행사 단위 예산 요청 → 지출 요청 | 지출 유형에 Amazon 주문이 있다고 알려짐 | [확인] [SoftwareAdvice](https://www.softwareadvice.com/gamification/presence-profile/). 공식 도움말은 403이라 Amazon 유형은 [검색] |

공통점: 학교 행정실이 승인 주체인 무거운 폼 결재다. 무엇을 살지 함께 고르는 단계가 없다.

## 국내 모임·학생회 서비스

| 서비스 | 특징 | 근거 |
|---|---|---|
| 카카오뱅크 모임통장 | 승인 흐름 없음. 입출금 내역을 멤버 모두가 본다. 회비 규칙, 미입금자 확인, 목적별 포켓 | [확인] [카카오뱅크](https://www.kakaobank.com/products/moim) |
| 토스뱅크 모임통장 | 거래 내역마다 댓글·사진(영수증), 게시판. 모임카드 결제 시 전원 알림 | [확인] [비즈트리뷴 기사](https://www.biztribune.co.kr/news/articleView.html?idxno=310237). 알림·공동모임장은 [검색] |
| 클루보 | 회비 청구 → 입금 신청 → 운영진 승인. 카카오 알림톡 독촉 | [확인] [클루보](https://kluboapp.com/external/feature/dues) |
| Asso AI | 영수증을 계정과목·예산 항목·행사별로 AI 분류, 역할별 권한, 지출 승인, 결산 리포트. 회의록·공문·인수인계가 중심 | [확인] [Asso AI](https://assoai.co.kr/) |
| 정산이 | 영수증 사후 촬영·AI 인식, 예산 항목별 80/90/100% 경보, 월간 PDF. 무료·Pro 9,900원·Team 29,000원/월, 학생 30% 할인 | [확인] [정산이](https://jeongsani.com/) |
| 모임총무 | 회비·지출 기록, 정산 PDF 카톡 공유 | [검색] |

참고: 학생회비 대부분을 간부 개인 계좌로 관리하며, 보이스피싱 피해(약 1천만 원)와 인하대 7,600만 원 횡령 사례가 있다. 전문가들은 복수 승인과 공동 계좌를 권고했다. [확인] [서울신문 2026.4](https://www.seoul.co.kr/news/society/2026/04/01/20260401500295)

## 기업 구매·지출 도구

| 서비스 | 요청 생성 | 승인 | 구매·정산 | 근거 |
|---|---|---|---|---|
| Ramp Procurement | 계약서·스크린샷을 AI가 읽어 폼 채움. punchout 장바구니를 줄 단위 요청서로 | 금액·카테고리 규칙, Slack에서 승인 | 승인 시 일회용 가상카드 또는 PO. 3-way 매칭. PO 단계(발송·확인·출고) 표시. Plus $15/사용자/월 | [확인] [제품](https://ramp.com/procurement), [punchout](https://support.ramp.com/punchouts-in-ramp), [가격](https://ramp.com/pricing). 줄 단위 승인은 [미확인] |
| Procurify | punchout(요청 하나에 공급사 1곳, 가져온 뒤 수량 잠김), 견적서 AI 추출. URL 붙여넣기 없음 | 요청 전체 승인·반려. 승인자가 줄별 수량·단가 수정, 승인 화면에 예산 표시, 모바일 | 승인 시 PO 자동 생성·발송 | [확인] [punchout](https://success.procurify.com/en/articles/13780228-how-to-request-punchout-orders), [승인](https://success.procurify.com/en/articles/9001571-how-to-approve-requests), [AI 입력](https://www.procurify.com/blog/ai-intake-for-orders/) |
| Spendesk | 요청 폼, 견적서 AI 추출 | 금액·공급처 조건 라우팅, Slack에서 승인·반려(사유 선택) | PO 또는 가상카드. 영수증 미제출자 주간 리마인더. 금액 변경 시 재승인 | [확인] [Slack 연동](https://helpcenter.spendesk.com/en/articles/4031076-connect-your-account-to-slack), [구매 가이드](https://helpcenter.spendesk.com/en/articles/12655567-guide-procurement-in-spendesk) |
| Zip | 포털 폼, Slack 대화로 요청 | Slack에서 승인·반려 버튼, 리마인더 | 엔터프라이즈 P2P [검색] | [확인] [Slack 연동](https://zip.com/integration/slack) |
| 스팬딧 / 비즈플레이 / 플렉스 | 지출 등록·사전 품의·사전승인서 | 결재선, 모바일, 메신저 승인(스팬딧) | 법인카드 내역 매칭 | [확인] [스팬딧](https://www.spendit.kr/), [비즈플레이](https://bizplay.oqupie.com/portals/1330/articles/28119), [플렉스](https://flex.team/blog/2025/01/06/expense) |

## 채팅 기반 승인·구매

| 서비스 | 특징 | 근거 |
|---|---|---|
| Slack Workflow Builder | 폼·링크·이모지로 시작, 승인/거절 버튼. 유료 플랜 전용. 대기 중 승인을 모아 보는 화면이 없다는 지적 | [확인] [가이드](https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder). 대시보드 부재는 [검색] [suptask](https://www.suptask.com/blog/slack-approval-workflow) |
| Teams Approvals | 순차·병렬 승인, 첨부, 보낸 요청 목록 | [확인] [Microsoft](https://support.microsoft.com/en-us/office/create-an-approval-6548a338-f837-4e3c-ad02-8214fc165c84) |
| buybot (2018, 활동 흔적 없음) | Slack에 Amazon 링크 붙여넣기 → 승인자 대시보드 → 대신 주문, 누가 무엇을 주문했는지 추적 | [확인] [Product Hunt](https://www.producthunt.com/products/buybot?launch=buybot) |
| BuyerBot | /buy로 Amazon 검색, Slack 원탭 승인, 기준 금액 이하 자동 승인, 무료 | [확인] [BuyerBot](https://buyerbot.ai/) |

## 가져올 만한 것 (후보, 미채택)

M1 범위와 맞닿은 것 (2026-10-04 검토 결과 모두 채택하지 않음):

1. 알림에서 바로 승인·반려(Ramp, Spendesk, Zip) — **채택 안 함.** 이 도구들은 요청서 전체를 승인한다. 우리는 한 번에 제출된 품목들을 품목마다 판단하므로 알림 한 건으로 결정하는 방식이 맞지 않는다. 알림 자체도 M1 우선순위가 낮다.
2. 반려와 별개인 "수정 요청"(CampusGroups) — **채택 안 함.** 우리 반려는 사유를 남기고, 요청자가 "다시 담기"로 고쳐 다시 보낸다. 수정 요청은 같은 건을 되돌려 고치게 하는 상태라, 제출 후 구성을 고정한다는 규칙과 어긋나고 반려와 쓰임새가 겹친다.
3. 구매 시점에 가격이 바뀌면 재승인(Spendesk) — **M1에서 고려하지 않음.**

정산 단계(M1 이후):

4. 승인 화면에 예산 항목 잔액 표시(Procurify, Engage)
5. 거래마다 영수증 사진과 댓글(토스 모임통장)
6. 예산 80/90/100% 경보와 결산 PDF(정산이)
7. 고액 품목 재정부 2인 승인(서울신문 보도의 전문가 권고)
8. 영수증 미제출 리마인더(Spendesk), 소액 자동 승인 기준(BuyerBot)

## 피할 것

- 결재선·발주서·3-way 매칭 같은 기업용 개념. 학생회는 매년 사람이 바뀌어 설정 없이 바로 써야 한다.
- 법인카드나 punchout 계약을 전제하는 설계. 학생회는 개인 결제 후 환급이 흔하고, 쿠팡은 punchout 대상이 아니다. 링크 정보에 의존하므로 가격·품절 변동이 핵심 위험이다.
- 계좌·결제 기능을 직접 넣는 것. 규제·보안 부담이 크다. 필요하면 모임통장 등과 연동한다.
- Slack 의존. 학생회는 대부분 카카오톡을 쓴다. 자체 행사 채팅이 강점이다.
- 승인만으로 잔액이 바뀌는 구조. Engage도 승인과 실제 거래를 분리한다.

## 조사 한계

- 원문을 열지 못한 곳: Modern Campus 도움말(403), 토스 FAQ, 모임총무, Kip for Slack(403), CampusGroups 영수증 원칙.
- 조사하지 않은 곳: OrgSync(Engage로 흡수), Airbase, Payhawk, 자비스앤빌런즈, CampusGroups·Engage 가격.
- 국내 B2B 가격 비교(고위드 블로그)는 경쟁사 자료라 쓰지 않았다.
- 일부 기능 요약은 페이지 요약 도구를 거쳐 세부 문구에 오차가 있을 수 있다.
