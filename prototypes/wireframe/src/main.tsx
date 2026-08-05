
import { createRoot } from "react-dom/client";

import "./styles/index.css";

const reviewMode = new URLSearchParams(window.location.search).get("review");
const root = createRoot(document.getElementById("root")!);

async function renderApp() {
  const { default: RootComponent } =
    reviewMode === "du001-r2"
      ? await import("./app/reviews/Du001Review.tsx")
      : await import("./app/App.tsx");

  root.render(<RootComponent />);
}

void renderApp();
