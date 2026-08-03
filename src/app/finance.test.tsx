import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { SCREEN_COMPONENTS } from "./App";

afterEach(cleanup);

// 재정 도메인 화면들 — 렌더 시 런타임 오류(흰 화면 등)가 없는지 자동 확인
const FINANCE_SCREENS = [
  "EVT-FIN-01", "EVT-FIN-01B", "MY-REQ-01", "FIN-REQ-01B", "FIN-REQ-02",
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
