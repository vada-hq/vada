import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./mocks/server";

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: vi.fn(),
  writable: true,
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
// vitest globals를 켜지 않으므로 testing-library 자동 정리가 등록되지 않는다.
// 화면 간 DOM이 새면 다음 테스트가 이전 결과를 실제 결과로 오인한다.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
