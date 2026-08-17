import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  startSpecServer
} from "./server.mjs";

const rawPort = process.env.FIGMA_SPEC_PORT;
const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);
const { server, specsRoot } = await startSpecServer({ port });

console.log(`[spec-service] http://${DEFAULT_HOST}:${port}`);
console.log(`[spec-service] ${specsRoot}`);

function closeServer() {
  server.close((error) => {
    if (error) {
      console.error("[spec-service] 종료 실패", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
