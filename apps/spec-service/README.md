# Spec Service

화면 명세를 만들고 검사하는 CLI 모음이다. 서버가 아니다 — 예전에는 Figma
플러그인을 위한 로컬 HTTP 브리지였지만, 원본을 REST로 직접 받게 되면서
플러그인과 함께 지웠다(`docs/decisions/plugin-role.md`).

## 하는 일

```bash
# 화면 하나를 Figma에서 받는다: 원본 + 자산 + reference.png + 정규화된 design
node src/fetch-figma-screen.mjs vada-wireframe EVT-02

# 아직 명세되지 않은 화면 목록
node src/list-figma-screens.mjs vada-wireframe --todo

# 디자인에서 명세 초안과 '사람이 답해야 할 것' 목록을 뽑는다
node src/draft-screen-spec.mjs vada-wireframe EVT-02

# 명세 전체를 교차 검사한다(커밋 훅이 이것을 돌린다)
node src/validate-specs.mjs
```

## Figma 토큰

`fetch-figma-screen`만 토큰을 쓴다. 저장소 루트의 `.env`에 둔다.

```
FIGMA_TOKEN=...
```

`.env`는 `.gitignore`에 있다. 스크립트는 값을 출력하지 않는다(길이와 앞 네 글자만).
필요한 권한은 `file_content:read` 하나다 — Figma REST에는 파일 내용을 **쓰는**
API가 없으므로 쓰기 권한은 쓸 데가 없다.

파일 key는 비밀이 아니라 `specs/figma/<wireframeKey>/figma-file.json`에 있다.

## 확인

```bash
npm test
```
