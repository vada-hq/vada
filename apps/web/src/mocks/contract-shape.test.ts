import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import * as eventFinance from "./event-finance-fixtures";
import * as purchaseRequest from "./purchase-request-fixtures";
import * as session from "./session-fixtures";

/**
 * 화면이 개발·테스트에 쓰는 **가짜 응답이 계약과 같은 모양인가.**
 *
 * 이 가짜 데이터가 곧 "화면이 상상하는 서버"다. 서버 쪽은 실제 응답을 계약
 * 스키마로 검사하므로(`test_contract_response_shapes_postgresql.py`), 여기까지
 * 같은 스키마를 통과하면 **목과 서버가 갈라질 수 없다.**
 *
 * 이슈 #51이 걱정하던 문장이 이것이다 — "MSW 픽스처와 실제 서버 응답이 같다는
 * 것을 아무도 확인하지 않았다."
 *
 * 타입만으로는 부족하다. 타입은 필드 **이름**을 맞추지만 값의 형식·열거값·
 * 최소 길이는 보지 않는다. 계약은 그것까지 정한다.
 */

interface Contract {
  id: string;
  kind: string;
  specification?: { json_schema?: Record<string, unknown> };
}

// `apps/web/src`는 브라우저에서 도는 코드라 node의 파일 읽기를 쓸 수 없다.
// 계약은 vite가 빌드 시각에 읽어 넣는다.
const BUNDLE_MODULES = import.meta.glob<{ contracts?: Contract[] }>(
  "../../../../contracts/bundles/*/*.json",
  { eager: true, import: "default" },
);

function contractsById(): Map<string, Contract> {
  const found = new Map<string, Contract>();
  for (const path of Object.keys(BUNDLE_MODULES).sort()) {
    for (const contract of BUNDLE_MODULES[path]?.contracts ?? []) {
      found.set(contract.id, contract);
    }
  }
  return found;
}

const CONTRACTS = contractsById();

function validatorFor(contractId: string) {
  // 계약 스키마끼리 `$id`로 서로를 가리킨다. 전부 등록해 로컬에서 풀리게 한다 —
  // 안 그러면 검증기가 `urn:vada:...`를 인터넷에서 찾으려 든다.
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const contract of CONTRACTS.values()) {
    const schema = contract.specification?.json_schema;
    if (contract.kind === "DATA" && schema && typeof schema.$id === "string") {
      if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema, schema.$id);
    }
  }
  const schema = CONTRACTS.get(contractId)?.specification?.json_schema;
  if (!schema) throw new Error(`${contractId}: 계약을 찾을 수 없습니다.`);
  return ajv.compile(schema);
}

/** 목 하나가 어느 계약을 흉내내는가. 새 목을 만들면 여기 한 줄이 는다. */
const CHECKED: Array<{ name: string; value: unknown; contract: string }> = [
  {
    name: "sessionViewerExample",
    value: session.sessionViewerExample,
    contract: "DATA:session.viewer@R1",
  },
  {
    name: "editorStateExample",
    value: purchaseRequest.editorStateExample,
    contract: "DATA:purchase_request.editor_state@R1",
  },
  {
    name: "ownListExample",
    value: purchaseRequest.ownListExample,
    contract: "DATA:purchase_request.own_list@R1",
  },
  {
    name: "detailViewExample",
    value: purchaseRequest.detailViewExample,
    contract: "DATA:purchase_request.detail_view@R1",
  },
  {
    name: "reviewViewExample",
    value: purchaseRequest.reviewViewExample,
    contract: "DATA:purchase_request.review_view@R1",
  },
  {
    name: "eventBudgetSummaryExample",
    value: eventFinance.eventBudgetSummaryExample,
    contract: "DATA:event_budget.summary@R1",
  },
  {
    name: "eventItemBoardFinanceExample",
    value: eventFinance.eventItemBoardFinanceExample,
    contract: "DATA:purchase_request.event_item_board@R1",
  },
  {
    name: "eventItemBoardMemberExample",
    value: eventFinance.eventItemBoardMemberExample,
    contract: "DATA:purchase_request.event_item_board@R1",
  },
];

describe("목이 계약과 같은 모양인가", () => {
  it.each(CHECKED)("$name", ({ value, contract }) => {
    const validate = validatorFor(contract);
    const valid = validate(value);

    expect(
      validate.errors?.map(
        (error) => `${error.instancePath || "(뿌리)"}: ${error.message}`,
      ) ?? [],
    ).toEqual([]);
    expect(valid).toBe(true);
  });

  // 새 목을 만들고 표에 안 넣으면 아무도 그것을 안 본다. 이름이 `Example`로
  // 끝나는 것은 전부 계약을 흉내내는 값으로 본다.
  it("계약을 흉내내는 목이 전부 표에 있다", () => {
    const modules = { eventFinance, purchaseRequest, session };
    const declared = new Set(CHECKED.map((entry) => entry.name));
    const missing: string[] = [];

    for (const module of Object.values(modules)) {
      for (const name of Object.keys(module)) {
        if (name.endsWith("Example") && !declared.has(name)) missing.push(name);
      }
    }

    expect(missing).toEqual([]);
  });
});
