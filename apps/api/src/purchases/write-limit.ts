import { createRateLimiter } from '../http/rate-limit.js'

// 요청 내기와 지출 적기는 계정마다 10초에 20번이고 한도를 같이 쓴다(기능 003 보내기와 같은 값).
// 두 라우트 모듈에 같은 인스턴스를 넘겨야 한도가 합쳐진다(serve.ts가 하나를 만들어 둘에 준다).
export const createPurchaseWriteLimiter = () => createRateLimiter({ limit: 20, windowMs: 10_000 })
