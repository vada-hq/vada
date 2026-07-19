from fastapi import FastAPI

app = FastAPI(title="VADA API")


@app.get("/health")
def health() -> dict[str, str]:
    # 인증 없는 유일한 엔드포인트 — 배포·모니터링용
    return {"status": "ok"}
