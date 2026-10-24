// 맨 앞의 `--` 하나를 뺀다. pnpm은 스크립트 이름 뒤의 인자를 그대로 넘겨서, npm 때처럼 `db:migrate -- --apply`라고 치면 `--`까지 온다.
export const withoutSeparator = (args: readonly string[]) =>
  args[0] === '--' ? args.slice(1) : [...args]
