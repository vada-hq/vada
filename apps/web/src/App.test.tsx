import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import App from "./App";

test("앱이 렌더링된다", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /get started/i }),
  ).toBeInTheDocument();
});
