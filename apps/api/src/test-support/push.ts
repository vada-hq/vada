export async function capturePushLogs(run: () => Promise<void>) {
  const lines: string[] = []
  const original = console.log
  console.log = (line: string) => void lines.push(line)
  try {
    await run()
  } finally {
    console.log = original
  }
  return lines
}

export function fanoutSummary(kind: string, recipients = 0, devices = 0, sent = 0) {
  return { event: 'push_fanout', kind, recipients, devices, sent, expired: 0, rejected: 0 }
}
