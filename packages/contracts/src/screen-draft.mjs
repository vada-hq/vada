// figma.design.json에서 화면 동작 명세의 초안을 뽑는다.
//
// 목적은 완성된 screen.json이 아니라 "기계가 확정할 수 있는 것"과
// "사람만 아는 것"을 갈라 놓는 것이다. 후자는 questions로 보고한다.
//
// 등록 노드는 element-types.md의 계약을 따른다: 요소의 모든 부분(라벨·컨트롤·
// 보조 텍스트)을 포함하는 가장 안쪽 노드.

import { describeButton, describeSiblingButtonGroup } from "./screen-draft-buttons.mjs";
import {
  describeBareList,
  describeSection,
  readGroupTitle
} from "./screen-draft-collections.mjs";
import {
  describeBareControl,
  describeField,
  isFieldWrapper
} from "./screen-draft-fields.mjs";
import { children, textOf, toSource } from "./screen-draft-node.mjs";
import { isBareControl, isButton } from "./screen-draft-signals.mjs";
import { findPrecedent } from "./spec-precedent.mjs";

// 제외 항목은 이름, 부모/이름, 화면 바로 아래의 */이름 세 형태를 지원한다.
function createExclusionMatcher(excludeNodeNames) {
  const excluded = new Set();
  const excludedWithParent = new Set();
  const excludedAtTop = new Set();
  for (const entry of excludeNodeNames ?? []) {
    if (entry.startsWith("*/")) {
      excludedAtTop.add(entry.slice(2));
    } else if (entry.includes("/")) {
      excludedWithParent.add(entry);
    } else {
      excluded.add(entry);
    }
  }
  return (child, parent, depth) =>
    excluded.has(child?.name) ||
    excludedWithParent.has(`${parent?.name ?? ""}/${child?.name ?? ""}`) ||
    (depth === 2 && excludedAtTop.has(child?.name));
}

/**
 * @param {object} design figma.design.json
 * @param {{precedents?: {entries: object[], conflicts: string[]}, stateScopeKey?: string}} options
 *   이미 등록된 화면에서 모은 선례. 같은 스코프의 같은 라벨만 확정에 쓴다.
 */
export function draftScreenElements(design, options = {}) {
  const elements = [];
  const questions = [];
  const { precedents, stateScopeKey, excludeNodeNames, workspaces } = options;
  const isExcluded = createExclusionMatcher(excludeNodeNames);
  const lookup = (label) =>
    precedents ? findPrecedent(precedents, { label, stateScopeKey }) : { confirmed: null, candidates: [] };

  for (const conflict of precedents?.conflicts ?? []) {
    questions.push(`선례가 서로 어긋납니다 — ${conflict} 어느 쪽이 맞는지 정하세요.`);
  }

  const visit = (node, insideGroup, depth = 1) => {
    for (const child of children(node)) {
      if (isExcluded(child, node, depth)) {
        continue;
      }

      if (isFieldWrapper(child)) {
        elements.push(describeField(child, questions, elements.length, lookup));
        continue;
      }

      if (isBareControl(child)) {
        const bare = describeBareControl(child, questions, lookup);
        if (bare) {
          elements.push(bare);
        }
        continue;
      }

      const bareList = describeBareList(child, questions, elements.length);
      if (bareList) {
        elements.push(bareList);
        continue;
      }

      const sectionDraft = describeSection(child, questions, elements.length);
      if (sectionDraft) {
        elements.push(sectionDraft.element);
        visit(sectionDraft.section.header, insideGroup, depth + 1);
        continue;
      }

      const siblingDraft = describeSiblingButtonGroup(
        child,
        questions,
        elements.length,
        workspaces
      );
      if (siblingDraft?.element) {
        elements.push(siblingDraft.element);
      }
      if (siblingDraft?.stop) {
        continue;
      }

      if (isButton(child)) {
        if (textOf(child) === "") {
          questions.push(
            `${child.id}(${child.name}) — 텍스트 없는 조작입니다. 어떤 요소의 내부 조작인지 알려주세요.`
          );
          continue;
        }
        elements.push(describeButton(child, questions, elements.length));
        continue;
      }

      const group = insideGroup ? null : readGroupTitle(child);
      if (group) {
        const at = `elements[${elements.length}](${group.title})`;
        const marker = elements.length;
        elements.push({
          source: toSource(child),
          spec: { type: "group", title: group.title, description: group.description }
        });
        visit(child, true, depth + 1);
        const members = elements
          .slice(marker + 1)
          .filter((element) => element.spec.type === "input" || element.spec.type === "select");
        elements[marker].spec.memberFieldKeys = members.map(
          (member) => member.spec.fieldKey ?? member.spec.label
        );
        if (members.some((member) => member.spec.fieldKey === undefined)) {
          questions.push(
            `${at} memberFieldKeys — fieldKey가 없는 멤버는 라벨로 채워 뒀습니다. 키가 정해지면 바꾸세요.`
          );
        }
        continue;
      }

      visit(child, insideGroup, depth + 1);
    }
  };

  visit(design.root, false);
  questions.push(
    "note 요소 — 완성된 문자열만 그려져 있어 파생 여부를 판정할 수 없습니다. 다른 스코프의 값을 잇는 안내가 있으면 알려주세요."
  );
  return { elements, questions };
}

export { compareWithSpec } from "./screen-draft-comparison.mjs";
export { DRAFT_SIGNALS } from "./screen-draft-signals.mjs";
