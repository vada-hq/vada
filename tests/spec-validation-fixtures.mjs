export function inputSpec(fieldKey, overrides = {}) {
  return {
    type: "input",
    fieldKey,
    label: fieldKey,
    placeholder: null,
    initialValue: null,
    inputType: "text",
    valueType: "string",
    required: true,
    validation: [],
    ...overrides
  };
}

export function element(nodeId, spec) {
  return {
    source: { nodeId, name: spec.fieldKey ?? spec.label ?? nodeId, figmaType: "FRAME" },
    spec
  };
}

export function myTasksSource(overrides = {}) {
  return {
    key: "my.tasks",
    shape: "list",
    description: "내 업무",
    params: [{ key: "tab", required: false, valueType: "string", description: "tab" }, { key: "query", required: false, valueType: "string", description: "query" }],
    fields: [{ key: "title", description: "업무 이름" }],
    ...overrides
  };
}
