import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";
import { LoginFailed } from "./auth/login-failed";
import { establishSession } from "./auth/session";
import { enableApiMocking } from "./mocks/enable-api-mocking";

async function bootstrap() {
  await enableApiMocking();

  const root = createRoot(document.getElementById("root")!);

  // 로컬 개발에는 Cognito가 없다. 서버 쪽 로컬 미들웨어가 신원을 흉내내므로
  // 여기서 로그인을 세우려 들면 개발이 아예 안 된다.
  //
  // 반대로 배포에서는 **반드시** 세운다. 실패했는데 그냥 그리면 로그인 없이
  // 화면이 뜨고, 그것은 화면마다 "데이터 없음"으로만 보인다.
  if (import.meta.env.PROD) {
    try {
      await establishSession();
    } catch (error) {
      root.render(
        <StrictMode>
          <LoginFailed
            message={
              error instanceof Error ? error.message : "알 수 없는 이유입니다."
            }
          />
        </StrictMode>,
      );
      return;
    }
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
