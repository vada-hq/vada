// 자동 생성: npm run api:types. 직접 수정하지 않는다.
export interface paths {
    "/api/app/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 앱을 열면 어느 화면부터인가.
         *
         *     **아는 쪽이 답한다.** 로그인했는지, 이미 어느 학생회에 속했는지는 세션이 정하고 그것은 서버에 있다. 화면이 판정하면 세션을 못 읽으므로 판정할 수가 없다.
         *
         *     **한동안 앱이 무조건 ONB-01로 갔다**(2026-09-08에 사람이 겪었다). 이미 들어온 사람도 열 때마다 학적 정보 화면부터 봤고, 로그인 화면으로 데려가는 길은 아예 없어서 주소를 직접 쳐야 했다.
         *
         *     **로그인 없이 물을 수 있다.** 안 그러면 로그인 안 한 사람이 이것을 못 물어 어디로 갈지 알 수 없다. 답은 화면 이름 하나뿐이라 새는 것이 없다.
         */
        get: operations["app.start"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description 실패했을 때 오는 것. **무엇이 잘못됐는지는 상태 코드가 말하고, 사람에게 보일 글은 여기 담긴다.** 한동안 '아직 정하지 않았다'로 자리만 비워 두었는데 이제 정해졌다 — 코드는 자리마다 손으로 적지 않고 **명세에서 끌어낸다.** 권한 영역이 401·403을, 자리에 박힌 인자가 404를, 되풀이될 때의 성질이 409를, 보내는 값이 있으면 422를, 로그인 없이 열리는 자리가 429를 말한다. **조각을 더 두지 않는다** — 어느 칸이 틀렸는지를 담을 어휘가 아직 없고, 지어내면 그 거짓이 서버까지 간다(화면은 보내기 전에 이미 필수 칸을 본다). */
        Error: {
            /** @description 사람에게 보일 글 */
            message: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "app.start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 여기부터 연다. 로그인 안 했으면 들어오는 자리, 로그인했는데 아직 어느 학생회에도 없으면 소속 입력, 이미 속했으면 홈이다. */
                        screenId: string;
                    };
                };
            };
            /** @description 너무 자주 눌렀다 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 그 밖의 실패 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}

/** 선택한 API의 JSON 성공 응답. 응답 본문이 없는 계약은 never다. */
export type ApiResponse<Id extends keyof operations> =
    operations[Id] extends { responses: { 200: { content: { "application/json": infer Body } } } }
        ? Body
        : never;
