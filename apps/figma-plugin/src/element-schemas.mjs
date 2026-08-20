// 요소 유형별 JSON Schema 레지스트리.
//
// UI(iframe)와 code(Figma 샌드박스)는 서로 다른 번들이지만 같은 목록을 써야 한다.
// 각자 손으로 들고 있었더니 ORG-02 작업에서 code 쪽만 갱신이 누락돼,
// note·group·list가 있는 화면은 `로컬 초안 불러오기`가 통째로 실패했다.
// 새 요소 유형은 여기 한 곳에만 추가한다.
import buttonSchema from "../../../packages/contracts/schemas/button.schema.json";
import groupSchema from "../../../packages/contracts/schemas/group.schema.json";
import inputSchema from "../../../packages/contracts/schemas/input.schema.json";
import listSchema from "../../../packages/contracts/schemas/list.schema.json";
import noteSchema from "../../../packages/contracts/schemas/note.schema.json";
import selectSchema from "../../../packages/contracts/schemas/select.schema.json";
import itemListSchema from "../../../packages/contracts/schemas/itemList.schema.json";
import summarySchema from "../../../packages/contracts/schemas/summary.schema.json";

export const schemaByType = {
  button: buttonSchema,
  group: groupSchema,
  input: inputSchema,
  list: listSchema,
  note: noteSchema,
  select: selectSchema,
  itemList: itemListSchema,
  summary: summarySchema
};
