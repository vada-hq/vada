/**
 * 승인된 계약 묶음 **전부**를 하나의 OpenAPI 문서로 모은다.
 *
 * 묶음이 여섯인데 API는 하나다. 여섯 묶음은 전부 CB-FIN-001을 상속하는 한 줄기이고,
 * 한 FastAPI 앱과 한 게이트웨이 뒤에 있다. 묶음마다 문서를 내면 `ProblemDetails`
 * 같은 스키마가 여섯 번 중복되고, 상속된 operation까지 딸려 들어간다.
 *
 * **손으로 적는 대응표를 두지 않는다.** component 이름은 계약 ID에서 유도한다 —
 * 그 규칙이 CB-FIN-001이 손으로 적어 두었던 이름 열한 개를 그대로 재현한다.
 */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalSha256,
  resolveEffectiveContracts,
} from "../validate-contract-bundles.mjs";
import { isObject, readJson, readJsonIfPresent } from "./json.mjs";
import { renderOpenApi } from "./render.mjs";

const BUNDLE_ROOT = "contracts/bundles";
const FIXTURE_ROOT = "contracts/fixtures";
const PROBLEM_DETAILS = "DATA:http.problem_details@R1";
const EMPTY_BODY = "DATA:http.empty_body@R1";

export const VADA_OPENAPI_PATH = "contracts/openapi/vada.json";

function keyOf(contractId) {
  return contractId.slice(contractId.indexOf(":") + 1).split("@")[0];
}

function pascal(text) {
  return text
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * `DATA:purchase_request.editor_state@R1` → `PurchaseRequestEditorState`.
 *
 * `http` 네임스페이스는 뗀다 — `DATA:http.problem_details@R1`은 `ProblemDetails`다.
 * HTTP는 도메인이 아니라 운반 수단이라 타입 이름에 남길 이유가 없다.
 */
export function componentNameFor(contractId) {
  const key = keyOf(contractId);
  const [namespace, ...rest] = key.split(".");
  return pascal(namespace === "http" ? rest.join(".") : key);
}

/** `API:purchase_request.submit@R1` → `Purchase Request`. SDK가 이것으로 묶는다. */
export function tagFor(contractId) {
  const [namespace] = keyOf(contractId).split(".");
  return namespace
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function listBundleFiles(root) {
  const found = [];
  const directories = await readdir(resolve(root, BUNDLE_ROOT), {
    withFileTypes: true,
  });
  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    const files = await readdir(resolve(root, BUNDLE_ROOT, directory.name));
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      found.push(`${BUNDLE_ROOT}/${directory.name}/${file}`);
    }
  }
  // 순서를 고정한다. 파일 시스템 순서에 기대면 기계마다 다른 문서가 나온다.
  return found.sort();
}

/**
 * 승인 묶음을 전부 읽어 하나의 계약 표면으로 만든다.
 *
 * 각 묶음의 **자기 계약**만 API 목록에 넣는다. 상속된 것을 넣으면 CB-FIN-001의
 * operation이 묶음 수만큼 중복된다. 상속은 참조를 푸는 데만 쓴다.
 */
export async function loadApprovedSurface(root) {
  const contracts = new Map();
  const bundles = [];
  const fixtureByApiId = new Map();
  const apiContractIds = [];
  const superseded = new Set();

  for (const bundlePath of await listBundleFiles(root)) {
    const bundle = await readJson(root, bundlePath);
    if (bundle.bundle_status !== "approved") continue;

    const effective = await resolveEffectiveContracts(root, bundle, {
      bundlePath: resolve(root, bundlePath),
    });
    if (effective.errors.length > 0) {
      throw new Error(`${bundlePath}: ${effective.errors.join("; ")}`);
    }
    for (const [id, contract] of effective.contracts) {
      contracts.set(id, contract);
      if (contract.supersedes) superseded.add(contract.supersedes);
    }

    const fixture = await readJsonIfPresent(
      root,
      bundlePath.replace(BUNDLE_ROOT, FIXTURE_ROOT),
    );
    for (const contract of bundle.contracts ?? []) {
      if (contract.kind !== "API" || contract.status !== "ratified") continue;
      apiContractIds.push(contract.id);
      if (fixture) fixtureByApiId.set(contract.id, fixture);
    }

    bundles.push({
      path: bundlePath,
      id: bundle.bundle_id,
      revision: bundle.bundle_revision,
      canonicalSha256: canonicalSha256(bundle),
    });
  }

  const served = apiContractIds.filter((id) => !superseded.has(id)).sort();
  return {
    bundles,
    contracts,
    fixtureByApiId,
    apiContractIds: served,
    dataComponents: dataComponentsFor(served, contracts),
  };
}

/**
 * 문서에 실을 스키마. **operation이 닿는 것만** 넣는다.
 *
 * 묶음의 DATA 계약을 전부 넣으면 HTTP 본문이 아닌 것(예: 도메인 사건)까지
 * 타입으로 생성되어, 화면이 서버가 주지도 않는 모양을 쓸 수 있게 된다.
 */
export function dataComponentsFor(apiContractIds, contracts) {
  const idToContract = new Map();
  for (const [contractId, contract] of contracts) {
    const schemaId = contract.specification?.json_schema?.$id;
    if (contract.kind === "DATA" && schemaId) {
      idToContract.set(schemaId, contractId);
    }
  }

  const included = new Set([PROBLEM_DETAILS]);
  for (const apiContractId of apiContractIds) {
    const specification = contracts.get(apiContractId).specification;
    included.add(specification.request.body_contract_ref);
    included.add(specification.success.body_contract_ref);
  }

  // 스키마가 서로를 `$id`로 가리킨다. 닿는 데까지 따라간다.
  const pending = [...included];
  while (pending.length > 0) {
    const contractId = pending.pop();
    const schema = contracts.get(contractId)?.specification?.json_schema;
    for (const reference of collectRefs(schema)) {
      const referenced = idToContract.get(reference);
      if (referenced && !included.has(referenced)) {
        included.add(referenced);
        pending.push(referenced);
      }
    }
  }

  return new Map(
    [...included]
      .map((contractId) => [contractId, componentNameFor(contractId)])
      .sort((left, right) => (left[1] < right[1] ? -1 : 1)),
  );
}

function collectRefs(value, found = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectRefs(entry, found);
    return found;
  }
  if (!isObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") found.push(child);
    else collectRefs(child, found);
  }
  return found;
}

export function renderVadaOpenApi(surface) {
  return renderOpenApi(
    { contracts: surface.contracts },
    {
      apiContractIds: surface.apiContractIds,
      dataComponents: surface.dataComponents,
      tagsFor: (apiContract) => [tagFor(apiContract.id)],
      fixtureFor: (apiContract) =>
        surface.fixtureByApiId.get(apiContract.id) ?? null,
      // 승인 여부는 읽을 때 이미 걸렀다. 승인되지 않은 묶음은 표면에 없다.
      assertBaseline: () => {},
      info: () => ({
        title: "VADA API",
        version: "1",
        description:
          "승인된 계약 묶음 전부에서 만든 생성 클라이언트 입력입니다. 손으로 고치지 않습니다.",
      }),
      documentExtensions: () => ({
        "x-vada-contract-bundles": surface.bundles.map((bundle) => ({
          id: bundle.id,
          revision: bundle.revision,
          canonicalSha256: bundle.canonicalSha256,
        })),
      }),
      operationExtensions: () => ({}),
    },
  );
}

export { EMPTY_BODY, PROBLEM_DETAILS };
