import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../../contracts/openapi/CB-FIN-001/R2.json",
  output: process.env.VADA_API_CLIENT_OUTPUT ?? "src/generated",
  plugins: ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"],
});
