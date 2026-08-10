import { defineConfig } from "@hey-api/openapi-ts";

// 승인된 계약 묶음 전부에서 만든 문서 하나를 입력으로 쓴다. 묶음마다 입력을
// 두면 같은 스키마가 여러 번 생성되고, 이름에 접두사가 붙는 알려진 문제를 만난다.
export default defineConfig({
  input: "../../contracts/openapi/vada.json",
  output: process.env.VADA_API_CLIENT_OUTPUT ?? "src/generated",
  plugins: ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"],
});
