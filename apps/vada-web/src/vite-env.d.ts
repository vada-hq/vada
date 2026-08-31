/// <reference types="vite/client" />

// 웹과 api를 나눠 올릴 때 api가 어디에 있는지. 비면 같은 곳이다.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
