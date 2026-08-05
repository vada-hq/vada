export async function enableApiMocking() {
  if (
    !import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_API_MOCKING !== "true"
  ) {
    return;
  }

  const { worker } = await import("./browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
