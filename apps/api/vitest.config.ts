import { defineConfig } from 'vitest/config'

// 검사 파일들이 **한 프로세스에서** 돈다.
//
// 진짜 Postgres(PGlite)를 띄우는 데 7초쯤 걸린다. 파일마다 다른 프로세스면 파일마다
// 띄우게 되고, 지금 셋이라 그것만으로 20초가 넘는다 — 게이트의 시간 예산을 먹는다.
//
// 한 프로세스면 `db/testing.ts`가 띄운 것을 파일들이 나눠 쓴다. 깨끗함은 파일마다
// 표를 지우고 다시 만들어 지킨다(100ms가 안 된다).
export default defineConfig({
  test: {
    pool: 'forks',
    // Vitest 4에서 poolOptions가 없어졌다 — 최상위로 올라왔다. 옛 모양으로 두면
    // **경고만 뜨고 조용히 안 걸린다.**
    isolate: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
})
