import { useState } from "react";

import { AppProviders, createAppRuntime } from "./app/runtime";

export { AppProviders, createAppRuntime } from "./app/runtime";

export default function App() {
  const [runtime] = useState(createAppRuntime);

  return <AppProviders runtime={runtime} />;
}
