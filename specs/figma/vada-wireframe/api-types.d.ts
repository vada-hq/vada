// 자동 생성: npm run api:types. 직접 수정하지 않는다.
export interface paths {
    "/api/home/briefing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 홈 브리핑의 인사 제목. 사용자 이름이 들어가므로 서버가 완성해서 준다. */
        get: operations["home.briefing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/briefing/notices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 브리핑이 짚어 주는 문장들. 짚을 것이 없으면 빈 목록이므로 개수가 데이터에 달렸다. */
        get: operations["home.briefingNotices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/event-counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 홈 상단에 나열하는 행사·일정 건수. */
        get: operations["home.eventCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 진행 중이거나 예정된 행사. */
        get: operations["home.events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/schedules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 다가오는 주요 일정. */
        get: operations["home.schedules"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/org-alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 조직 운영에서 확인이 필요한 항목. 종류가 상황에 따라 달라지므로 개수가 데이터에 달렸다. */
        get: operations["home.orgAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home/finance-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 조직 전체의 재정 현황 요약.
         *
         *     **세는 말을 서버가 만든다**(2026-09-06). 한동안 네 조각이 전부 수였고 화면이 조각 이름의 끝을 보아 '%'와 '건'을 붙였다 — 규칙이 화면에 있었다. 그리고 수입이 0인 학생회에서는 나눌 바탕이 없는데도 0을 줄 수밖에 없어, '편성 전'과 '하나도 안 썼다'가 같은 값으로 보였다.
         */
        get: operations["home.financeSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
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
    "/api/sign-in/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 구글로 들어온다. 서버가 그 제공자의 주소를 만들어 주고 **브라우저가 그리로 떠난다** — 돌아오는 자리는 서버가 함께 정한다(로그인 화면으로 돌아오면 제자리이므로 첫 화면으로 보낸다).
         *
         *     **아직 계정이 없으면 이때 만들어진다.** 들어오는 것과 처음 오는 것을 가르지 않는다 — 사람은 그 둘을 구분해 누르지 않는다.
         */
        post: operations["auth.signInGoogle"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sign-in/kakao": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 카카오로 들어온다. 서버가 그 제공자의 주소를 만들어 주고 **브라우저가 그리로 떠난다** — 돌아오는 자리는 서버가 함께 정한다(로그인 화면으로 돌아오면 제자리이므로 첫 화면으로 보낸다).
         *
         *     **아직 계정이 없으면 이때 만들어진다.** 들어오는 것과 처음 오는 것을 가르지 않는다 — 사람은 그 둘을 구분해 누르지 않는다.
         */
        post: operations["auth.signInKakao"];
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
    "home.briefing": {
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
                        /** @description 인사 제목. 예: 박해랑님, 확인이 필요해요 */
                        title: string;
                    };
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.briefingNotices": {
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
                        /** @description 완성된 문장. 예: 지연된 업무가 1건 있습니다. */
                        message: string;
                    }[];
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.eventCounts": {
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
                        /** @description 진행 중 행사 수 */
                        activeEvents: number;
                        /** @description 예정 행사 수 */
                        upcomingEvents: number;
                        /** @description 이번 주 주요 일정 수 */
                        weeklySchedules: number;
                    };
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.events": {
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
                        /** @description 진행 상태. 예: 기획 중 */
                        status: string;
                        /** @description 행사 이름 */
                        title: string;
                        /** @description 행사 날짜. 정해지지 않았으면 '미정' */
                        date: string;
                        /** @description 장소. 정해지지 않았으면 '미정' */
                        place: string;
                        /** @description 주관 부서 */
                        team: string;
                        /** @description 준비 진행률(0-100) */
                        progressPercent: number;
                        /** @description 지연된 업무 수. 없으면 오지 않는다. */
                        delayedTaskCount?: number;
                    }[];
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.schedules": {
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
                        /** @description 월.일. 예: 07.20 */
                        date: string;
                        /** @description 일정 이름 */
                        title: string;
                        /** @description 일정의 성격. 예: 마감 */
                        badge: string;
                    }[];
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.orgAlerts": {
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
                        /** @description 알림의 종류. 화면은 종류마다 다른 아이콘을 그린다(디자인에 문서형·인원형 둘이 있다). */
                        kind: string;
                        /** @description 알림 이름. 예: 증빙 서류 누락 */
                        label: string;
                        /** @description 해당 건수 */
                        count: number;
                    }[];
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "home.financeSummary": {
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
                        /** @description 전체 예산 사용률(0-100). **막대가 쓰는 수다** — 그리는 길이를 정하는 것뿐이고, 사람이 읽는 말은 `budgetUsedNote`가 든다. 편성 전이면 0이다. */
                        budgetUsedPercent: number;
                        /** @description 전체 예산 사용률의 완성된 글. '34%'. **편성 전이면 '편성 전'이다** — 나눌 바탕이 없는데 0%를 주면 '다 남았다'로 읽힌다. */
                        budgetUsedNote: string;
                        /** @description 사용 가능 예산 비율의 완성된 글. '66%' 또는 '편성 전'. */
                        availableBudgetNote: string;
                        /** @description 승인·집행 예정 건수의 완성된 글. '4건'. */
                        plannedNote: string;
                        /** @description 증빙 누락 건수의 완성된 글. '5건'. */
                        missingProofNote: string;
                    };
                };
            };
            /** @description 로그인이 필요하다 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이 자리를 열 권한이 없다 */
            403: {
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
    "auth.signInGoogle": {
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
                        /** @description 브라우저가 이동할 구글 로그인 주소. 로그인 검증 쿠키는 응답의 Set-Cookie 헤더로 함께 전달한다. */
                        url: string;
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
    "auth.signInKakao": {
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
                        /** @description 브라우저가 이동할 카카오 로그인 주소. 로그인 검증 쿠키는 응답의 Set-Cookie 헤더로 함께 전달한다. */
                        url: string;
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
