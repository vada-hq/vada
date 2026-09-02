# api를 담는 상자.
#
# **표를 먼저 맞추고 선다.** 이 상자가 켜질 때 `npm run db:migrate`를 한 번 부르고
# 그다음 서버가 뜬다(맨 아래 CMD). 까닭은 거기 적어 두었다.
FROM node:22-slim

WORKDIR /app

# **npm을 못 박는다.** 상자에 딸려 오는 npm(10.9.x)과 잠금 파일을 쓴 npm(11)이
# 다르면 같은 잠금에서 다른 트리가 나오고, `npm ci`는 그것을 "잠금이 package.json과
# 어긋난다"고 읽는다 — CI에서 먼저 겪고 고쳤는데 여기를 빠뜨렸다(2026-09-02).
# 잠금은 npm이 쓴 것이므로 읽는 npm도 같아야 한다.
RUN npm i -g npm@11

# 의존만 먼저 넣는다. 코드가 바뀌어도 이 층은 다시 받지 않는다.
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN cd apps/api && npm ci --omit=dev

# 명세가 계약의 원본이다. api가 `openapi.json`을 읽어 자리를 만든다 —
# 이것이 없으면 서버가 아무 자리도 열지 못한다.
COPY specs ./specs
COPY apps/api ./apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
# **어느 문으로 들을지는 올리는 곳이 정한다.** 여기 박아 두면 Render처럼 제 값을
# 넣어 주는 곳에서 둘이 어긋난다 — 없으면 `config.ts`가 8787로 간다.
EXPOSE 8787
# **표를 맞추고 나서 선다.**
#
# `migrate.ts`가 "배포가 이것을 한 번 부르고 그다음 서버가 선다"고 적어 두었는데
# 부르는 곳이 없었다. 그래서 새 표를 만든 배포가 그대로 올라갔고, 서버는 없는 표를
# 물어 500을 냈다(`42P01`) — 배포는 초록인데 자리는 죽어 있는, 가장 헷갈리는 모양이다.
#
# **Render의 pre-deploy는 유료 전용이라** 여기서 한다. 무료 요금제는 인스턴스가
# 하나뿐이라 여럿이 서로를 밟을 일이 없다. 여러 대로 늘리는 날 이 줄을 배포 단계로
# 옮겨야 한다 — 그때까지의 빚으로 여기 적어 둔다.
#
# 실패하면 서버가 아예 안 선다. 낡은 표 위에서 조용히 500을 내는 것보다 낫다.
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
