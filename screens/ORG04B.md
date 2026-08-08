---
id: ORG04B
title: 역할 및 권한 관리 — 회장단
wireframe: prototypes/wireframe/src/app/App.tsx
wireframe_screen: ORG-04B
route: /organization/roles
contracts:
  - DATA:organization.member_roles@R1
  - DATA:organization.role_change_command@R1
  - AUTH:organization.manage_member_roles@R1
  - API:organization.list_member_roles@R1
  - API:organization.change_member_role@R1
  - ERROR:organization.last_president_protected@R1
  - ERROR:organization.role_unchanged@R1
  - ERROR:organization.state_conflict@R1
  - ERROR:organization.action_forbidden@R1
  - ERROR:organization.persistence_unavailable@R1
  - ERROR:http.unauthenticated@R1
  - ERROR:http.resource_not_found@R1
status: done
---

## 이 화면이 푸는 것

**기본 역할이 데이터 모델에 없다.** `organization_memberships`는 누가 어느 학생회 구성원인지만 알고, 그 사람이 회장단인지 부서장인지 부원인지는 어디에도 없다.

그래서 세션 계약(`CB-IDENTITY-001@R1`)이 구현되지 못했다. 그 계약의 `capabilities` 7개 중 4개가 기본 역할로 정해진다.

| capability | 판정 근거 (`VADA_PERMISSION_MATRIX.md`) |
| --- | --- |
| `canCompleteEvent` | 회장단 |
| `canEditOrganization` | 회장단 |
| `canManageStudentRoster` | 회장단 |
| `canInviteOrganizationMember` | 회장단 · 부서장 |
| `canManageFinance` | 재정부 소속 |
| `canSubmitPurchaseRequest` | 재정부 소속 · 부서장 |
| `canManageStudentFeeRoster` | 재정부 소속 · 회장단 |

이 화면이 기본 역할을 저장할 자리를 만들고 바꾸는 방법을 준다.

## 역할 체계 (`VADA_PERMISSION_MATRIX.md` §역할 축, 확정)

- **기본 직급** — 회장단 / 부서장 / 부원. "전 구성원" = 셋 전부
- **부서 조건** — 재정부는 **직급이 아니다.** 재정부 소속이면 직급과 무관하게 재정 권한을 가진다
- **맥락 역할** — 회의·행사별로 사안마다 부여된다

**이 화면은 기본 직급만 바꾼다.** 와이어프레임이 못박는다.

> 회의 진행 권한, 회의 생성자, 행사 운영 조직 역할은 변경하지 않음

재정부도 마찬가지다. 재정부는 부서 소속이므로 이 화면이 아니라 조직 구조가 소유한다.

## 화면 구조

- **안내** — 회장단만 바꿀 수 있고 맥락 역할은 바뀌지 않는다는 것
- **구성원 기본 역할 목록** — 이름·소속 부서·현재 역할. 선택하면 오른쪽 패널이 그 사람을 가리킨다
- **기본 역할 변경 패널** — 선택한 구성원의 현재 역할과 회장단·부서장·부원 셋 중 하나를 고르는 자리. 역할마다 무엇을 하는지 한 줄
- **확인** — 변경 전·후 역할을 보여준 뒤 확정한다. 확정 전에는 아무것도 바뀌지 않는다

## 상태

**로딩** — 진행 상태만 알린다. 구성원 목록을 지어내지 않는다.

**회장단 아님(403)** — 화면정의서 예외. 진입할 수 없다. 다른 조직 데이터의 존재를 노출하지 않는 안내를 표시한다.

**변경할 것 없음** — 고른 역할이 현재 역할과 같으면 변경 버튼을 활성화하지 않는다.

**마지막 회장단 보호** — 회장단이 한 명뿐일 때 그 사람을 다른 역할로 바꾸려 하면 막고, 먼저 다른 구성원에게 회장단을 주라고 알린다. 서버도 같은 판정을 한다. 화면만 막으면 화면을 거치지 않는 요청이 통과한다.

**변경 성공** — 목록과 패널이 즉시 새 역할을 보여주고, 무엇이 어떻게 바뀌었는지 알린다.

**중복 적용(422)** — 고른 역할이 현재 역할과 같으면 서버가 거부한다. 조용히 성공으로 처리하면 바뀌지 않은 것을 바뀐 것으로 보여주게 된다.

**충돌(409)** — 그 사이 다른 회장단이 그 구성원의 역할을 바꿨으면 덮어쓰지 않는다. `expectedCurrentRole`이 서버 값과 다르면 거부하고 현재 상태를 다시 읽는다. 검토 화면의 `expectedReviewStatus`와 같은 방식이다.

**일시 장애(503)** — 재시도를 제공한다.

**인증 필요(401)** — 재인증 안내만 표시한다.

## 와이어프레임과 다르게 하는 것

**구성원을 이름이 아니라 식별자로 가리킨다.** 와이어프레임은 `member.name === selectedMember.name`으로 찾는다. 동명이인이 있으면 두 사람의 역할이 함께 바뀐다. 제품은 `membershipId`를 쓴다.

**소속 부서는 목록이다.** 와이어프레임은 `dept` 문자열 하나를 보여준다. `department_memberships`는 한 구성원이 여러 부서에 속하는 것을 막지 않는다(고유 제약이 `조직·구성원·부서`다). 계약이 부서 목록을 내려보내고 화면이 이어 붙여 표시한다.

**부서장 역할과 `is_department_head`를 같은 것으로 보지 않는다.** `organization_memberships.role`이 기본 역할의 정본이고, `department_memberships.is_department_head`는 "어느 부서를 이끄는가"만 답한다. 이 화면은 `role`만 바꾼다. 부서 배정은 조직 구조 수정(`ORG-03B`)이 소유한다. 기본 역할을 부원으로 낮췄는데 어느 부서의 장으로 남아 있는 상태는 이 화면이 만들지 않고 정리하지도 않는다.

**사이드바·브레드크럼** — 공통 셸이 제공한다.

## 서버가 지켜야 하는 것

**조직 범위.** 구성원 목록도 역할 변경도 세션이 정한 조직 안에서만 한다. 경로에 조직 식별자를 받지 않는 이유다. 다른 조직의 구성원 식별자를 보내도 찾을 수 없어야 한다.

**마지막 회장단 보호는 서버가 한다.** 화면의 비활성화는 안내이지 방어가 아니다.

**역할은 저장값과 표시값을 분리한다.** 저장은 `president` · `department_head` · `member`, 표시는 회장단 · 부서장 · 부원이다. 구매 요청의 `purchase_type`에서 저장값 대신 표시값을 넣어 CI가 두 번 돈 적이 있다.
