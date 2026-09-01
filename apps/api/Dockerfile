# api를 담는 상자.
#
# **표를 먼저 맞추고 선다.** 배포가 `npm run db:migrate`를 한 번 부르고 그다음
# 서버가 뜬다(fly.toml의 release_command) — 여러 대가 함께 켜지면서 저마다 표를
# 고치면 서로를 밟는다.
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
CMD ["npm", "run", "start"]
