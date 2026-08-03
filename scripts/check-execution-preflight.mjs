import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commandChecks = [
  { id: "git", command: "git", args: ["rev-parse", "--show-toplevel"] },
  { id: "node", command: "node", args: ["--version"] },
  { id: "pnpm", command: "pnpm", args: ["--version"] },
  { id: "uv", command: "uv", args: ["--version"] },
];

function defaultRunCommand({ command, args }) {
  const useWindowsCommandShim = process.platform === "win32" && command === "pnpm";
  const executable = useWindowsCommandShim ? process.env.ComSpec || "cmd.exe" : command;
  const executableArgs = useWindowsCommandShim ? ["/d", "/s", "/c", `pnpm ${args.join(" ")}`] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) return { ok: false, detail: `${command} 실행 불가: ${result.error.message}` };
  if (result.status !== 0) return { ok: false, detail: `${command} 종료 코드 ${result.status}` };
  return { ok: true, detail: `${command} 사용 가능` };
}

function commandResult(check, runCommand) {
  const result = runCommand(check);
  return {
    id: check.id,
    status: result.ok ? "passed" : "failed",
    detail: result.detail,
  };
}

export function evaluatePreflight(profile = "base", { env = process.env, runCommand = defaultRunCommand } = {}) {
  if (!["base", "postgresql"].includes(profile)) {
    throw new Error(`지원하지 않는 preflight 프로필: ${profile}`);
  }

  const checks = commandChecks.map((check) => commandResult(check, runCommand));
  if (profile === "postgresql") {
    const hasDatabaseUrl = typeof env.VADA_TEST_DATABASE_URL === "string" && env.VADA_TEST_DATABASE_URL.trim().length > 0;
    if (hasDatabaseUrl) {
      const probe = runCommand({
        id: "postgresql-runtime",
        command: "uv",
        args: [
          "run",
          "--project",
          "apps/api",
          "python",
          "-c",
          "import os; from sqlalchemy import create_engine, text; engine=create_engine(os.environ['VADA_TEST_DATABASE_URL']); connection=engine.connect(); connection.execute(text('SELECT 1')).scalar_one(); connection.close(); engine.dispose()",
        ],
      });
      checks.push({
        id: "postgresql-runtime",
        status: probe.ok ? "passed" : "failed",
        detail: probe.ok
          ? "VADA_TEST_DATABASE_URL 연결 확인 (값 비공개)"
          : "VADA_TEST_DATABASE_URL이 설정됐지만 연결할 수 없습니다. (값 비공개)",
      });
    } else {
      const docker = runCommand({ id: "postgresql-runtime", command: "docker", args: ["info"] });
      checks.push({
        id: "postgresql-runtime",
        status: docker.ok ? "passed" : "failed",
        detail: docker.ok
          ? "Docker daemon을 통한 일회용 PostgreSQL 실행 가능"
          : "VADA_TEST_DATABASE_URL이 없고 Docker daemon도 사용할 수 없습니다.",
      });
    }
  }

  return { profile, ok: checks.every((check) => check.status === "passed"), checks };
}

function printResult(result) {
  for (const check of result.checks) {
    const label = check.status === "passed" ? "PASS" : "FAIL";
    console.log(`[${label}] ${check.id}: ${check.detail}`);
  }
  console.log(result.ok ? `착수 전 검사 통과: ${result.profile}` : `착수 전 검사 실패: ${result.profile}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = evaluatePreflight(process.argv[2] ?? "base");
    printResult(result);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
