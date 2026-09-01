import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { SCREEN_COMPONENTS, AppContext, EVIDENCE_STAGE_ENABLED } from "./App";

afterEach(cleanup);

// 재정 도메인 화면들 — 렌더 시 런타임 오류(흰 화면 등)가 없는지 자동 확인
const FINANCE_SCREENS = [
  "EVT-FIN-01", "EVT-FIN-01B", "EVT-FIN-01C", "EVT-FIN-01C-B", "MY-REQ-01", "FIN-REQ-01B", "FIN-REQ-01C", "FIN-REQ-02",
  "FIN-SUP-01B", "FIN-REV-01", "FIN-REV-01B", "FIN-PROC-01", "FIN-EVID-01",
  "FIN-00", "FIN-00B", "FIN-LEDGER-01",
];

describe("재정 화면 렌더 스모크", () => {
  for (const id of FINANCE_SCREENS) {
    it(`${id} 오류 없이 마운트`, () => {
      const Comp = SCREEN_COMPONENTS[id];
      expect(Comp, `${id} 컴포넌트가 등록돼 있어야 함`).toBeTruthy();
      expect(() => render(<Comp />)).not.toThrow();
    });
  }
});

describe("처리 단계 카드 스택 팝오버 노출", () => {
  it("스택을 펼쳐 아래 카드를 클릭하면 상태 변경 팝오버가 뜨고, 열린 카드가 z-40으로 올라온다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"]; // 재정부 처리 단계 보드
    const { container } = render(<Comp />);

    // 요청 검토 > 검토 대기의 REQ-001(4품목) 스택(접힘)을 호버로 펼친다.
    const stack = container.querySelector("[data-stack]") as HTMLElement;
    expect(stack, "같은 요청 카드 스택이 있어야 함").toBeTruthy();
    fireEvent.mouseEnter(stack);

    // 펼친 뒤 스택 안 개별 카드(생수 500ml)를 클릭 → 상태 변경 팝오버.
    const name = screen.getByText("생수 500ml");
    fireEvent.click(name);

    // 팝오버가 실제로 렌더돼 노출된다.
    expect(screen.queryByText(/상태 변경/), "상태 변경 팝오버가 떠야 함").not.toBeNull();

    // 열린 카드의 fan-in 래퍼가 z-40으로 승격돼 다음 카드 위로 올라온다(가림 방지).
    const fanWrapper = screen.getByText("생수 500ml").closest(".fan-in") as HTMLElement;
    expect(fanWrapper, "열린 카드의 스택 래퍼가 있어야 함").toBeTruthy();
    expect(fanWrapper.className).toContain("z-40");
  });
});

describe("행사별 배정 예산 편성", () => {
  it("예산 미편성 행사(재정부)에서 예산 편성을 누르면 편성 모달이 뜬다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01C-B"]; // 재정부 · 빈 행사(예산 미편성)
    render(<Comp />);
    // 상단 예산 편성 진입점이 보인다.
    fireEvent.click(screen.getByText("예산 편성"));
    // 편성 모달이 실제로 렌더된다.
    expect(screen.queryByText("행사 예산 편성"), "예산 편성 모달이 떠야 함").not.toBeNull();
    expect(screen.queryByText("항목 추가"), "항목 추가 버튼이 있어야 함").not.toBeNull();
  });
});

describe("요약 카드 항목별 팝오버", () => {
  it("편성된 행사에서 배정 예산 카드를 누르면 항목별 목록이 뜬다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01"]; // 체육대회(예산 편성됨)
    render(<Comp />);
    expect(screen.queryByText("예산 항목별 · 배정 예산"), "처음엔 팝오버가 닫혀 있어야 함").toBeNull();
    fireEvent.click(screen.getByText("배정 예산"));
    expect(screen.queryByText("예산 항목별 · 배정 예산"), "배정 예산 목록 팝오버가 떠야 함").not.toBeNull();
  });
  it("편성된 행사에서 실제 지출액 카드를 누르면 항목별 목록이 뜬다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01"];
    render(<Comp />);
    fireEvent.click(screen.getByText("실제 지출액"));
    expect(screen.queryByText("예산 항목별 · 실제 지출액"), "실제 지출액 목록 팝오버가 떠야 함").not.toBeNull();
  });
  it("미편성 행사에서 배정 예산 카드를 누르면 미편성 안내가 뜬다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01C-B"]; // 빈 행사(예산 미편성)
    render(<Comp />);
    fireEvent.click(screen.getByText("배정 예산"));
    expect(screen.queryByText(/아직 편성된 예산이 없습니다/), "미편성 안내가 떠야 함").not.toBeNull();
  });
});

describe("구매 요청 작성/수정 2모드 분리", () => {
  it("작성 화면(FIN-REQ-01B)은 '구매 요청 제출' 버튼을 보인다", () => {
    const Comp = SCREEN_COMPONENTS["FIN-REQ-01B"];
    render(<Comp />);
    expect(screen.queryByText("구매 요청 제출"), "작성 제출 버튼이 있어야 함").not.toBeNull();
    expect(screen.queryByText("구매 요청 재제출"), "작성 화면엔 재제출 버튼이 없어야 함").toBeNull();
  });
  it("수정 화면(FIN-REQ-01C)은 기존 요청을 불러오고 '구매 요청 재제출' 버튼을 보인다", () => {
    const Comp = SCREEN_COMPONENTS["FIN-REQ-01C"]; // 시연: REQ-001 편집
    render(<Comp />);
    expect(screen.queryByText("구매 요청 재제출"), "수정 재제출 버튼이 있어야 함").not.toBeNull();
    expect(screen.queryByText("구매 요청 제출"), "수정 화면엔 최초 제출 버튼이 없어야 함").toBeNull();
    // 기존 요청(REQ-001) 제목이 입력 필드에 미리 채워져 있어야 함
    expect(screen.queryByDisplayValue("체육대회 운영 물품 4종"), "기존 제목이 프리필돼야 함").not.toBeNull();
  });
});

describe("구매 요청 상세 — 제출 정보 다시 보기", () => {
  it("품목을 펼치면 요청자가 제출한 요청 정보가 보인다", () => {
    const Comp = SCREEN_COMPONENTS["FIN-REQ-02"];
    render(<Comp />);
    expect(screen.queryByText(/제출한 요청 정보/), "처음엔 상세가 접혀 있어야 함").toBeNull();
    fireEvent.click(screen.getByText("박스테이프")); // REQ-001 첫 품목
    expect(screen.queryByText(/제출한 요청 정보/), "펼치면 제출 정보가 보여야 함").not.toBeNull();
    expect(screen.queryByText(/구매 정보/), "구매 정보 섹션이 있어야 함").not.toBeNull();
  });
});

// 증빙 단계를 MVP 제품화에서 제외했다(VADA_MVP_SPEC.md 6.1). 보드 영역이 실제로 바뀌었는지 렌더로 확인한다.
describe("처리 단계 보드 — 증빙 영역이 완료 영역으로 대체됐다", () => {
  const areaTabNames = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("button"))
      .map(b => (b.textContent ?? "").replace(/\d+$/, "").trim());

  it("영역 탭에 `완료`가 있고 `증빙`이 없다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"];
    const { container } = render(<Comp />);
    const names = areaTabNames(container);
    expect(names).toContain("완료");
    expect(names).not.toContain("증빙");
  });

  it("`완료` 탭을 열면 종결 카드가 보인다 — 보드에서 사라지지 않는다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"];
    const { container } = render(<Comp />);
    const done = Array.from(container.querySelectorAll("button"))
      .find(b => (b.textContent ?? "").replace(/\d+$/, "").trim() === "완료");
    expect(done, "완료 영역 탭이 있어야 함").toBeTruthy();
    fireEvent.click(done!);
    expect(container.textContent).toContain("정산 완료");
  });
});

// 처리 단계는 `정산 완료`라고 하는데 예산은 같은 품목을 `승인·집행 예정액`으로 잡던 모순이 있었다.
// 종결 판정 축이 증빙(EVIDENCE_STAGE_ENABLED=false에서는 아무도 만들 수 없는 상태)에 묶여 있어서,
// 실제 지출액이 영원히 늘지 않고 집행 예정액이 영원히 줄지 않았다. 사용 가능액만 우연히 맞아 눈에 띄지 않았다.
describe("금액 확인 — 실지출 확정이 예산 실제 지출액으로 이어진다", () => {
  // 표본 REQ-004 배너 거치대: 수령 완료, 승인액 4개 × 20,000원 = 80,000원, 예산 항목 `행사 운영비`.
  const SETTLE_LABEL = "승인액과 동일 · 80,000원";

  // 기본 컨텍스트의 setter는 no-op이라 상태 전이를 볼 수 없다. 실제 useState를 물려 구매 요청을 살아 있게 한다.
  const Harness = ({ children }: { children: React.ReactNode }) => {
    const base = React.useContext(AppContext);
    const [purchaseRequests, setPurchaseRequests] = React.useState(base.purchaseRequests);
    return <AppContext.Provider value={{ ...base, purchaseRequests, setPurchaseRequests }}>{children}</AppContext.Provider>;
  };

  const openCompletionArea = () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"];
    const view = render(<Harness><Comp /></Harness>);
    const step = Array.from(view.container.querySelectorAll("button"))
      .find(b => (b.textContent ?? "").trim() === "처리 단계");
    fireEvent.click(step!);
    const done = Array.from(view.container.querySelectorAll("button"))
      .find(b => (b.textContent ?? "").replace(/\d+$/, "").trim() === "완료");
    fireEvent.click(done!);
    return view;
  };

  it("완료 영역이 금액 확인과 정산 완료 두 열로 나뉜다", () => {
    const { container } = openCompletionArea();
    expect(container.textContent).toContain("금액 확인");
    expect(container.textContent).toContain("정산 완료");
  });

  it("수령 완료 카드는 금액 확인 열에서 대기한다 — 금액 없이 종결시키지 않는다", () => {
    openCompletionArea();
    expect(screen.queryByText("배너 거치대"), "수령 완료 실행분이 완료 영역에 있어야 함").not.toBeNull();
  });

  it("승인액과 동일로 확정하면 실제 지출액이 늘고 승인·집행 예정액이 그만큼 준다", () => {
    const { container } = openCompletionArea();
    // 확정 전: 실지출 950,000원(편성 시점 보정치), 집행 예정 868,000원(승인액 예약, REQ-004 80,000원 포함)
    expect(container.textContent).toContain("950,000");
    expect(container.textContent).toContain("868,000");

    fireEvent.click(screen.getByText("배너 거치대"));
    const settle = screen.getByText(SETTLE_LABEL);
    fireEvent.click(settle);

    // 확정 후: 예약에서 실지출로 80,000원 전환
    expect(container.textContent, "실제 지출액이 80,000원 늘어야 함").toContain("1,030,000");
    expect(container.textContent, "집행 예정액이 80,000원 줄어야 함").toContain("788,000");
  });

  it("확정한 카드는 정산 완료 열로 옮겨간다", () => {
    const { container } = openCompletionArea();
    fireEvent.click(screen.getByText("배너 거치대"));
    fireEvent.click(screen.getByText(SETTLE_LABEL));
    // 금액 확인 열은 비고, 카드는 보드에 남는다(사라지지 않는다).
    expect(screen.queryByText("배너 거치대"), "종결 카드가 보드에서 사라지면 안 됨").not.toBeNull();
    expect(container.textContent).not.toContain(SETTLE_LABEL);
  });
});

// 증빙을 제품화에서 뺐는데 기록 탭과 상단 액션 바에는 증빙 진입점이 그대로 남아 있었다.
describe("증빙 진입점이 스위치를 따른다", () => {
  it("기록 그룹에 증빙 묶음 탭이 없다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"];
    const { container } = render(<Comp />);
    const names = Array.from(container.querySelectorAll("button")).map(b => (b.textContent ?? "").trim());
    expect(names.some(n => n.startsWith("승인 묶음")), "승인 묶음 탭은 남아 있어야 함").toBe(true);
    expect(names.some(n => n.startsWith("증빙 묶음"))).toBe(false);
  });

  it("상단 액션 바에 증빙 정리 버튼이 없다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-01B"];
    const { container } = render(<Comp />);
    const names = Array.from(container.querySelectorAll("button")).map(b => (b.textContent ?? "").trim());
    expect(names).not.toContain("증빙 정리");
  });
});

// 증빙을 제품화에서 뺐는데 MVP 화면 곳곳에 진입점·열·문구가 남아 있었다.
// `FIN-PROC-01`은 주 액션 버튼이 `증빙 정리로 이동`이라, 칸반에서 상세보기로 온 카드의
// 종결 경로가 제품화하지 않는 화면을 가리키고 있었다.
describe.skipIf(EVIDENCE_STAGE_ENABLED)("MVP 재정 화면에 증빙 문구가 남지 않는다", () => {
  // FIN-REV-01은 제외한다 — 집행 유형 17종 판정 UI가 증빙 요건을 설명하는데,
  // 그것은 증빙과 별개 축의 보류 자산이라 별도 작업으로 다룬다(FINANCE_DEFERRED ③).
  const MVP_FINANCE_SCREENS = [
    "EVT-FIN-01", "EVT-FIN-01B", "EVT-FIN-01C", "EVT-FIN-01C-B",
    "MY-REQ-01", "FIN-REQ-01B", "FIN-REQ-01C", "FIN-REQ-02",
    "FIN-SUP-01B", "FIN-PROC-01", "FIN-00", "FIN-LEDGER-01",
  ];
  for (const id of MVP_FINANCE_SCREENS) {
    it(`${id} 첫 화면에 '증빙'이 없다`, () => {
      const Comp = SCREEN_COMPONENTS[id];
      const { container } = render(<Comp />);
      expect(container.textContent, `${id}에 증빙 문구가 남아 있음`).not.toContain("증빙");
    });
  }
});

// 칸반 팝오버에는 금액 확정이 있는데 그 상세 뷰인 FIN-PROC-01에는 없어서,
// 상세보기로 넘어온 카드를 종결시킬 방법이 화면 안에 없었다.
describe.skipIf(EVIDENCE_STAGE_ENABLED)("FIN-PROC-01도 실지출 금액을 확정할 수 있다", () => {
  const Harness = ({ children }: { children: React.ReactNode }) => {
    const base = React.useContext(AppContext);
    const [purchaseRequests, setPurchaseRequests] = React.useState(base.purchaseRequests);
    return <AppContext.Provider value={{ ...base, purchaseRequests, setPurchaseRequests, selectedPurchaseRequestId: "REQ-004" }}>{children}</AppContext.Provider>;
  };

  it("금액 확인 실행분에 확정 액션이 있고, 확정하면 실지출 금액이 표에 찍힌다", () => {
    const Comp = SCREEN_COMPONENTS["FIN-PROC-01"];
    const { container } = render(<Harness><Comp /></Harness>);
    expect(container.textContent, "실지출 열이 있어야 함").toContain("실지출");
    expect(container.textContent, "확정 전에는 미확정").toContain("미확정");

    fireEvent.click(screen.getByText("승인액과 동일 · 80,000원"));

    expect(container.textContent).toContain("80,000원");
    expect(container.textContent, "확정 후에는 미확정이 사라져야 함").not.toContain("미확정");
  });
});

// 시연 허브의 마지막 단계가 `증빙`으로 남아 있었다. 제품화에서 뺀 기능을 시연 단계로 노출하면
// 파일럿 시연에서 없는 제품을 보여주게 된다(docs/VADA_PILOT_DEMO_SCRIPT.md 1장).
describe("재정 시연 허브 — 마지막 단계가 증빙 스위치를 따른다", () => {
  it("증빙 대신 완료 확인으로 끝난다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-DEMO"];
    const { container } = render(<Comp />);
    expect(container.textContent).toContain("완료 확인");
    expect(container.textContent).not.toContain("증빙");
  });

  it("안내 문구가 단계 목록에서 파생돼 서로 어긋나지 않는다", () => {
    const Comp = SCREEN_COMPONENTS["EVT-FIN-DEMO"];
    const { container } = render(<Comp />);
    expect(container.textContent).toContain("예산 편성→요청 생성→검토→구매→완료 확인");
  });
});

// 구매 이유 기록은 pain point 정면인데 요청자 본인이 볼 곳이 없었다(VADA_MVP_SPEC.md 6.1).
// purpose는 저장돼 있고 FIN-REV-01·FIN-LEDGER-01에서만 보이던 상태였다.
describe("구매 목적이 요청자에게 보인다", () => {
  it("FIN-REQ-02 요약 카드에 구매 목적 라벨과 본문이 있다", () => {
    const Comp = SCREEN_COMPONENTS["FIN-REQ-02"];
    const { container } = render(<Comp />);
    expect(container.textContent).toContain("구매 목적");
  });

  // MY-REQ-01은 기본 사용자(김바다)에게 요청이 없어 기본 렌더가 빈 상태다.
  // 샘플 요청자(박해랑)를 주입해 실제 행이 그려지는 상태에서 확인한다.
  it("MY-REQ-01 목록의 제목 아래에 목적이 붙는다", () => {
    const Comp = SCREEN_COMPONENTS["MY-REQ-01"];
    const { container } = render(
      <AppContext.Consumer>
        {value => (
          <AppContext.Provider value={{ ...value, currentUser: { name: "박해랑", dept: "운영부", role: "부서장" } }}>
            <Comp />
          </AppContext.Provider>
        )}
      </AppContext.Consumer>
    );
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length, "박해랑의 요청 행이 있어야 함").toBeGreaterThan(0);
    const withPurpose = Array.from(container.querySelectorAll("p[title]"));
    expect(withPurpose.length, "목적이 붙은 행이 있어야 함").toBeGreaterThan(0);
    expect(withPurpose[0].textContent?.trim().length).toBeGreaterThan(0);
  });
});

// 진행 단계는 요청 상태만 보고 계산해 반려·요청 취소도 1단계(재정부 검토)로 그려졌고,
// 4번째 단계 이름이 증빙 제외 결정과 어긋나 있었다.
describe("FIN-REQ-02 진행 단계", () => {
  // 기본 컨텍스트 값을 받아 덮어쓸 값을 만든다(샘플 요청을 그대로 재료로 쓰기 위해).
  const renderWith = (make: (v: any) => any = () => ({})) => {
    const Comp = SCREEN_COMPONENTS["FIN-REQ-02"];
    return render(
      <AppContext.Consumer>
        {value => (
          <AppContext.Provider value={{ ...value, ...make(value) }}>
            <Comp />
          </AppContext.Provider>
        )}
      </AppContext.Consumer>
    );
  };
  // 현재 단계는 노란색 라벨이다.
  const currentLabel = (c: HTMLElement) =>
    (Array.from(c.querySelectorAll("p")).find(p => p.className.includes("text-yellow-600"))?.textContent ?? "").trim();

  it("단계 이름이 증빙 제외 결정과 맞는다", () => {
    const { container } = renderWith();
    expect(container.textContent).toContain("수령·이행");
    expect(container.textContent).not.toContain("결제·증빙");
  });

  it("검토 대기 요청은 재정부 검토 단계에 있다", () => {
    const { container } = renderWith(() => ({ selectedPurchaseRequestId: "REQ-001" }));
    expect(currentLabel(container)).toBe("재정부 검토");
  });

  it("반려 요청은 단계 막대 대신 종결 안내를 보여준다", () => {
    const { container } = renderWith(v => ({
      purchaseRequests: [{ ...v.purchaseRequests[0], id: "REQ-X", status: "반려" }],
      selectedPurchaseRequestId: "REQ-X",
    }));
    expect(container.textContent).toContain("반려되어 종결된 요청입니다");
    // 단계 막대가 사라졌는지는 단계 전용 라벨로 확인한다(종결 문구에도 "재정부 검토"가 들어간다).
    expect(container.textContent).not.toContain("수령·이행");
  });

  // 앞의 두 건은 상태를 주입해 검증한다. 샘플에도 반려 요청이 실제로 있어야 브라우저에서 종결 안내를 볼 수 있다.
  it("샘플의 반려 요청(REQ-008)이 종결 안내와 반려 사유를 보여준다", () => {
    const { container } = renderWith(() => ({ selectedPurchaseRequestId: "REQ-008" }));
    expect(container.textContent).toContain("반려되어 종결된 요청입니다");
    expect(container.textContent).toContain("중복 집행이므로");
    expect(container.textContent).not.toContain("수령·이행");
  });

  it("요청 취소도 종결로 표시한다", () => {
    const { container } = renderWith(v => ({
      purchaseRequests: [{ ...v.purchaseRequests[0], id: "REQ-Y", status: "요청 취소" }],
      selectedPurchaseRequestId: "REQ-Y",
    }));
    expect(container.textContent).toContain("취소해 종결된 요청입니다");
  });
});
