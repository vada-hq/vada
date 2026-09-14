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
    "/api/shell/organization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 사이드바에 표시하는 조직 이름. 보는 사람의 소속에 따라 달라진다. */
        get: operations["shell.organization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/shell/viewer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 사이드바 아래에 표시하는 보는 사람의 이름과 소속·직책. */
        get: operations["shell.viewer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/task-alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 내 업무 화면 상단에 나열하는 상태별 건수. 항목이 명세에 고정이라 summary가 읽는다. */
        get: operations["my.taskAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/task-tab-counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 업무 탭마다 곁들이는 건수. fields의 key가 탭 선택지의 value와 같다 — 선택지는 명세가, 건수는 데이터가 정한다. */
        get: operations["my.taskTabCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 내가 처리할 업무. 고른 탭과 검색어로 걸러서 서버가 준다 — 받아온 것을 화면에서 거르지 않는다. */
        get: operations["my.tasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/intro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 허브의 안내 문장. 보는 사람의 이름이 들어가므로 서버가 완성해서 준다(home.briefing과 같은 이유). */
        get: operations["ops.intro"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/space-stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 공간 4개가 각각 곁들이는 건수. 공간 자체는 제품이 정한 고정 구조라 명세가 갖고, 건수만 서버가 준다. */
        get: operations["ops.spaceStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/tasks/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 상시 업무 보드 위에 나열하는 상태별 건수. 보는 범위와 무관하게 보드 전체를 센다. */
        get: operations["task.alerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 칸반 열 하나에 담기는 상시 업무. 보는 범위(scope)와 열의 단계(status)로 걸러서 서버가 준다 — 열마다 따로 조회한다. */
        get: operations["task.board"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/attention": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의 목록 위의 띠. **보는 사람에 따라 통째로 달라진다** - 와이어프레임이 넷을 그렸다(일반 참가자·진행 권한자·회의 생성 가능·미참가자). 누가 보느냐는 서버만 알므로 제목도 설명도 곁의 값도 서버가 준다.
         *
         *     명세가 넷을 들고 있으면 역할이 하나 늘 때마다 명세가 틀린다.
         */
        get: operations["meeting.attention"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 묶음으로 오는 회의 목록. 묶음 하나가 행사 하나이고, 어느 행사에도 속하지 않는 회의는 '정기·상시 회의' 묶음으로 온다. 묶음 수가 데이터에 달려 있어 명세가 묶음마다 조회를 미리 적을 수 없으므로 한 번에 묶어서 온다 — 칸반의 열(명세에 고정)과 다른 점이다. */
        get: operations["meeting.groups"];
        put?: never;
        /** 회의를 만든다. 유형·기본 정보·일정·참가자와 권한·안건을 한 번에 보낸다 */
        post: operations["meeting.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 진행 중인 행사 목록. 완료된 행사는 오지 않는다 — 머리의 별도 이동이 그것을 본다. 행사명(query)과 진행 단계(status)로 걸러서 서버가 준다. */
        get: operations["event.list"];
        put?: never;
        /** 행사를 만든다. 행사명 하나만 받고 나머지는 행사 공간에서 채운다 */
        post: operations["event.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 작업 공간의 머리에 늘 붙는 한 줄. 어느 행사인지는 화면이 받은 eventId가 정한다. 이 줄은 행사의 갈피(개요·업무·문서…)를 옮겨 다녀도 그대로이므로 화면이 아니라 행사에 딸린 값이다. */
        get: operations["event.workspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 업무 보드 위에 놓이는 행사 카드. 어느 행사인지는 화면이 받은 eventId가 정한다. */
        get: operations["event.summary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/tasks/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 업무 보드 위에 나열하는 상태별 건수. 보는 범위와 무관하게 이 행사의 보드 전체를 센다 — 상시 업무의 task.alerts와 세는 대상이 다르다. */
        get: operations["event.taskAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 칸반 열 하나에 담기는 업무. 어느 행사인지(eventId)와 보는 범위(scope), 열의 단계(status)로 걸러서 서버가 준다 — 열마다 따로 조회한다. */
        get: operations["event.taskBoard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/overview/briefing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 개요 맨 위의 안내. 지금 무엇을 봐야 하는지를 서버가 문장으로 완성해 준다 — 무엇을 급한 것으로 셀지는 화면이 정할 수 없다. */
        get: operations["event.overviewBriefing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/overview/highlights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 개요의 강조 카드 셋. 카드는 명세에 고정이고 값과 부연만 서버가 준다. */
        get: operations["event.overviewHighlights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/basics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사의 기본 정보. 사람이 입력한 값이고, 비어 있으면 완성된 안내로 온다. */
        get: operations["event.basics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/recruit-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 모집(참여 설문) 설정. 이 화면은 보여주기만 하고 고치는 것은 참여 설문 화면이 한다. */
        get: operations["event.recruitSettings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participant-stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참가 현황 타일 넷. 타일은 명세에 고정이고, 값과 그 아래 보조 문구를 서버가 준다. */
        get: operations["event.participantStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/checklist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 지금 확인해야 할 항목. 개수도 내용도 행사의 상태가 정한다. */
        get: operations["event.checklist"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/recent-changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 최근 변경 사항. 때는 오늘·어제 같은 상대적인 말이 섞이므로 화면이 유도할 수 없다. */
        get: operations["event.recentChanges"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/task": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 업무 하나의 값. 어느 업무인지는 화면이 받은 taskId가 정한다 — 이 화면은 목록이 아니라 한 건의 상세다. */
        get: operations["task.detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/task/reference-documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 업무가 따르는 공식 문서. 업무의 것이 아니라 행사의 공용 원본이라 여러 업무가 같은 것을 본다. */
        get: operations["task.referenceDocuments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/task/work-documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 업무에서 만들고 있는 파일과 문서. 표로 그린다 — 열은 design이 정한 카피다. */
        get: operations["task.workDocuments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/task/review-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 업무의 검토가 어디까지 왔는지. 딱지 둘과 검토 의견, 그리고 다음에 할 일을 알리는 문구다. */
        get: operations["task.reviewStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/documents/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 문서 화면 머리의 타일 셋. 어느 행사인지는 화면이 받은 eventId가 정한다. 값은 단위까지 붙어서 온다 — 화면이 숫자에 '개'를 붙이지 않는다. */
        get: operations["event.documentStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/documents/counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 문서 상태 필터의 선택지마다 곁들이는 개수. 조각의 key가 선택지의 value와 같다(event.documentStatus) — 선택지는 명세에 고정이고 개수만 데이터가 준다. 어느 행사인지는 화면이 받은 eventId가 정한다. */
        get: operations["event.documentStatusCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 문서 표의 한 줄. 어느 행사인지(eventId)와 고른 상태(status)로 걸러서 서버가 준다 — 받아온 것을 화면에서 거르지 않는다. */
        get: operations["event.documents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/meetings/counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 관련 회의 묶음의 머리에 붙는 건수. 어느 행사인지는 화면이 받은 eventId가 정한다. 무엇을 어떤 단계로 세는지는 화면이 알 수 없어 완성된 문구로 온다 — 상태 목록이 조직 운영에 따라 늘 수 있다. */
        get: operations["event.meetingCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/meetings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 행사에 연결된 회의. 어느 행사인지는 화면이 받은 eventId가 정한다. 회의 전체 목록(meeting.groups)과 다른 것이다 — 저쪽은 행사별로 묶어 오고 카드에 담기는 조각도 더 많다. */
        get: operations["event.meetings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 일정 줄 하나. 어느 행사인지(eventId)와 좁혀 보기(filter)로 걸러서 서버가 준다 — 받아온 것을 화면에서 거르지 않는다. 여기 오는 것은 원본이 아니라 비친 것이다: 업무 마감·회의 일시·행사 기본정보가 각자 원본이고 이 목록은 그것을 한 줄로 모아 온다. */
        get: operations["event.schedule"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참가자 명단의 한 줄. 검색어와 거르기 넷, 그리고 쪽 번호로 걸러서 서버가 준다 — 받아온 것을 화면에서 거르지도 자르지도 않는다. 참가자는 학생회 구성원이 아닐 수 있어 조직 명단(org.members)과 다른 것이다. */
        get: operations["event.participants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants/paging": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참가자 명단이 몇 쪽이고 모두 몇 명인지. 목록은 한 쪽만큼만 받아 오므로 자기가 말할 수 없다. 거르는 조건이 같아야 같은 수가 나오므로 쪽 번호만 빼고 목록과 같은 인자를 받는다. */
        get: operations["event.participantPaging"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/finance/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 재정의 금액 넉 줄. 세는 방법(무엇을 승인으로 보고 무엇을 지출로 보는지)은 조직의 재정 규칙이 정하므로 화면이 빼거나 더하지 않는다 — 네 값이 다 서버에서 온다. 자릿점까지 찍힌 글로 오는 것은 화폐 표기가 조직·지역의 것이기 때문이다. */
        get: operations["event.financeSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/finance/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 재정에서 지금 사람 손이 필요한 건수. 금액(event.financeSummary)과 다른 것이라 따로 온다 — 행사 업무의 요약과 주의 건수가 갈려 있는 것과 같다. */
        get: operations["event.financeAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/finance/board": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 재정 보드의 카드 하나. 처리 단계(stage)마다 따로 조회한다 — 단계는 명세에 고정이고(디자인이 네 열을 그린다) 각 열에 몇 장이 오는지가 데이터에 달렸다. 행사 업무 보드와 같은 모양이다. */
        get: operations["event.financeBoard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-request-draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 작성하거나 고치는 구매 요청 한 건. 이 화면의 입력을 채운다. requestId가 비면 아직 아무것도 적히지 않은 요청이 오며, 그때도 서버가 이미 아는 것(작성자의 소속 부서)은 채워져 온다. */
        get: operations["finance.purchaseRequestDraft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/detail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 구매 요청 한 건의 겉면과 지금 어느 단계인지. 화면 머리의 요약 카드와 진행 단계 줄이 함께 읽는다. */
        get: operations["finance.purchaseRequestDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 요청에 담긴 품목마다의 처리 결과. 개수는 요청이 정한다. */
        get: operations["finance.purchaseRequestItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 요청에 무슨 일이 있었는지. 시간순으로 온다 — 화면이 다시 정렬하지 않는다. */
        get: operations["finance.purchaseRequestHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/finance/my-requests/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 이 행사에서 내가 낸 구매 요청의 머리. 누가 보고 있는지는 셸도 알지만, 그 이름을 화면이 문장으로 잇지 않는다 — 무엇을 어떻게 부를지는 서버가 정한다(EVT-FIN-01의 itemsNote와 같은 계열).
         *
         *     상태별 개수는 진행 단계와 다른 축이다. '보완 필요'는 어느 단계에서도 생길 수 있는 상태이지 단계가 아니다 — 요청 하나는 단계 하나와 상태 하나를 함께 갖는다.
         */
        get: operations["event.myPurchaseRequestSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/finance/my-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 행사에서 내가 낸 구매 요청들. 누가 냈는지로 거르는 것은 서버가 한다 — 화면은 받아온 것을 다시 자르지 않는다. */
        get: operations["event.myPurchaseRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 요청에 걸린 보완 요청의 머리. 누가 언제 걸었고 언제까지 다시 내야 하는지가 각각 완성된 문구로 온다 — 무엇을 무엇이라 부를지는 조직의 표기다. */
        get: operations["finance.supplementRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 보완이 걸린 품목들. 한 요청에서 여럿일 수 있다 — 재정부가 품목마다 따로 보완을 건다(사람이 확인했다). 늘리거나 지울 수 없다. */
        get: operations["finance.supplementItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement/fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 보완 품목에서 다시 받아야 할 칸들. **무엇을 묻는지는 그 품목의 구매 유형이 정한다**(사람이 확인했다) — 제작·인쇄는 사이즈·색상·인쇄 위치를 묻고 온라인 구매는 판매처와 상품 URL을 묻는다. 칸 목록을 명세가 들고 있으면 유형이 하나 늘 때마다 명세가 틀린다. */
        get: operations["finance.supplementInputFields"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 보완 품목에서 받아야 할 파일들. 입력 칸과 같은 이유로 데이터가 정한다 — 견적서를 몇 장 받는지는 조직의 재정 규칙이다. */
        get: operations["finance.supplementAttachments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 검토할 구매 요청의 머리. FIN-REQ-02의 상세와 겹치는 조각이 있지만 같은 출처를 쓰지 않는다 — 저쪽은 요청한 사람이 보는 것이고 이쪽은 재정부가 보는 것이라, 예산 사용 가능액처럼 요청자에게 보이지 않는 값이 함께 온다. */
        get: operations["finance.reviewSummary"];
        put?: never;
        /**
         * 품목마다의 판정과 승인액을 요청자에게 보낸다. 보완이 하나라도 있으면 나가는 것이 보완 요청이고 전부 승인이면 검토가 끝난 것인데, 보내는 일은 하나다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.sendReview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/review/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 검토할 품목들. 재정부는 품목마다 따로 판정하므로 목록이 곧 판정의 단위다. */
        get: operations["finance.reviewItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/orders/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 구매·발주 단계에 있는 요청의 머리. 검토가 끝난 뒤라 '요청액'이 아니라 '승인된 금액'이 온다 - 무엇이 승인됐는지는 검토가 정했고 이 단계는 그것을 사서 받는 일이다. */
        get: operations["finance.purchaseOrderSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 이 요청의 발주들. **묶음 하나가 업체 하나**다 - 품목을 어느 업체에서 사느냐로 주문이 갈리고, 주문일도 담당도 배송도 업체마다 따로 간다. 업체 수가 데이터에 달려 있어 명세가 묶음마다 조회를 미리 적을 수 없으므로 한 번에 묶어서 온다.
         *
         *     아직 주문하지 않은 업체도 온다 - 주문일과 담당이 '—'로 오고, 그 묶음의 품목은 주문 상태가 '품절·변경 필요' 같은 것이다. 없는 것과 아직 안 한 것은 다르다.
         */
        get: operations["finance.purchaseOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/evidence/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 결제·증빙 단계에 있는 요청의 머리. 승인 금액과 실결제 합계가 따로 온다 - **둘이 다를 수 있고, 그 차이가 이 단계에서 드러나는 것**이 이 화면의 일이다.
         *
         *     끝낼 수 있는지도 서버가 안다. 무엇이 '증빙이 다 모인 것'인지는 조직의 규칙이라 화면이 셀 수 없다 - 영수증만 있으면 되는 결제도 있고 세금계산서까지 있어야 하는 결제도 있다.
         */
        get: operations["finance.paymentEvidenceSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 이 요청의 결제들. **묶음 하나가 결제 하나**다 - 업체마다 언제 무엇으로 냈는지가 다르고, 그 결제에 딸린 품목과 증빙도 함께 온다.
         *
         *     연결된 품목과 증빙 서류를 따로 조회하지 않는 이유는 그것이 그 결제의 일부이기 때문이다. 결제 셋이면 여섯 번을 더 물어야 하고, 무엇보다 그 목록은 따로 있는 것이 아니다.
         */
        get: operations["finance.paymentEvidences"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/area-summaries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 조직 관리 영역 셋이 각각 곁들이는 한 줄. 영역 자체는 제품이 정한 고정 구조라 명세가 갖고(ops.spaceStats와 같은 이유), 그 곁의 한 줄만 서버가 준다.
         *
         *     **셈한 숫자가 아니라 완성된 문장을 받는다.** 디자인이 '부서 5개 · 구성원 18명'을 글자 하나로 그렸기 때문이다 - 라벨과 값이 따로 그려지는 OPS-00의 타일과 다르다. 쪼개서 다시 이으려면 어디를 어떻게 잇는지를 명세가 정해야 하는데 그것은 표현이고, 표현은 design의 몫이다. 게다가 셋째 줄의 '확정된 권한 매트릭스'는 라벨-값 쌍이 아예 아니다 - 쪼갤 수 있다는 가정 자체가 틀렸다.
         */
        get: operations["org.areaSummaries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/chart-title": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 조직도의 제목. 몇 대 학생회인지가 제목이라 화면이 지어낼 수 없다. */
        get: operations["org.chartTitle"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/executives": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회장단 구성원. 회장단은 부서와 달리 **항상 있는 자리**라 목록 하나로 따로 온다(list.rootItem이 조직 구조를 만들 때 같은 것을 말한다). */
        get: operations["org.executives"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 부서와 그 안의 사람들. **부서 수는 데이터가 정한다** - 조직을 만들 때 사람이 더하고 지운다(ORG-02).
         *
         *     leaders는 0개이거나 1개다. 부서장은 한 사람뿐이지만 **없을 수도 있어서** 값 하나가 아니라 목록이다 - 빈 문자열로 '없음'을 말하면 이름이 빈 사람과 구별되지 않는다.
         *
         *     이름으로 좁혀 볼 수 있다(MSG-02의 '이름 검색'). **부서 이름을 찾는 것인지 그 안의 사람 이름을 찾는 것인지 그림이 말하지 않는다** — 찾은 뒤의 목록이 그려져 있지 않아 명세가 정하지 않고 서버에 맡긴다.
         */
        get: operations["org.departments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/unassigned-members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 아직 어느 자리에도 배정되지 않은 구성원. **조직에서 지운 사람이 아니다** - 가입은 했는데 부서가 정해지지 않은 상태이며, INV-01의 '참여하면 미배정 구성원으로 등록됩니다'가 그 자리를 말한다.
         *
         *     옮길 수 있는 목록들이 전부 이 출처를 가리킨다(itemMove.poolSourceKey). 그것이 '같은 무리'라는 뜻이고, 그래서 회장단의 사람을 부서로 옮길 수 있다.
         */
        get: operations["org.unassignedMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/unassigned-hint": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 미배정 구성원 패널의 안내 한 줄. 몇 명인지와 어떻게 옮기는지가 글자 하나로 그려져 있어 서버가 완성해 보낸다(ORG-00의 '부서 5개 · 구성원 18명'과 같은 자리다). */
        get: operations["org.unassignedHint"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/invite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학생회에 들어오는 초대. 링크와 코드가 **같은 권한**이라 한 건으로 온다 - 둘을 따로 두면 하나만 되살렸을 때 어느 것이 유효한지 화면이 정하게 된다.
         *
         *     **읽는 것도 회장단만이다.** `member`로 매어 두었더니 일반 부원이 링크와 코드를 그대로 읽을 수 있었다 — 다시 만들지는 못해도 지금 가입 열쇠를 복사해 나눌 수 있다. '초대는 회장단만'이 다시 만드는 것만 뜻한 것이 아니다(2026-08-31 교차검토).
         */
        get: operations["org.invite"];
        put?: never;
        /** 링크와 코드를 함께 다시 만든다. 전에 나눠 준 것이 전부 듣지 않게 된다. */
        post: operations["org.regenerateInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/role-counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 기본 역할마다 지금 몇 사람인지. 역할 셋은 제품이 정한 고정 구조라 명세가 갖고(ORG-04B가 바꾸는 것은 사람의 역할이다), 수만 서버가 준다. */
        get: operations["org.roleCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/permission-matrix": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 기능 영역마다 역할 셋이 무엇을 할 수 있는지. 한 줄이 기능 영역 하나다.
         *
         *     칸에 그려지는 것은 '가능'·'재정부만'처럼 **완성된 말**이고 색 이름이 함께 온다 - '되는가 안 되는가'가 아니라 '어떤 조건에서 되는가'까지가 답이기 때문이다. 명세가 그 말의 목록을 들고 있으면 조건이 하나 늘 때마다 명세가 틀린다.
         */
        get: operations["org.permissionMatrix"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/role-assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 구성원마다 지금 어떤 기본 역할인지. 이름·소속과 함께 온다 - 누구의 역할을 바꾸는지가 이름만으로는 갈리지 않기 때문이다(같은 이름이 여럿 있다). */
        get: operations["org.roleAssignments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/role-assignments/count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 기본 역할을 가진 구성원이 몇인지. 목록 곁의 한 줄이다. */
        get: operations["org.roleAssignmentCount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/members/{memberId}/role-assignment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 목록에서 고른 구성원 한 사람(ORG-04B).
         *
         *     **한동안 서버가 '마지막으로 고른 사람'을 기억해 주고 있었다** — 누구를 고를지 화면이 넘길 어휘가 없었기 때문이다. 그것은 사람마다 다른 서버 상태라 두 사람이 같은 화면을 열면 서로의 고른 것을 본다. 이제 화면이 고른 사람을 인자로 넘긴다.
         */
        get: operations["org.selectedRoleAssignment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/roster/scope": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 명단이 다루는 범위와 마지막으로 갱신된 때. 범위는 조직 설정이 정하므로 이 화면이 지어낼 수 없다. */
        get: operations["org.rosterScope"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/students": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 명단에 등록된 학생. 학생회 구성원과 다르다 - 이 명단은 단과대학 학생 전체이고 행사 참가 확인과 학생회비 조회에 쓴다(ORG-00의 카드가 그렇게 말한다). */
        get: operations["org.students"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/students/paging": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 학생 명단의 총 건수와 쪽 수. 한 쪽만 받아 오므로 목록 자신이 말할 수 없다. */
        get: operations["org.studentPaging"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의 한 건. **03·05·06·07·08·09가 전부 이것을 읽는다.** 상태마다 출처를 가르지 않는다 — 가르면 화면이 '지금 어느 단계인가'를 알아야 하고, 그것은 명세가 상태를 아는 것이 된다. 그 단계에 없는 조각은 오지 않으면 된다(meeting.groups의 badge와 같은 규칙).
         *
         *     와이어프레임 16장을 한꺼번에 읽고 정했다. 하나씩 열어 가며 정했으면 네 번째 화면에서 갈라졌을 자리다.
         */
        get: operations["meeting.detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/agendas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 회의의 안건들. **단계마다 갖는 것이 다르다** — 예정일 때는 예상 소요와 사전 자료를, 진행 중에는 논의 내용과 결정을, 끝난 뒤에는 확정된 결정을 갖는다. 그래도 출처는 하나다: 넷으로 가르면 화면이 단계를 알아야 한다. */
        get: operations["meeting.agendas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 이 회의의 사람들. **03의 참가자 목록, 05의 참가 현황, 07의 참석 결과, 04B의 권한 관리 목록이 전부 같은 사람들이다.** 그리는 자리가 다를 뿐 무엇인지는 하나다 — 16장을 한꺼번에 보고 나서야 합칠 수 있었다.
         *
         *     딱지와 할 수 있는 일 설명은 반드시 서버가 준다. 역할 이름을 명세가 들면 역할이 하나 늘 때마다 명세가 틀린다.
         *
         *     04B는 생성자를 위 칸에 따로 그리므로 목록에서 뺀다(excludeHostOwner). 화면이 받아 온 것을 걸러 내지 않는다 — 거르는 것은 조회의 일이다.
         */
        get: operations["meeting.participants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/minutes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회의록의 전체 요약. 안건마다의 기록은 meeting.agendas가 갖고, 여기 있는 것은 회의 전체를 한 덩이로 줄인 글이다. 없을 수 있다 — 06B가 빈 상태를 그렸고, '요약이 없어도 정리 완료가 막히지는 않습니다'라고 적어 두었다. */
        get: operations["meeting.minutes"];
        /** 안건 하나의 정리 내용을 보낸다(06B의 결정사항과 두 체크) */
        put: operations["meeting.saveMinutes"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/minutes/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회의록 정리가 어디까지 왔는지. **조건 목록을 서버가 준다** — 06A는 넷을 세고 06B는 다섯 중 필수 넷을 세는데, 같은 회의의 같은 진행도다. 명세가 조건을 들면 둘 중 하나는 반드시 틀린다. */
        get: operations["meeting.minutesProgress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/minutes/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의록의 각 부분이 지금 어디까지 왔는지(OPS-MEET-06A의 '현재 정리 현황').
         *
         *     **meeting.minutesProgress와 다른 사실이다.** 저것은 '정리를 마칠 수 있는가'를 조건으로 세고(06B의 '정리 완료 조건'), 이것은 '지금 어디까지 왔는가'를 부분마다 말한다. 한동안 둘을 하나로 보았는데, 그러면 같은 회의를 두 화면이 서로 다른 목록으로 그린 것이 설명되지 않는다 — 06A는 '안건 내용 2 / 3 정리'를 그리고 06B는 '안건별 논의 내용 ✓'을 그린다. 라벨도 개수도 다르고, 한쪽은 세어 온 문구이고 한쪽은 참·거짓이다.
         *
         *     **부분 목록을 서버가 준다.** 회의록이 몇 부분으로 이루어지는지는 조직의 양식이 정하고, 명세가 그 목록을 들면 양식이 바뀔 때마다 명세가 틀린다.
         */
        get: operations["meeting.minutesStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 회의에 붙은 자료. 안건의 사전 자료와 회의록의 관련 자료가 같은 물건이다. */
        get: operations["meeting.documents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/follow-ups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 회의에서 나온 후속 업무. **와이어프레임은 빈 상태만 그렸다** — 07·08 둘 다 0건이라 항목이 무엇으로 이루어지는지, 눌러서 어디로 가는지 그림이 말하지 않는다. 그래서 조각을 지어내지 않고 본 것만 적었다. 채워진 모습이 그려지면 는다. */
        get: operations["meeting.followUps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/follow-ups/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 이 회의가 나에게 배정한 후속 업무(OPS-MEET-08).
         *
         *     **meeting.followUps와 다른 물음이다.** 저것은 '이 회의가 만든 후속 업무'이고 이것은 '그중 내 것'이다. 한동안 같은 출처에 onlyMine 인자를 붙여 갈랐는데, 그러면 **비었을 때 할 말이 하나뿐이 된다** — 그림은 둘을 다르게 적었다. 07은 '회의록 정리에서 생성한 후속 업무 카드가 여기에 표시됩니다', 08은 '나에게 배정된 미완료 후속 업무가 없습니다'.
         *
         *     비었다는 말이 다르면 묻는 것이 다른 것이다.
         */
        get: operations["meeting.myFollowUps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/permission-notice": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 진행 권한이 무엇을 주고 무엇을 안 주는지. **명세가 이 글을 들면 권한이 하나 늘 때마다 명세가 틀린다.** 04B의 안내 상자와 D03의 확인 글이 같은 것을 말하므로 둘이 나눠 쓴다. */
        get: operations["meeting.permissionNotice"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/start-confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회의를 시작해도 되는지 살펴 준 것(D01). 며칠 이른지는 서버만 안다. */
        get: operations["meeting.startConfirm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/end-confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회의를 끝내도 되는지 살펴 준 것(D02). **막지는 않는다** — 미완료 안건이 남아도 종료 단추는 살아 있다. 알려 줄 뿐이다. */
        get: operations["meeting.endConfirm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/host-grant-confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 누구에게 진행 권한을 주려는지(D03). **제목에 사람 이름이 박혀 있으므로 서버가 완성해 준다** — 명세가 '{이름}에게 …'를 조립하면 그 문장이 명세의 것이 되고, '진행 권한'이라는 역할 이름이 명세에 고정된다. */
        get: operations["meeting.hostGrantConfirm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의를 만들거나 고칠 때 화면이 처음 받는 값(OPS-MEET-02). meetingId가 없으면 새로 쓰는 것이다 — FIN-REQ-01이 requestId를 그렇게 쓴 선례를 따른다.
         *
         *     **수정 상태의 그림이 없다.** 이미 진행 중이거나 끝난 회의를 열었을 때 무엇이 잠기는지 와이어프레임이 한 장도 그리지 않았다. 지어내지 않았다.
         */
        get: operations["meeting.draft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 참가자로 넣을 수 있는 사람들(OPS-MEET-02·04B의 검색). 검색 칸이 있으면 찾을 데가 있어야 한다.
         *
         *     **04B의 라벨 없는 드롭다운(20:803)이 무엇을 거르는지 그림이 말하지 않는다.** 자식이 하나도 없는 빈 프레임이라 인자를 지어내지 않았다.
         */
        get: operations["meeting.memberCandidates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/host-owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의를 만든 사람 한 명(OPS-MEET-04B의 맨 위 칸). meeting.participants의 한 줄과 조각이 겹치지만 **목록에서 한 줄을 집는 어휘가 없다** — summary는 값 묶음 하나만 받는다. ORG-04B가 같은 벽에서 org.selectedRoleAssignment를 따로 만들어 넘어갔고, 이것이 두 번째 자리다.
         *
         *     값도 목록의 그 줄과 다르다. 04B는 생성자를 '권한 변경 및 회의 관리 가능'이라 적고 03A는 같은 사람을 '시작·종료 가능'이라 적는다 — 무엇을 보여주는 자리냐가 다르기 때문이다.
         */
        get: operations["meeting.hostOwner"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/viewer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 목록을 보는 사람이 무엇을 할 수 있는가. **변형을 가르는 값이다** — meeting.attention.canCreateMeeting과 같은 계급이고, 역할 이름이 아니라 할 수 있는 일로 가른다. */
        get: operations["event.listViewer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/wrap-up": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 후속 정리 중인 행사의 상태 줄과 띠(EVT-02D). **행사의 상태와 그것을 누가 바꿀 수 있는지를 서버가 함께 준다** — '행사 완료 처리는 회장단만 할 수 있습니다'를 명세가 들면 권한이 바뀔 때마다 명세가 틀린다. */
        get: operations["event.wrapUpBanner"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/wrap-up/counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 후속 정리 현황 타일 넷(EVT-02D). 타일이 넷이라는 것은 명세가 정하고 (모든 행사가 같다) 값과 색만 서버가 준다. */
        get: operations["event.wrapUpCounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/wrap-up/remaining": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아직 남은 항목 하나하나(EVT-02D). 줄마다 그 원본으로 간다. */
        get: operations["event.wrapUpRemaining"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/end-permission": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사를 끝내려 할 때 누가 할 수 있는지(EVT-02C). **역할 이름이 여기 들어간다** — '행사 운영 조직 관리자 또는 회장단'을 명세가 들면 조직 규칙이 바뀔 때마다 명세가 틀린다. */
        get: operations["event.endPermission"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/complete-confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사를 완료 처리해도 되는지 살펴 준 것(EVT-02E). **막지는 않는다** — 남은 것이 있어도 알려 줄 뿐이다(meeting.endConfirm과 같은 자리). */
        get: operations["event.completeConfirm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/leaders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 운영 조직의 책임자(EVT-01·03A·03B). org.executives와 같은 모양이지만 **다른 물건이다** — 학생회의 기본 조직이 아니라 이 행사에만 있는 조직이다. */
        get: operations["event.staffLeaders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 운영 조직의 부서들(EVT-01·03A·03B). 부서마다 부서장과 부원이 안쪽 목록으로 함께 온다. */
        get: operations["event.staffDepartments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/unassigned": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아직 어느 부서에도 배정되지 않은 사람(EVT-03B의 오른쪽 기둥). org.unassignedMembers와 같은 자리다. */
        get: operations["event.staffUnassignedMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 고른 방식으로 만들어질 운영 조직의 미리보기(EVT-01). event.staffDepartments와 같은 조각이지만 **아직 만들어지지 않은 것**이라 조회 인자에 방식이 함께 든다. */
        get: operations["event.staffSetupPreview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/basics/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 기본정보 편집 패널이 처음 받는 값(EVT-02B). event.basics는 **그려진 한 줄**을 주고(예: '참가비 납부자 무료 / 미납자 5000원') 이것은 **고칠 칸 하나하나**를 준다 — 같은 사실의 다른 모습이라 조각이 갈린다. */
        get: operations["event.basicsDraft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/attendance-qr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참석 확인 QR(EVT-04B). **QR은 행사 상태와 따로 켜고 끈다** — 기획 중인 행사도 QR을 미리 만들 수 있고, 진행 중인 행사의 QR을 끌 수도 있다. */
        get: operations["event.attendanceQr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사의 참여 설문 한 건(EVT-05·05B). **행사의 상태와 다른 축이다** — 초안·활성·교체됨은 설문의 상태이고 기획 중·진행 중은 행사의 상태다 (회의의 status와 minutesStatus가 갈린 것과 같다). */
        get: operations["event.survey"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참여 설문의 모집 설정(EVT-05). 고칠 칸 하나하나를 준다. */
        get: operations["event.surveySettingsDraft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/activation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 설문 링크를 켤 수 있는지. **단추의 실행 조건이 이것을 읽는다** — 무엇이 모자란지는 서버가 세고, 화면은 막힌 까닭만 그린다. */
        get: operations["event.surveyActivation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/activation/conditions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 설문 링크를 켜기 위해 채워야 하는 것들(EVT-05). 묶음으로 온다 — 행사 기본정보에서 채울 것과 설문 설정에서 채울 것이 갈린다. */
        get: operations["event.surveyActivationConditions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/questions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참여 설문의 문항들(EVT-05). */
        get: operations["event.surveyQuestions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/replace-impact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 설문을 갈아 끼우면 무엇이 어떻게 되는지(EVT-05B). **응답이 있는 설문은 직접 고칠 수 없다** — 그 사실과 여파를 서버가 세어 준다. */
        get: operations["event.surveyReplaceImpact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/budget-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 학생회의 예산 편성 한 벌(FIN-PLAN-01). 이 화면의 입력을 채운다. 아직 아무것도 안 정한 학생회는 기간도 줄도 없이 온다 — 그것이 갓 만든 학생회의 첫 모습이다. 총예산은 수입의 합이고, 배정의 합은 그것을 넘지 못한다(넘으면 저장이 422다). 행사별 항목은 행사 id를 저마다 들고 오며, 화면의 '행사' 고르기는 그중 어느 행사의 줄을 보고 고칠지를 정한다. */
        get: operations["finance.budgetPlanDraft"];
        /** 예산 편성을 저장한다 — 기간·수입원·상시 항목·행사별 항목 전부를 한 번에. **덮어쓰기다**: 화면이 전부를 보내므로 안 보낸 줄은 지운 것이다. 배정의 합이 수입의 합을 넘으면 서버가 막는다(422). 사람이 정했다(2026-09-05): 행사 예산도 이 한 화면에서만 배정한다. */
        put: operations["finance.budgetPlan.save"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 조직 전체 재정의 겉면(FIN-00). 회계 기간·기준일부터 금액 넷과 집행률까지 한 벌로 온다 — 무엇을 실제 지출로 보고 무엇을 예정으로 보는지가 조직의 재정 규칙이라 화면이 더하거나 빼지 않는다. **행사 하나의 재정(event.financeSummary)과 다른 물건이다** — 저것은 eventId를 받고 이것은 학생회 전체를 센다. */
        get: operations["finance.orgOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/overview/breakdown": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 총예산을 무엇 단위로 나눠 본 표의 한 줄(FIN-00). 나누는 축(scope)이 행사별이냐 부서별이냐로 줄의 뜻이 통째로 바뀌므로 서버가 걸러서 준다 — 받아온 것을 화면에서 다시 나누지 않는다. */
        get: operations["finance.orgBreakdown"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/overview/recent-expenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 최근 지출 내역(FIN-00). **finance.ledger와 같은 장부다** — 저쪽은 전부를 걸러 볼 수 있게 주는 자리이고 이쪽은 겉면에 몇 줄만 얹는 자리다. 몇 줄을 얹을지는 서버가 정한다. */
        get: operations["finance.recentExpenses"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/overview/proof-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 증빙이 어디까지 됐는지(FIN-00의 오른쪽 칸). 세는 갈래 셋은 디자인이 고정으로 그렸고 값만 서버가 준다(event.wrapUpCounts와 같은 자리다). */
        get: operations["finance.proofSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/ledger/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 사용 내역 머리의 값 넷(FIN-LEDGER-01). 고른 달이 값을 바꾸므로 인자를 받는다. **달의 이름도 서버가 준다** — '7월 지출'의 '7월'은 고른 달이 정하는 것이라 명세가 고정 카피로 가질 수 없다. */
        get: operations["finance.ledgerSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/ledger": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학생회 장부의 한 줄(FIN-LEDGER-01). 달·행사·부서·예산 항목·검색어로 걸러서 서버가 준다 — 받아온 것을 화면에서 거르지도 자르지도 않는다. FIN-00의 최근 지출 내역(finance.recentExpenses)과 **같은 장부**다.
         *
         *     **결제 단계로도 걸린다**(stage). 전체 재정의 '실제 지출'과 '지출 예정'이 각각 그 단계만 보여 달라고 이 장부에 오기 때문이다 — 화면을 새로 만들지 않고 같은 장부를 다르게 자른다.
         */
        get: operations["finance.ledger"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/ledger/scope": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 지금 보고 있는 장부가 무엇의 몇 줄인지, 그리고 증빙을 어디서 처리하는지(FIN-LEDGER-01의 표 아래 줄). 목록은 잘려서 오므로 **몇 건 중 몇 건인지는 목록 자신이 말할 수 없다**(itemList의 paging이 총 건수를 따로 가리키는 것과 같은 이유다). 거르는 조건이 같아야 같은 것을 센다.
         *
         *     **결제 단계로도 걸린다**(stage). 전체 재정의 '실제 지출'과 '지출 예정'이 각각 그 단계만 보여 달라고 이 장부에 오기 때문이다 — 화면을 새로 만들지 않고 같은 장부를 다르게 자른다.
         */
        get: operations["finance.ledgerScope"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/calendar/month": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 월간 캘린더가 지금 보여주는 달. **어느 달인지는 서버가 정한다** — 달을 앞뒤로 옮기는 조작을 명세가 담을 어휘가 아직 없어(OPS-CAL-01의 30:2106·30:2112) 화면이 넘길 값이 없다. 그 어휘가 생기면 여기에 month 인자가 붙는다. */
        get: operations["ops.calendarMonth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/calendar/days": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 월 격자의 칸들. **항목 하나가 하루**이고 그 안의 schedules가 그날의 일정이다. 달에 들지 않는 앞뒤 빈칸도 항목으로 온다 — 몇 칸이 비는지는 그 달 1일의 요일이 정하고, 그것을 화면이 셈하면 달력의 규칙이 화면에 적힌다. */
        get: operations["ops.calendarDays"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/calendar/week-range": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이번 주 일정 패널의 머리. 어느 주이고 오늘이 언제인지를 **서버가 완성한 문장으로** 준다 — 화면이 날짜를 셈해 문장을 만들면 그 셈이 화면에 적힌다(finance.ledgerScope의 rangeNote와 같은 자리). */
        get: operations["ops.calendarWeekRange"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/calendar/week": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이번 주에 걸린 일정 줄. 월 격자와 같은 일정을 이번 주만 잘라 세로로 세운 것이다. **보고 있는 달과 무관하다** — '이번 주'는 오늘이 정한다. */
        get: operations["ops.calendarWeek"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/completed-events/alert": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 완료된 행사 목록 머리의 알림(REC-01). 인수인계 문서가 아직 발행되지 않은 행사가 몇 건인지 서버가 세어 완성된 문구로 준다 — 목록이 검색으로 걸러져도 이 수는 걸러지지 않는다. */
        get: operations["record.completedEventAlert"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/completed-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 완료 처리된 행사 목록(REC-01). event.list와 다른 물건이다 — 저쪽에는 완료된 행사가 오지 않는다. 행사명(query)으로 걸러서 서버가 준다. */
        get: operations["record.completedEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 행사의 아카이브 문서 자체(REC-02 · REC-02A). 발행 전에도 있다 — 쓰는 화면은 이름과 상태만 읽고, 발행된 문서는 누가 언제 쓰고 검토했는지까지 읽는다. 본문은 조각마다 다른 출처가 갖는다. */
        get: operations["record.archive"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/sections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브의 목차(REC-02 · REC-02A). 절의 개수와 이름을 서버가 준다 — 발행된 문서는 회고가 세 갈래로 펴지고(rows), 쓰는 중인 문서는 절마다 어디까지 썼는지가 함께 온다(statusLabel). 두 화면이 같은 목록을 다르게 그린다. */
        get: operations["record.archiveSections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/detail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브 본문 중 라벨이 고정된 열세 조각(REC-02의 개요·성과·현장 운영). 무엇을 적는 자리인지가 문서 서식으로 정해져 있어 명세가 라벨을 갖고, 값만 서버가 준다. */
        get: operations["record.archiveDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브의 타임라인(REC-02). 몇 개의 마디로 이루어지는지는 그 행사가 정한다. */
        get: operations["record.archiveTimeline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브가 근거로 삼은 원본들(REC-02). 수치는 발행 시점의 것이고, 원본은 지금도 행사 공간에 그대로 있어 눌러서 갈 수 있다. */
        get: operations["record.archiveEvidence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/retrospective": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브의 회고(REC-02). 묶음으로 온다 — 잘된 점·미흡했던 점·다음 행사 개선안이 갈리고, 묶음마다 줄 수가 다르다. */
        get: operations["record.archiveRetro"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/handover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브의 인수인계(REC-02). 회고와 같은 모양으로 묶음이 온다 — 재사용 자산·협력처·담당자·주의사항이 갈리고, 묶음마다 줄 수가 다르다. 다음 담당자는 이 목록이 아니라 문서 전체의 것이라 record.archive가 갖는다. */
        get: operations["record.archiveHandover"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/auto-filled": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 쓰는 중인 아카이브에서 사람이 고칠 수 없는 부분(REC-02A). 행사 데이터에서 서버가 줄여 만든 네 줄이며, 발행하면 그 시점 값으로 굳는다. */
        get: operations["record.archiveAutoFilled"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 쓰는 중인 아카이브에서 **사람이 직접 쓰는 칸들**(REC-02A). 이름·상태·AI 계약 문장은 문서 자체의 것이라 record.archive가 갖는다 — 여기 있는 것은 전부 화면의 칸으로 들어간다. 아직 아무것도 안 쓴 문서도 이것을 읽고 열린다(FIN-REQ-01의 draftFrom과 같은 규칙). */
        get: operations["record.archiveDraft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/gate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브를 다음 단계로 넘길 수 있는지(REC-02A). 단추의 실행 조건이 이것을 읽는다 — 무엇이 모자란지는 서버가 세고 화면은 막힌 까닭만 그린다(event.surveyActivation과 같은 자리). */
        get: operations["record.archiveGate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/gate/conditions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 아카이브를 발행하기 위해 채워야 하는 것들(REC-02A). 조건 목록을 서버가 준다 — 명세가 조건을 들면 문서 서식이 바뀔 때마다 명세가 틀린다(meeting.minutesProgress와 같은 이유). */
        get: operations["record.archiveGateConditions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 이 아카이브에 달린 검토 의견(REC-02A). 쓰는 사람이 아니라 검토자가 적는 값이라 초안(record.archiveDraft)과 갈린다. */
        get: operations["record.archiveReview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/organizations/by-invite-code/{inviteCode}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 초대 코드가 찾아낸 학생회(INV-01). **이 값은 코드가 정한다** — 그 전에는 명세가 '제12대 소프트웨어융합대학 학생회'를 고정 글로 들고 있었고, 어떤 코드를 넣어도 같은 학생회가 나왔다. */
        get: operations["org.invitedOrganization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/apply-form": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 링크로 열린 참여 신청 폼의 머리(EXT-02A). **행사의 출처를 그대로 쓸 수 없다** — event.basics는 eventId를 받고 학생회 안에서 보는 값인데, 이 화면은 로그인한 사람이 없고 가진 것이 설문 토큰뿐이다. 같은 사실의 밖에서 볼 수 있는 조각만 온다. */
        get: operations["survey.applyForm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/apply-result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 링크로 낸 참여 신청의 결과 한 장(EXT-02B). **바깥 출처는 안쪽 출처를 재사용하지 않는다** — event.basics·event.survey는 eventId를 받고 학생회 안에서 보는 값인데, 이 화면에는 로그인한 사람이 없고 가진 것이 설문 토큰뿐이다.
         *
         *     **'신청자: 김바다'는 로그인한 사람의 이름이 아니다.** 방금 낸 응답에서 온다. 그래도 화면의 입력 값이 아니라 서버가 답하는 조각인 까닭은 둘이다 — 이 화면은 신청 폼의 초안을 담는 자리가 아니고(그 스코프는 보내면서 비워진다), 링크를 다시 열었을 때도 같은 것이 보여야 한다.
         *
         *     제목까지 데이터인 까닭은 운영진이 그 문구를 쓰기 때문이다(EVT-05의 '신청 완료 안내 문구').
         *
         *     **이 사람의 이것 하나**를 가리키는 값. 낼 때 서버가 돌려준 영수증이다.
         *
         *     여기에 링크·QR의 토큰을 쓰면 안 된다 — **같은 링크와 같은 QR을 여러 사람이 쓴다.** 그것으로 조회하면 '이 토큰으로 낸 마지막 것'이 오고, 뒤에 낸 사람이 앞사람의 이름과 결과를 본다.
         */
        get: operations["survey.applyResult"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/link-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 설문 링크가 왜 막혔는지 한 장(EXT-02C). **막히지 않은 링크에는 이 답이 없다** — 서버가 상태를 보고 신청 폼이나 이 화면으로 보내므로(docs/decisions/product-decisions.md), 이 출처가 무언가를 답했다는 것 자체가 '지금은 받지 않는다'는 뜻이다.
         *
         *     **명세가 상태의 목록을 들지 않는다.** 무엇이 링크를 막는지는 모집 일정·정원·운영진의 조작이 정하고, 명세가 목록을 들면 하나 늘 때마다 명세가 틀린다. 그림이 다섯을 나란히 그린 것은 값의 나열이고 명세는 source.alsoDrawnAt으로 그 사실을 든다.
         */
        get: operations["survey.linkState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/attendance/check-in-form": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * QR로 열린 참석 확인 폼이 읽는 한 벌(EXT-01A). **학생회 사람이 아닌 이가 본다** — 로그인한 사람이 없으므로 무엇을 볼 수 있는지는 토큰만이 정한다. 그래서 경로가 /api/public/…이고 인자가 eventId가 아니라 checkInToken이다: QR은 껐다 켜고 다시 만들 수 있으므로(EVT-04B) 가리키는 것은 QR이지 행사가 아니고, eventId를 받으면 누구나 남의 행사의 참석 화면을 연다.
         *
         *     **지금 받을 수 있는지도 이 한 벌이 답한다.** blockedLabel·blockedTone·blockedNote 셋은 함께 오거나 함께 오지 않는다. 오면 체크인을 받지 않는 때이므로 화면은 이름·학번 칸을 아예 그리지 않고 그 자리에 그 까닭만 그린다 — 헛되이 입력하게 하지 않는다(사람이 정한 것: docs/decisions/product-decisions.md).
         */
        get: operations["attendance.checkInForm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/attendance/check-in-result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 참석 확인을 낸 뒤의 결과 한 장(EXT-01B). **결과가 서로 배타적이라 한 사람에게 하나만 온다** — 그래서 화면도 하나이고 카드 한 장이 데이터로 그려진다(와이어프레임이 여섯을 나란히 그린 것은 값의 나열이고, 명세는 source.alsoDrawnAt으로 그 사실을 든다).
         *
         *     **명세가 결과의 목록을 들지 않는다.** 무엇이 결과가 되는지는 조직의 참석 규칙이 정하고, 명세가 그 목록을 들면 규칙이 하나 늘 때마다 명세가 틀린다.
         *
         *     인자가 checkInToken인 까닭은 폼과 같다 — 이 토큰으로 낸 마지막 시도의 결과를 서버가 답한다.
         *
         *     **이 사람의 이것 하나**를 가리키는 값. 낼 때 서버가 돌려준 영수증이다.
         *
         *     여기에 링크·QR의 토큰을 쓰면 안 된다 — **같은 링크와 같은 QR을 여러 사람이 쓴다.** 그것으로 조회하면 '이 토큰으로 낸 마지막 것'이 오고, 뒤에 낸 사람이 앞사람의 이름과 결과를 본다.
         */
        get: operations["attendance.checkInResult"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sign-in/ways": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 어느 길로 들어올 수 있는가(SIGN-IN). **배포가 정한다** — 제공자의 열쇠를 넣어 둔 것만 열린다. 길이 하나도 없는 배포는 아무도 못 들어오므로 그 사실이 화면에 드러나야 한다.
         *
         *     **로그인 자리는 로그인이 필요 없다.** 아직 아무도 아닌 사람이 읽는다.
         */
        get: operations["auth.ways"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/members/{memberId}/removal-target": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내보내려는 사람이 누구인가(ORG-03D). **되돌릴 수 없는 일이라 누구인지 확인 화면이 말해야 한다** — 이름 없이 '구성원을 내보낼까요?'만 물으면 사람이 무엇을 지우는지 모르고 누른다. 묻는 말까지 서버가 만든다: 이름을 화면이 문장에 끼워 넣으면 화면마다 다른 말이 된다.
         *
         *     **이미 나간 사람을 물으면 없다고 한다**(404). 두 사람이 같은 화면을 열어 둔 채 한쪽이 먼저 내보내면 다른 쪽은 없는 사람에게 확인을 묻게 된다.
         */
        get: operations["org.memberToRemove"];
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
    "/api/my/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내 학적 정보. MY-INFO-01의 칸을 채운다.
         *
         *     **온보딩에서 받아 둔 것을 되돌려 준다.** 받아 놓고 보여 주는 자리가 없던 동안, 사람은 자기가 무엇을 적었는지 확인할 길이 없었다(2026-09-09에 물었다).
         *
         *     **학교는 이 사람의 것이 아니라 학생회의 것이다.** 한 학생회의 구성원은 모두 그 학교 사람이므로 사람마다 다르지 않고, 그래서 고칠 수도 없다 — 보여 주기만 한다.
         *
         *     **소속은 여기 없다**(`my.belonging`). 이 출처는 화면의 칸을 채우는 것이라 여기 담긴 것은 곧 서버로 되돌아갈 값이다. 못 고치는 것을 섞으면 그 구분이 사라진다.
         */
        get: operations["my.profile"];
        /**
         * 내 학적 정보를 고친다(MY-INFO-01).
         *
         *     **남의 것은 못 고친다.** 누구의 것인지는 쿠키가 말한다 — 몸통에 사람을 적으면 남의 학적을 고칠 수 있는 자리가 된다.
         *
         *     **이름과 학교는 오지 않는다.** 이름은 로그인한 계정의 것이고 학교는 학생회의 것이라 이 화면이 정하는 값이 아니다.
         */
        put: operations["my.saveProfile"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/belonging": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내가 이 학생회에서 무엇인가. MY-INFO-01의 아래 카드가 그린다.
         *
         *     **고치는 값이 아니다.** 소속 부서와 직책은 조직도가 정하고(ORG-03B) 이 화면은 그것을 읽기만 한다 — 칸이 아니라 값이라 `my.profile`과 갈라 둔다.
         */
        get: operations["my.belonging"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/education/schools": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학교명 검색 결과
         *
         *     **들어오려는 사람이 읽는다.** 이것을 읽는 화면은 INV-01·ONB-01·ORG-01뿐이고 그 viewer는 `joining`이다 — 아직 어느 학생회의 구성원도 아니다. `member`로 적어 두었던 동안은 **학교를 골라야 구성원이 되는데 구성원이라야 학교를 고를 수 있었다** — 명세끼리 어긋났고 아무 데서도 안 드러났다.
         */
        get: operations["education.schools.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/education/colleges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 선택한 학교의 단과대학 목록
         *
         *     **들어오려는 사람이 읽는다.** 이것을 읽는 화면은 INV-01·ONB-01·ORG-01뿐이고 그 viewer는 `joining`이다 — 아직 어느 학생회의 구성원도 아니다. `member`로 적어 두었던 동안은 **학교를 골라야 구성원이 되는데 구성원이라야 학교를 고를 수 있었다** — 명세끼리 어긋났고 아무 데서도 안 드러났다.
         */
        get: operations["education.colleges.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/education/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 선택한 학교와 단과대학의 학부·학과 목록
         *
         *     **들어오려는 사람이 읽는다.** 이것을 읽는 화면은 INV-01·ONB-01뿐이고 그 viewer는 `joining`이다 — 아직 어느 학생회의 구성원도 아니다. `member`로 적어 두었던 동안은 **학교를 골라야 구성원이 되는데 구성원이라야 학교를 고를 수 있었다** — 명세끼리 어긋났고 아무 데서도 안 드러났다.
         */
        get: operations["education.departments.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants/affiliations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참가자를 소속으로 거르는 선택지. 어느 학부·학과가 오는지는 그 행사에 실제로 신청한 사람이 정하므로 명세가 목록을 들고 있을 수 없다. */
        get: operations["event.participantAffiliations.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants/apply-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참가자를 신청 상태로 거르는 선택지. 상태 목록은 조직 운영에 따라 늘 수 있어 서버가 준다 — 표의 딱지에 그려지는 말과 같은 목록이다. */
        get: operations["event.participantApplyStatus.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants/pay-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참가자를 입금 상태로 거르는 선택지. 참가비를 받지 않는 행사도 있어 목록이 비어 올 수 있다. */
        get: operations["event.participantPayStatus.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/event/participants/attend-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 참가자를 참석 상태로 거르는 선택지. 행사 전에는 미확인뿐이고 당일에 늘어난다. */
        get: operations["event.participantAttendStatus.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/budget-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 어느 예산 항목에서 쓰는지. 그 행사의 예산이라 행사마다 다르다. */
        get: operations["finance.budgetItems.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/dues-terms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 학생회비를 걷는 학기. 조직이 언제부터 있었는지에 달렸으므로 명세가 목록을 들 수 없다 - 학기가 하나 지날 때마다 명세가 틀린다. */
        get: operations["org.duesTerms.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/linkable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 회의를 걸 수 있는 행사. 어느 행사가 있는지는 조직이 정하므로 명세가 들 수 없다. */
        get: operations["event.linkable.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/departments/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학생회의 부서. **education.departments와 다른 물건이다** — 저것은 학교의 학부·학과이고 이것은 이 학생회가 스스로 나눈 부서다(ORG-03A의 조직도가 그리는 그것).
         *
         *     **고르는 목록은 제 자리를 갖는다.** 조직도가 읽는 /api/org/departments와 같은 자리를 가리키고 있었는데, 한 자리가 두 모양을 줄 수는 없다 — 저기는 부서장과 부원까지 실은 나무를 주고 여기는 값과 글만 있으면 된다. OpenAPI를 뽑다가 드러났다(generate-openapi.mjs가 같은 자리를 두 번 적기를 거부한다).
         */
        get: operations["org.departments.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/agenda-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회의록을 정리할 때 어느 안건을 열지 고르는 목록(OPS-MEET-06B). 곁에 붙는 '확인 필요' 같은 말도 함께 온다.
         *
         *     **처음 열려 있는 것은 이 목록이 정하지 않는다.** 선택지는 늦게 오므로 화면을 처음 그릴 때 없다 — 어느 안건이 지금 정리할 것인지는 meeting.agendas의 isCurrent가 말하고, 그 값은 화면을 그릴 때 이미 와 있다.
         */
        get: operations["meeting.agendaPicker.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/leader-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 책임자가 될 수 있는 사람. **디자인이 펼친 목록을 그리지 않았다** — 명세가 지어내지 않는다. */
        get: operations["event.staffLeaderCandidates.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/departments/{departmentId}/leader-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 그 부서의 부서장이 될 수 있는 사람. 디자인이 목록을 그리지 않았다. */
        get: operations["event.staffDeptLeaderCandidates.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff/departments/{departmentId}/member-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 그 부서에 넣을 수 있는 사람. 디자인이 목록을 그리지 않았다. */
        get: operations["event.staffMemberCandidates.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/ledger/months": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 사용 내역을 볼 달. 조직이 언제부터 있었는지에 달렸으므로 명세가 목록을 들 수 없다 — 달이 하나 지날 때마다 명세가 틀린다(org.duesTerms와 같은 자리다). */
        get: operations["finance.ledgerMonths.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/ledger/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 사용 내역을 행사로 거르는 선택지. 어느 행사가 있는지는 조직이 정하므로 명세가 들 수 없다(event.linkable과 같은 자리다). 행사에 속하지 않는 지출도 있으므로 이 목록이 장부를 다 덮지는 않는다. */
        get: operations["finance.ledgerEvents.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/budget-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 학생회 전체의 예산 항목. **finance.budgetItems와 다른 물건이다** — 저것은 한 행사의 예산이라 eventId를 받고, 이것은 행사에 속하지 않는 상시 지출까지 덮는 조직의 항목 체계다. */
        get: operations["finance.orgBudgetItems.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/reviewer-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 행사 아카이브를 검토할 수 있는 사람(REC-02A). **디자인이 펼친 목록을 그리지 않았다** — 누가 검토할 수 있는지는 조직의 권한 규칙이라 명세가 목록을 들지 않는다. */
        get: operations["record.archiveReviewers.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/colleges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참여 신청 폼에서 고르는 단과대학(EXT-02A). **education.colleges를 재사용할 수 없다** — 그쪽은 schoolId를 필수로 받는데 이 화면에는 학교 칸이 없고(그림에 없다) 화면 인자에도 없다. 어느 학교의 목록인지는 그 설문을 연 학생회가 이미 알고 있으므로 토큰이 곧 범위다. */
        get: operations["survey.colleges.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 참여 신청 폼에서 고르는 학부·학과(EXT-02A). survey.colleges와 같은 이유로 education.departments를 쓸 수 없다 — 그쪽은 schoolId와 collegeId를 함께 받는다. 여기서 학교의 자리를 토큰이 대신하고, 고른 단과대학은 그대로 넘긴다. */
        get: operations["survey.departments.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/finance/budget-plan/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 예산을 배정할 수 있는 행사(FIN-PLAN-01). 어느 행사가 있는지는 조직이 정하므로 명세가 들 수 없다. 완료·취소된 행사는 오지 않는다 — 끝난 행사에 예산을 새로 배정할 일이 없다. */
        get: operations["finance.budgetEvents.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/colleges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내 학생회의 학교에 있는 단과대학 목록
         *
         *     **학교를 화면이 넘기지 않는다.** 내 학생회의 대표 학교 아래에서 고르는 것이고, 그 학교는 서버가 안다 — `education.*`와 갈리는 것이 이 한 가지다. 화면이 넘기려면 학교의 코드값을 칸에 들고 있어야 하는데, 그 칸은 사람이 고칠 수 없는 것이라 그리지 않았다.
         */
        get: operations["my.colleges.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/my/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내 학생회의 학교에서 고른 단과대학의 학부·학과 목록
         *
         *     **학교를 화면이 넘기지 않는다.** 내 학생회의 대표 학교 아래에서 고르는 것이고, 그 학교는 서버가 안다 — `education.*`와 갈리는 것이 이 한 가지다. 화면이 넘기려면 학교의 코드값을 칸에 들고 있어야 하는데, 그 칸은 사람이 고칠 수 없는 것이라 그리지 않았다.
         */
        get: operations["my.departments.options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orgs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 학생회와 초기 조직 구조를 생성한다 */
        post: operations["org.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 구매 요청을 재정부 검토로 넘긴다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-request-drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 구매 요청을 아직 넘기지 않고 적어 둔 채로 보관한다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.saveDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement/resubmit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 보완 요청에 답해 수정한 내용을 재정부에 다시 넘긴다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.resubmitSupplement"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/supplement/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 보완 답변을 아직 넘기지 않고 적어 둔 채로 보관한다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.saveSupplement"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/finance/purchase-requests/evidence/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 결제·증빙 정리를 끝내고 요청을 처리 완료로 옮긴다
         *
         *     **어느 요청인지가 계약에 있다**(2026-09-06). 한동안 `params: []`였고 서버는 그것을 몸통에서 읽었다 — 계약만 읽고 만드는 사람은 그 값을 실어야 한다는 것을 알 길이 없었고, 몸통이 아예 없다고 적힌 자리도 몸통을 읽고 있었다.
         */
        post: operations["finance.purchaseRequest.completeEvidence"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/chart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** 고친 조직도를 저장한다. 사람의 자리와 부서 구성이 함께 간다. */
        put: operations["org.saveChart"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/invite/link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 공용 초대 링크를 다시 만든다. 전에 나눠 준 링크는 그때부터 듣지 않는다. */
        post: operations["org.regenerateInviteLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/invite/code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 짧은 초대 코드를 다시 만든다. */
        post: operations["org.regenerateInviteCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/members/{memberId}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 고른 구성원의 기본 역할을 바꾼다. 회의·행사별 맥락 역할은 이 화면이 건드리지 않는다.
         *
         *     **누구의 역할인지가 계약에 없었다.** 자리도 인자도 없어서 서버가 알 길이 없었고, 화면도 고른 사람을 넘길 어휘가 없어 서버가 '마지막으로 고른 사람'을 기억해 대신하고 있었다 — 두 사람이 같은 화면을 열면 서로의 고른 것을 본다. 자리에 사람을 박아 그 자리를 없앤다.
         */
        put: operations["org.changeRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/org/members/{memberId}/removal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 고른 구성원을 학생회에서 내보낸다.
         *
         *     **사람이 정했다(2026-09-06): 내보내면 학생회에서 나간다.** 되돌릴 수 없으니 확인을 받고 회장단만 한다.
         *
         *     **줄을 지우지 않는다.** 이 사람은 문서를 쓰고 요청을 올리고 회의에 앉았던 사람이고, 줄을 지우면 그 기록들이 이름을 잃는다. 나간 때를 적어 두고 명단·조직도·고르는 목록·권한에서만 뺀다.
         *
         *     **조직도 저장과 다른 일이다.** 조직도 저장은 자리를 옮기는 것이고 덮어쓴다. 이것은 사람을 내보내는 것이고 되돌릴 수 없다 — 한 자리에 두면 자리를 옮기다 손이 미끄러진 것과 사람을 내보내는 것이 같은 저장이 된다.
         */
        post: operations["org.removeMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 회의를 임시 저장한다. 제출과 **같은 것**을 보내되 보내는 곳이 다르다. 임시 저장한 회의는 다른 참가자에게 표시되지 않는다 */
        post: operations["meeting.saveDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 회의를 시작한다. 상태가 '진행 중'으로 바뀌고 참가자에게 '회의 참가'가 열린다(D01). 보낼 초안이 없다 — 무엇의 것인지는 화면이 받은 인자가 안다 */
        post: operations["meeting.start"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 회의를 끝낸다. **상태는 '완료'가 아니라 '정리 중'이 된다**(D02). 회의록과 결정을 확인한 뒤에 따로 정리 완료한다 */
        post: operations["meeting.end"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 회의를 취소한다(D04). 회의는 지워지지 않고 취소된 기록으로 남는다. 취소 사유가 필수다 */
        post: operations["meeting.cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/hosts/{memberId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 한 사람에게 이 회의의 진행 권한을 준다(D03). 옮기는 것이 아니라 더하는 것이다. **누구에게 주는지가 계약에 없었다** — 빼는 쪽(DELETE)은 자리에 사람이 박혀 있는데 주는 쪽은 없어서, 서버가 누구인지 알 길이 없었다. 두 쪽을 같은 자리로 맞췄다. */
        post: operations["meeting.grantHostRole"];
        /** 한 사람의 진행 권한을 뺀다. **확인 모달이 그려지지 않았다** — 부여(D03)에만 있다. 뺏는 쪽이 더 위험한데 그림에 없다 */
        delete: operations["meeting.revokeHostRole"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/agendas/current/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 지금 진행 중인 안건의 논의를 마친다. **어느 안건인지를 인자로 받지 않는다** — 단추의 뜻이 '이 안건'이고 그것은 지금 진행 중인 것이며, 어느 것이 진행 중인지는 서버가 안다. 화면에는 안건 id를 넘길 길이 없었다(단추는 데이터를 읽지 않는다). 다음 안건으로 넘기는 자리도 같은 모양이다(/agendas/next). */
        post: operations["meeting.completeAgenda"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/agendas/next": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 다음 안건을 진행 중으로 넘긴다 */
        post: operations["meeting.startNextAgenda"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/minutes/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 안건별 논의·결정 기록에서 전체 요약 초안을 만든다. **기록에 없는 결정·담당자·기한을 새로 만들지 않는 것이 이 동작의 계약이다**(06B에 그 문장이 적혀 있다) */
        post: operations["meeting.generateSummary"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/minutes/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 회의록 정리를 마친다. 참석자에게 최종 회의록이, 불참자에게 요약 확인 요청이 간다. **확인 모달이 그려지지 않았다** — 되돌릴 수 없고 알림이 나가는 동작인데 D01~D04에 짝이 없다 */
        post: operations["meeting.completeMinutes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/meetings/{meetingId}/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 이 사람이 회의 요약을 확인했다고 기록한다(OPS-MEET-08). **회의의 상태가 아니라 그 사람의 확인 상태**를 바꾼다 */
        post: operations["meeting.acknowledgeSummary"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/basics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** 행사 기본정보를 고친다. 저장하면 일정·참여 설문에 자동 반영된다 */
        put: operations["event.saveBasics"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** 행사 운영 조직을 고친다. **기본 학생회 조직에는 영향을 주지 않는다** */
        put: operations["event.staff.save"];
        /** 행사 운영 조직을 처음 세운다 */
        post: operations["event.staff.setup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/attendance-qr/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 참석 확인 QR을 다시 만든다. 앞의 QR은 더 이상 쓸 수 없다 */
        post: operations["event.attendanceQr.regenerate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/attendance-qr/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 참석 확인 QR을 끈다 */
        post: operations["event.attendanceQr.deactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 참여 설문 링크를 켠다. 조건을 다 채워야 켤 수 있다 */
        post: operations["event.survey.activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/ops/events/{eventId}/survey/replace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 기존 설문을 끝내고 새 설문 초안을 만든다. **응답 데이터는 보관된다** */
        post: operations["event.survey.replace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 아카이브를 아직 넘기지 않고 적어 둔 채로 보관한다. 검토 요청과 **같은 것**을 보내되 보내는 곳이 다르다 */
        post: operations["record.archive.saveDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/review-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 쓴 아카이브를 고른 검토자에게 넘긴다. **발행이 아니다** — 발행 단추는 와이어프레임에 그려지지 않았다 */
        post: operations["record.archive.requestReview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/records/events/{eventId}/archive/handover-draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 이 행사의 업무·회의·문서·정산 기록에서 인수인계 초안을 만든다. **기록에 없는 자산·연락처·담당자를 새로 만들지 않는 것이 이 동작의 계약이다**(REC-02A에 그 문장이 적혀 있고, 그 글은 record.archiveDraft의 aiDisclaimer가 갖는다). meeting.generateSummary와 같은 자리다 */
        post: operations["record.archive.generateHandoverDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/organizations/invite-code/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 초대 코드가 어느 학생회의 것인지 서버에 묻는다. **화면은 코드가 맞는지 알 수 없다** — 있는 코드인지, 만료됐는지, 이미 다른 학생회에 속해 있는지는 전부 서버의 물음이다. */
        post: operations["organization.verifyInviteCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/organizations/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 초대 코드로 확인한 학생회에 **실제로 들어간다**(INV-01의 마지막 단추).
         *
         *     **한동안 이 자리가 없었다.** 와이어프레임이 그 단추를 홈으로 가는 이동으로 그렸고, 명세는 그림 그대로 적었다. 그래서 코드를 확인하고 소속을 적고 눌러도 `members`에 줄이 생기지 않았고, **어느 학생회든 구성원은 만든 사람 하나뿐이었다** — 조직도에 옮길 사람도, 회의에 부를 사람도, 내보낼 사람도 없었다. 사람이 정했다(2026-09-06): 그 단추가 보내게 한다. 그림은 그대로 두고 눌렀을 때 일어나는 일만 바꾼다.
         *
         *     **앞 자리(`organization.verifyInviteCode`)와 같은 것을 본다.** 확인은 묻기만 하고 바꾸지 않으므로, 확인과 들어가기 사이에 코드가 죽거나 소속이 바뀔 수 있다 — 여기서 다시 본다. 확인을 건너뛰고 이 자리로 곧장 보내도 같은 벽이 선다.
         */
        post: operations["org.join"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/surveys/{surveyToken}/applications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 참여 신청을 보낸다(EXT-02A). 로그인한 사람이 없으므로 누가 냈는지는 폼에 적은 이름·학번이 말하고, 어느 설문에 내는지는 링크의 토큰이 말한다. */
        post: operations["survey.apply"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/public/attendance/{checkInToken}/check-in": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** QR로 온 참석자가 이름과 학번으로 참석을 확인한다. 로그인이 없으므로 누가 냈는지는 보낸 값이 말하고 어느 QR인지는 링크의 토큰이 말한다 */
        post: operations["attendance.checkIn"];
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
    "/api/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 나간다. 서버가 세션을 지우고 쿠키를 거둔다.
         *
         *     **들어오는 길이 있으면 나가는 길도 있어야 한다.** 이 자리가 없던 동안 한번 들어온 사람은 앱 안에서 나갈 방법이 없었고, 다른 계정으로 열어 보려면 브라우저의 쿠키를 직접 지워야 했다.
         *
         *     **실어 갈 값이 없다.** 누구인지는 쿠키가 말한다 — 몸통에 적으면 남의 것을 지우라고 말할 수 있는 자리가 된다.
         */
        post: operations["auth.signOut"];
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
    "shell.organization": {
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
                        /** @description 조직 이름. 예: 소프트웨어융합대학 */
                        name: string;
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
    "shell.viewer": {
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
                        /** @description 이름. 예: 박해랑 */
                        name: string;
                        /** @description 소속과 직책. 예: 운영부 · 부원 */
                        role: string;
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
    "my.taskAlerts": {
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
                        /** @description 지연된 업무 수 */
                        delayedCount: number;
                        /** @description 해야 할 업무 수 */
                        todoCount: number;
                        /** @description 검토가 필요한 업무 수 */
                        reviewCount: number;
                        /** @description 지금 내가 붙들고 있는 업무를 한 줄로. **완성된 글로 온다** — 무엇을 '붙들고 있다'로 볼지(진행 중과 검토 필요를 합친다)가 조직의 규칙이라 화면이 더하지 않는다. 홈의 '내 담당 업무' 카드가 이것을 그린다. 예: 진행 중·검토 필요 4건 */
                        myWorkNote: string;
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
    "my.taskTabCounts": {
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
                        /** @description 해야 할 업무 수 */
                        todo: number;
                        /** @description 진행 중인 업무 수 */
                        inProgress: number;
                        /** @description 완료된 업무 수 */
                        done: number;
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
    "my.tasks": {
        parameters: {
            query: {
                /** @description 고른 갈피가 어느 업무를 뜻하는가 */
                tab: string;
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 업무 이름. 예: 행사 안전 안내문 검토 */
                        title: string;
                        /** @description 담당 부서. 예: 기획부 */
                        department: string;
                        /** @description 업무 상태. 예: 검토 필요 */
                        status: string;
                        /** @description 다음에 할 일. 예: 검토 의견을 확인하고 처리 내용을 기록 */
                        nextAction: string;
                        /** @description 업무가 속한 맥락. 행사 이름이거나 상시 업무 표시. 예: 2026 소프트웨어융합대학 체육대회 */
                        context: string;
                        /** @description 기한. 월.일. 예: 07.22 */
                        date: string;
                        /** @description 연결된 문서 이름. 없으면 오지 않는다. */
                        linkedDocument?: string;
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
    "ops.intro": {
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
                        /** @description 완성된 안내 문장. 예: 박해랑님이 확인할 업무·회의·행사·일정을 선택하세요. … */
                        description: string;
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
    "ops.spaceStats": {
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
                        /** @description 상시 업무 중 진행 중인 수 */
                        taskInProgress: number;
                        /** @description 상시 업무 중 검토가 필요한 수 */
                        taskReview: number;
                        /** @description 오늘 예정된 회의 수 */
                        meetingToday: number;
                        /** @description 정리가 필요한 회의 수 */
                        meetingCleanup: number;
                        /** @description 진행 중인 행사 수 */
                        eventInProgress: number;
                        /** @description 기획 중인 행사 수 */
                        eventPlanning: number;
                        /** @description 이번 주 마감 수 */
                        calendarThisWeek: number;
                        /** @description 다가오는 마감 수 */
                        calendarUpcoming: number;
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
    "task.alerts": {
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
                        /** @description 기한이 지난 업무 수 */
                        delayedCount: number;
                        /** @description 검토가 필요한 업무 수 */
                        reviewCount: number;
                        /** @description 내가 담당인 업무 수 */
                        mineCount: number;
                        /** @description 담당자가 없는 업무 수 */
                        unassignedCount: number;
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
    "task.board": {
        parameters: {
            query: {
                /** @description 내 것만 볼지 전부 볼지 */
                scope: string;
                /** @description 칸반 열 하나의 단계. 열마다 따로 조회한다 */
                status: string;
            };
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
                        /** @description 업무 이름. 예: 주간 운영회의 자료 준비 */
                        title: string;
                        /** @description 담당 부서. 예: 운영부 */
                        department: string;
                        /** @description 부서에 배정된 색 이름. 부서는 조직이 만드는 것이므로 색도 조직 데이터가 갖는다. 예: teal */
                        departmentTone: string;
                        /** @description 되풀이 주기. 예: 매주 · 매월 · 상시 */
                        cycle: string;
                        /** @description 담당자 이름. 없으면 완성된 안내로 온다. 예: 담당자 없음 · 배정 필요 */
                        assignee: string;
                        /** @description 기한. 되풀이가 상시면 그대로 상시. 예: 2026-07-21 */
                        dueDate: string;
                        /** @description 주의 표시. 없으면 오지 않는다. 예: 지연 */
                        alert?: string;
                        /** @description 업무 카드를 두르는 강조 색 이름. 기본은 부서 색이고, 담당자가 없는 업무처럼 먼저 봐야 하는 것은 경고 색으로 온다. 예: red */
                        tone: string;
                        /** @description 주의 표시에 딸린 색 이름. 주의 표시가 없으면 오지 않는다. 예: red */
                        alertTone?: string;
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
    "meeting.attention": {
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
                        /** @description 보는 사람이 어떤 자리인지. 예: 일반 참가자 화면 · 진행 권한자 화면 · 미참가자 화면 · 박민수 (기획부 부원) */
                        viewerTitle: string;
                        /** @description 그 자리에서 무엇을 할 수 있는지. 예: 초대된 회의의 일정과 참가 상태를 확인합니다. */
                        viewerNote: string;
                        /** @description 곁에 붙는 완성된 한 줄. 없을 수도 있다 - 회의 생성 가능·미참가자 화면에는 그려지지 않는다. 예: 확인 필요한 회의 2건 · 진행 권한 3건 */
                        attentionNote: string;
                        /**
                         * @description 새 회의를 만들 수 있는가. 만들 수 있는 사람에게만 머리에 그 단추가 그려진다 - ORG-04의 권한 표가 '회의 생성'을 회장단·부서장에게만 주는 것과 같은 사실이다
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canCreateMeeting: boolean;
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
    "meeting.groups": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 묶음 이름. 행사 이름이거나 '정기·상시 회의'다. 예: 2026 소프트웨어융합대학 체육대회 */
                        title: string;
                        /** @description 이 묶음에서 가장 가까운 회의를 알리는 완성된 문구. 무엇을 '가장 가까운'으로 세는지는 화면이 유도할 수 없어 서버가 정한다 — 그려진 것을 보면 완료는 빼고 취소는 넣는다. 예: 가장 가까운 회의: 07.22 (수) 18:00 */
                        nextMeetingNote: string;
                        /** @description 이 묶음에 든 회의들. */
                        meetings: {
                            /** @description 이 회의를 가리키는 값. 줄을 누르면 상세로 넘길 인자다 — 01A의 이동이 pending이던 동안에는 필요가 없었다. */
                            meetingId: string;
                            /** @description 회의 이름. 예: 학생회 정기 운영회의 */
                            title: string;
                            /** @description 회의 상태를 알리는 말. 예: 예정 · 진행 중 · 정리 중 · 완료 · 취소 */
                            status: string;
                            /** @description 상태 딱지에 배정된 색 이름. 상태 목록이 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                            statusTone: string;
                            /** @description 회의 이름 옆에 덧붙는 표시. 없으면 오지 않는다. 예: 비공개 */
                            badge?: string;
                            /** @description 회의 시작 때. 예: 2026.07.22 18:00 */
                            startAt: string;
                            /** @description 회의 장소. 정해지지 않았으면 완성된 안내로 온다. 예: 학생회실 (A204) · 미정 */
                            place: string;
                            /** @description 회의를 여는 사람 이름. 예: 이수현 */
                            host: string;
                            /** @description 참가자 수. 세는 말까지 붙어서 온다. 예: 12명 */
                            attendees: string;
                            /** @description 안건 수. 세는 말까지 붙어서 온다. 예: 4개 */
                            agenda: string;
                            /** @description 회의록이 어디까지 됐는지. 예: 작성 전 · 작성 중 · 정리 완료 · 내용 열람 가능 · 취소 사유 등록 */
                            minutesStatus: string;
                            /**
                             * @description 이 줄을 누르면 **어느 종류의 상세로 가는지**를 아는 열쇠. 화면 id가 아니다 — 데이터가 화면 id를 직접 주면 검증기가 그 화면이 있는지 확인할 수 없다. 갈 곳은 명세가 이 열쇠로 정한다(itemAction.targets).
                             *
                             *     회의의 상태가 정한다: 예정이면 예정 상세, 진행 중이면 진행 중 회의, 정리 중이면 회의록 정리, 완료면 완료 회의록, 취소면 취소된 회의. actionLabel이 '회의 상세 보기'·'회의로 돌아가기'·'회의록 보기'로 갈리는 것과 같은 사실이다. 예: scheduled · live · tidying · done · cancelled
                             */
                            detailKind: string;
                            /** @description 이 회의로 들어가는 문구. 회의 상태에 따라 다르다. 예: 회의 상세 보기 · 회의로 돌아가기 · 회의록 보기 */
                            actionLabel: string;
                            /** @description 그 문구를 얼마나 앞세우는지(primary·secondary·quiet). 지금 진행 중인 회의만 앞세운다. 예: secondary */
                            actionEmphasis: string;
                            /** @description 보는 사람과 이 회의의 관계를 말하는 딱지. 없을 수도 있다 - 진행 권한자에게는 '진행 권한', 미참가자에게는 '미참가'가 붙고 일반 참가자에게는 아무것도 안 붙는다 */
                            viewerChipLabel: string;
                            /** @description 그 딱지의 색 이름 */
                            viewerChipTone: string;
                        }[];
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
    "meeting.create": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description meetingType */
                    meetingType: string;
                    /** @description 연결 행사 */
                    linkedEventId: string;
                    /** @description 회의명 */
                    title: string;
                    /** @description 주최자 */
                    hostName?: string;
                    /** @description 주관 부서 */
                    departmentId: string;
                    /** @description 회의 상태 */
                    statusLabel?: string;
                    /** @description 회의 목적 */
                    purpose: string;
                    /** @description 회의 날짜 */
                    date: string;
                    /** @description 시작 예정 시각 */
                    startTime: string;
                    /** @description 종료 예정 시각 */
                    endTime: string;
                    /** @description 진행 방식 */
                    mode: string;
                    /** @description 장소 */
                    place: string;
                    /** @description 온라인 링크 */
                    onlineLink?: string;
                    /** @description 비공개 회의 */
                    isPrivate?: boolean;
                    /** @description 이름 또는 부서로 구성원 검색 */
                    memberQuery?: string;
                    /** @description 참가자 */
                    participants?: {
                        /** @description 참가자 */
                        memberId: string;
                    }[];
                    /** @description 안건 */
                    agendaItems?: {
                        /** @description 안건명 */
                        agendaTitle: string;
                        /** @description 안건 설명 */
                        agendaNote?: string;
                        /** @description 사전 자료 */
                        attachmentName?: string;
                        /** @description 예상 소요 시간 */
                        duration?: string;
                    }[];
                    /** @description 안건명 */
                    agendaTitle: string;
                    /** @description 안건 설명 */
                    agendaNote?: string;
                    /** @description 사전 자료 */
                    attachmentName?: string;
                    /** @description 예상 소요 시간 */
                    duration?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "event.list": {
        parameters: {
            query: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 행사 상태로 거른다 */
                status: string;
            };
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
                        /** @description 행사 이름. 예: 2026 소프트웨어융합대학 체육대회 */
                        title: string;
                        /** @description 진행 단계를 알리는 말. 예: 기획 중 · 진행 중 · 후속 정리 중 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 단계가 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        statusTone: string;
                        /** @description 행사가 열리는 때. 정해지지 않았으면 완성된 안내로 온다. 예: 2026. 08. 20 10:00 · 일시 미정 */
                        startAt: string;
                        /** @description 행사 장소. 정해지지 않았으면 완성된 안내로 온다. 예: ERICA 체육관 · 장소 미정 */
                        place: string;
                        /** @description 맡은 부서. 정해지지 않았으면 완성된 안내로 온다. 예: 학술체육부 · 담당 미정 */
                        host: string;
                        /** @description 이 행사에서 지금 눈에 띄어야 하는 것들. 완성된 문구로 오고 개수가 행사마다 다르다 — 기획 중이면 무엇이 비었는지, 끝난 뒤면 실제 참석자 수다. */
                        highlights: {
                            /** @description 딱지에 쓰이는 완성된 문구. 예: 신청자 142/200명 · 기본 정보 입력 필요 */
                            label: string;
                        }[];
                        /** @description 아직 닫히지 않은 것을 알리는 완성된 문구. 없으면 오지 않는다. 예: 미완료 업무 3건 · 미정리 문서 2건 */
                        alert?: string;
                        /** @description 마지막으로 손댄 때를 알리는 완성된 문구. 오늘·어제 같은 상대적인 말이 섞이므로 화면이 유도할 수 없다. 예: 마지막 수정 오늘 10:30 */
                        lastModifiedNote: string;
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
    "event.create": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 행사명 또는 가칭 */
                    title: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "event.workspace": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사의 진행 단계를 알리는 말. 예: 기획 중 */
                        status: string;
                        /** @description 행사가 어느 단계인지를 아는 열쇠. **그려지지 않는다** — 그려지는 것은 status이고 그것은 서버가 주는 말이다. 단계에 따라 갈피가 다른 화면으로 갈 때 그 갈래를 이 값이 정한다(shell.json의 workspaces[].tabs[].targetField). */
                        statusKey: string;
                        /** @description 상태 딱지에 배정된 색 이름. 예: blue */
                        statusTone: string;
                        /** @description 지금 눈에 띄어야 하는 것을 알리는 완성된 문구. 없으면 오지 않는다. 예: 주의 · 지연 업무 1건 */
                        alert?: string;
                        /** @description 주의 문구에 딸린 색 이름. 주의 문구가 없으면 오지 않는다. 예: red */
                        alertTone?: string;
                        /** @description 이 행사를 맡은 곳과 사람. 완성된 문구로 온다. 예: 담당 학술체육부 · 김바다 */
                        host: string;
                        /** @description 행사가 열리는 때. 완성된 문구로 온다. 예: 08.20 10:00 */
                        startAt: string;
                        /** @description 다음에 무엇이 있는지 알리는 완성된 문구. 예: 다음 일정 · 07.20 참가자 모집 공지 작성 */
                        nextSchedule: string;
                        /** @description 이 행사에서 무엇을 할 수 있는지 알리는 완성된 문구. 보는 사람에 따라 다르므로 화면이 유도할 수 없다. 예: 행사 관리 행동은 담당 운영진에게 제공됩니다. */
                        permissionNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.summary": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사 이름. 예: 2026 소프트웨어융합대학 체육대회 */
                        title: string;
                        /** @description 언제 어디서 여는지. 완성된 문구로 온다. 예: 행사일 2026-08-20 · ERICA 체육관 */
                        schedule: string;
                        /** @description 행사까지 남은 날. 지났으면 그 사실까지 붙어서 온다 — 오늘이 언제인지 화면이 알 수 없다. 예: D-33 */
                        dday: string;
                        /** @description 업무 진행률(0-100). 예: 14 */
                        progressPercent: number;
                        /** @description 진행률을 세어 말한 완성된 문구. 무엇을 완료로 세는지 화면이 정하지 않는다. 예: 1 / 7 완료 */
                        progressLabel: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.taskAlerts": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 기한이 지난 업무 수 */
                        delayedCount: number;
                        /** @description 검토가 필요한 업무 수 */
                        reviewCount: number;
                        /** @description 내가 담당인 업무 수 */
                        mineCount: number;
                        /** @description 담당자가 없는 업무 수 */
                        unassignedCount: number;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.taskBoard": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 내 것만 볼지 전부 볼지 */
                scope: string;
                /** @description 칸반 열 하나의 단계. 열마다 따로 조회한다 */
                status: string;
            };
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
                        /** @description 업무를 가리키는 값. 카드에 그려지지 않지만, 눌러서 상세로 갈 때 '어느 업무인지'로 넘어간다 — 그리지 않는 조각이다. 예: T-03 */
                        id: string;
                        /** @description 업무 이름. 예: 현수막 디자인 수정 반영 */
                        title: string;
                        /** @description 담당 부서. 예: 홍보부 */
                        department: string;
                        /** @description 부서에 배정된 색 이름. 부서는 조직이 만드는 것이므로 색도 조직 데이터가 갖는다. 예: pink */
                        departmentTone: string;
                        /** @description 담당자 이름. 없으면 완성된 안내로 온다. 예: 담당자 없음 · 배정 필요 */
                        assignee: string;
                        /** @description 기한. 늦었으면 그 사실까지 붙어서 온다. 예: 2026-07-18 · 지연 */
                        dueDate: string;
                        /** @description 주의 표시. 없으면 오지 않는다. 예: 지연 · 검토 필요 */
                        alert?: string;
                        /** @description 주의 표시에 딸린 색 이름. 주의 표시가 없으면 오지 않는다. 예: red */
                        alertTone?: string;
                        /** @description 업무 카드를 두르는 강조 색 이름. 기본은 부서 색이고, 담당자가 없는 업무처럼 먼저 봐야 하는 것은 경고 색으로 온다. 예: red */
                        tone: string;
                        /**
                         * @description 이 업무에 딸린 문서가 있는가. 카드에 문서 표시가 붙는다.
                         *
                         *     **있을 때만 오던 것을 늘 오게 했다**(2026-08-30). 없을 때 오지 않으면 '없다'와 '서버가 아직 모른다'가 같은 모양이 되고, 화면은 조각이 있는지로 참거짓을 읽게 된다 — 참거짓은 참거짓으로 온다.
                         */
                        hasDocuments: boolean;
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
    "event.overviewBriefing": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 지금 눈에 띄어야 하는 것. 완성된 문장으로 온다. 예: 모집 마감까지 3일 남았습니다. 정원 200명 중 142명이 신청했고, 명단 확인이 필요한 신청자가 6명 있습니다. */
                        headline: string;
                        /** @description 현재 단계와 다음 단계를 알리는 완성된 문장. 예: 현재 상태: 기획 중 · 다음 운영 단계는 모집 마감 확인입니다. */
                        stateNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.overviewHighlights": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 담당자 없는 업무 수. 단위까지 붙어서 온다. 예: 2건 */
                        unassignedTasks: string;
                        /** @description 그 업무들이 무엇인지 알리는 완성된 문구. 예: 행사장 안전 점검 · 참가자 명단 최종 확정 */
                        unassignedTasksDetail: string;
                        /** @description 확인이 필요한 참가자 수. 단위까지 붙어서 온다. 예: 6명 */
                        needsCheck: string;
                        /** @description 무엇을 확인해야 하는지. 예: 학번·이름 또는 납부 확인 */
                        needsCheckDetail: string;
                        /** @description 다음 핵심 일정의 이름. 예: 참가자 모집 공지 작성 */
                        nextMilestone: string;
                        /** @description 그 일정의 때와 담당. 예: 07.20 · 이윤슬 */
                        nextMilestoneDetail: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.basics": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사명. 예: 2026 소프트웨어융합대학 체육대회 */
                        title: string;
                        /** @description 일시. 정해지지 않았으면 완성된 안내로 온다. 예: 08. 20. (목) 10:00 */
                        startAt: string;
                        /** @description 장소. 예: ERICA 체육관 */
                        place: string;
                        /** @description 참여 대상. 예: 소프트웨어융합대학 전체 */
                        audience: string;
                        /** @description 참가비. 조건까지 문장으로 온다 — 무엇이 무료인지 화면이 유도할 수 없다. 예: 납부자 무료 / 미납자 5000원 */
                        fee: string;
                        /** @description 모집 정원. 예: 200명 */
                        capacity: string;
                        /** @description 문의처. 예: 카카오톡 채널 @swcollege */
                        contact: string;
                        /** @description 참석자 수. 후속 정리 중부터 온다. 아직 세지 않았으면 완성된 안내로 온다. 예: 집계 전 */
                        attendeeCount?: string;
                        /** @description 담당자 한 사람. event.workspace.host는 '담당 학술체육부 · 김바다'로 이어 오므로 다른 조각이다. 예: 김바다 */
                        host?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.recruitSettings": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 설문 상태. 예: 초안 */
                        surveyStatus: string;
                        /** @description 신청 기간. 정해지지 않았으면 완성된 안내로 온다. 예: 마감일 미입력 */
                        period: string;
                        /** @description 신청 방식. 예: 선착순 */
                        method: string;
                        /** @description 신청자 수. 단위까지 붙어서 온다. 예: 142명 */
                        applicantCount: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.participantStats": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 신청자 수. 예: 142명 */
                        applicants: string;
                        /** @description 정원 대비. 예: 정원 200명 */
                        applicantsNote: string;
                        /** @description 납부가 확인된 수. 예: 129명 */
                        paid: string;
                        /** @description 남은 것. 예: 미납 13명 */
                        paidNote: string;
                        /** @description 확인이 필요한 수. 예: 6명 */
                        needsCheck: string;
                        /** @description 왜 확인이 필요한지. 예: 명단 불일치 */
                        needsCheckNote: string;
                        /** @description 담당자 없는 업무 수. 예: 2개 */
                        unassignedTasks: string;
                        /** @description 무엇을 해야 하는지. 예: 처리 필요 */
                        unassignedTasksNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.checklist": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 무엇을 확인해야 하는지. 완성된 문구로 온다. 예: 명단 확인이 필요한 신청자 6명 */
                        title: string;
                        /** @description 그 까닭이나 때. 예: 학번·이름 불일치 또는 명단 외 학생 */
                        detail: string;
                        /** @description 항목의 성격에 배정된 색 이름. 급한 것과 끝난 것이 갈린다. 예: red · orange · green */
                        tone: string;
                        /**
                         * @description 이 항목을 누르면 **어느 종류의 화면으로 가는지**를 아는 열쇠. 화면 id가 아니다 — 데이터가 화면 id를 직접 주면 검증기가 그 화면이 있는지 확인할 수 없다. 갈 곳은 명세가 이 열쇠로 정한다(itemAction.targets).
                         *
                         *     갈 곳이 없는 항목에는 오지 않는다(actionLabel과 짝이다). 예: participants · tasks
                         */
                        targetKind?: string;
                        /** @description 이 항목에서 갈 수 있는 곳의 문구. 갈 곳이 없으면 오지 않는다. 예: 참가자 명단 보기 */
                        actionLabel?: string;
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
    "event.recentChanges": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 언제. 완성된 문구로 온다. 예: 오늘 10:30 · 07. 14 */
                        at: string;
                        /** @description 무엇이 바뀌었는지. 예: 신규 신청자 5명 추가 */
                        title: string;
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
    "task.detail": {
        parameters: {
            query: {
                /** @description 어느 업무인가 */
                taskId: string;
            };
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
                        /** @description 업무 번호. 예: T-03 */
                        code: string;
                        /** @description 업무 이름. 예: 현수막 디자인 수정 반영 */
                        title: string;
                        /** @description 진행 단계를 알리는 말. 예: 진행 중 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 예: blue */
                        statusTone: string;
                        /** @description 우선순위를 알리는 말. 예: 높음 */
                        priority: string;
                        /** @description 우선순위 딱지에 배정된 색 이름. 예: red */
                        priorityTone: string;
                        /** @description 담당자 이름. 정해지지 않았으면 완성된 안내로 온다. 예: 이윤슬 */
                        assignee: string;
                        /** @description 담당 부서. 예: 홍보부 */
                        department: string;
                        /** @description 마감일. 늦었으면 그 사실까지 붙어서 온다 — 무엇을 지연으로 세는지 화면이 유도할 수 없다. 예: 2026-07-18 · 지연 */
                        dueDate: string;
                        /** @description 업무 설명. 예: 검토 의견을 반영해 현수막 디자인을 수정하고… */
                        description: string;
                        /** @description 완료 기준. 등록되지 않았으면 완성된 안내로 온다. 예: 완료 기준이 아직 등록되지 않았습니다. */
                        completionCriteria: string;
                        /** @description 예상 결과물의 종류. 예: 문서·파일 */
                        expectedOutput: string;
                        /** @description 이 업무에 이어진 항목들. 개수가 업무마다 다르다. */
                        linkedItems: {
                            /** @description 항목 이름. 예: 현수막 제작 사양서 */
                            label: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "task.referenceDocuments": {
        parameters: {
            query: {
                /** @description 어느 업무인가 */
                taskId: string;
            };
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
                        /** @description 문서 이름. 예: 2026 체육대회 홍보 가이드라인 */
                        title: string;
                        /** @description 문서가 무엇을 정하는지. 예: 행사 전반의 시각 언어, 색상 코드… */
                        description: string;
                        /** @description 마지막으로 손댄 때를 알리는 완성된 문구. 예: 최종 수정일 2026-07-12 */
                        lastModifiedNote: string;
                        /** @description 검토 단계를 알리는 말. 예: 확정 · 검토 중 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 예: green */
                        statusTone: string;
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
    "task.workDocuments": {
        parameters: {
            query: {
                /** @description 어느 업무인가 */
                taskId: string;
            };
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
                        /** @description 파일이나 문서 이름. 예: 현수막 시안 v2.png */
                        title: string;
                        /** @description 파일인지 문서인지. 예: 파일 · 문서 */
                        kind: string;
                        /** @description 검토 단계를 알리는 말. 예: 검토 중 · 작성 중 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 예: yellow */
                        statusTone: string;
                        /** @description 공식 문서에 반영됐는지를 알리는 말. 예: 미반영 */
                        officialReflection: string;
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
    "task.reviewStatus": {
        parameters: {
            query: {
                /** @description 어느 업무인가 */
                taskId: string;
            };
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
                        /** @description 제출 상태를 알리는 말. 예: 제출 완료 */
                        submission: string;
                        /** @description 제출 상태 딱지의 색 이름. 예: green */
                        submissionTone: string;
                        /** @description 공식 결과가 확정됐는지. 예: 미확정 */
                        officialResult: string;
                        /** @description 그 딱지의 색 이름. 예: gray */
                        officialResultTone: string;
                        /** @description 검토 의견. 없으면 완성된 안내로 온다. 예: 메인 색상이 가이드라인과 다름… */
                        reviewComment: string;
                        /** @description 다음에 무엇을 해야 하는지 알리는 완성된 문구. 예: 수정 후 재제출이 필요합니다. */
                        nextStepNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.documentStats": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 행사에 딸린 문서 수. 예: 4개 */
                        total: string;
                        /** @description 전체 문서가 어떤 것인지 말하는 완성된 문구. 예: 행사 공용 문서 */
                        totalNote: string;
                        /** @description 작성 중인 문서 수. 예: 1개 */
                        drafting: string;
                        /** @description 작성 중인 문서에 무엇이 필요한지 말하는 완성된 문구. 예: 계속 확인이 필요해요 */
                        draftingNote: string;
                        /** @description 검토 중인 문서 수. 예: 1개 */
                        reviewing: string;
                        /** @description 검토 중인 문서에 무엇이 필요한지 말하는 완성된 문구. 예: 의견 확인이 필요해요 */
                        reviewingNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.documentStatusCounts": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 행사의 문서 전체 수. 예: 4 */
                        all: number;
                        /** @description 작성 중인 문서 수. 예: 1 */
                        drafting: number;
                        /** @description 검토 중인 문서 수. 예: 1 */
                        reviewing: number;
                        /** @description 확정된 문서 수. 예: 1 */
                        confirmed: number;
                        /** @description 아직 시작하지 않은 문서 수. 예: 1 */
                        notStarted: number;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.documents": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 문서 상태로 거른다 */
                status: string;
            };
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
                        /** @description 문서를 가리키는 값. 표에 그려지지 않지만, 눌러서 문서를 열 때 '어느 문서인지'로 넘어간다 — 그리지 않는 조각이다. 예: DOC-01 */
                        id: string;
                        /** @description 문서가 행사의 어느 국면에 속하는지. 예: 기획 · 운영 · 참가자 · 후속 정리 */
                        category: string;
                        /** @description 문서 이름. 예: 행사 운영 계획서 */
                        title: string;
                        /** @description 문서에 무엇이 담기는지 한 줄로. 예: 운영 목표, 역할 분담, 당일 진행 순서 */
                        description: string;
                        /** @description 문서의 상태를 알리는 말. 예: 확정 · 검토 중 · 작성 중 · 작성 전 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 상태가 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: green */
                        statusTone: string;
                        /** @description 줄 왼쪽 강조선의 색 이름. 문서가 속한 국면이 정한다 — 국면은 조직이 늘릴 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        tone: string;
                        /** @description 마지막으로 손댄 때와 사람. 아직 시작하지 않은 문서는 언제 쓸 것인지로 온다 — 오늘이 언제인지 화면이 알 수 없다. 예: 07. 12 · 이수현 · 행사 종료 후 */
                        updatedNote: string;
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
    "event.meetingCounts": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 단계별 건수를 세어 말한 완성된 문구. 예: 진행 중 1건 · 예정 1건 · 정리 중 0건 · 완료 1건 */
                        countsNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.meetings": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 회의를 가리키는 값. 카드에 그려지지 않지만, 눌러서 회의를 열 때 '어느 회의인지'로 넘어간다 — 그리지 않는 조각이다. 예: M-01 */
                        id: string;
                        /** @description 회의 상태를 알리는 말. 예: 예정 · 진행 중 · 정리 중 · 완료 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 상태 목록이 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        statusTone: string;
                        /** @description 이 회의가 무엇에 매인 회의인지. 지금은 전부 행사에 매여 있지만 화면이 지어낼 말이 아니다. 예: 행사 연결 회의 */
                        kindLabel: string;
                        /** @description 회의 이름. 예: 체육대회 운영 점검 회의 */
                        title: string;
                        /** @description 회의 시작 때. 요일까지 붙어서 온다. 예: 2026. 07. 18 (토) 10:00 */
                        startAt: string;
                        /** @description 회의 장소. 온라인이면 그 사실로 온다. 예: 제1회의실 · 온라인 (Discord) */
                        place: string;
                        /** @description 참가 인원을 세어 말한 완성된 문구. 회의가 끝났는지에 따라 세는 말이 달라 화면이 유도할 수 없다. 예: 참가 8명 · 참가 예정 4명 · 참석 6명 */
                        attendanceNote: string;
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
    "event.schedule": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 일정 중 무엇만 볼 것인가 */
                filter: string;
            };
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
                        /** @description 일정을 가리키는 값. 줄에 그려지지 않지만, 눌러서 원본을 열 때 '어느 일정인지'로 넘어간다 — 그리지 않는 조각이다. 예: SCH-01 */
                        id: string;
                        /** @description 언제인지. 날짜로 못 박히지 않는 일정이 있어 완성된 말로 온다 — 화면이 날짜를 꾸미지 않는다. 예: 07. 10 · 행사 후 */
                        dateLabel: string;
                        /** @description 줄 왼쪽 점의 색 이름. 행사 당일처럼 기준이 되는 일정만 도드라진다. 무엇이 기준인지는 조직 운영이 정하므로 색도 데이터가 갖는다. 예: blue */
                        tone: string;
                        /** @description 일정의 이름. 원본에 적힌 그대로다. 예: 참가자 모집 공지 작성 */
                        title: string;
                        /** @description 이 일정이 어떤 종류인지 알리는 딱지 글. 예: 업무 · 마감 · 회의 · 행사 · 후속 */
                        kindLabel: string;
                        /** @description 종류 딱지에 배정된 색 이름. 종류가 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: yellow */
                        kindTone: string;
                        /** @description 일정이 어떤 상태이고 무엇을 하는지 한 줄로. 상태 말이 앞에 붙어 오는 것이 있고 안 붙는 것이 있어 화면이 조립하지 않는다. 예: 진행 중 · 지연 · 검토 의견을 반영해 현수막 디자인을 수정합니다. */
                        description: string;
                        /** @description 누가 맡았는지. 아직 정해지지 않은 것은 그 사실로 온다. 예: 담당 · 이수현 · 담당 · 미지정 · 배정 필요 */
                        ownerNote: string;
                        /** @description 이 일정의 단일 원본이 어디인지. 여기서 고치지 않는다는 것을 줄마다 말한다. 예: 원본 · 행사 업무 */
                        originNote: string;
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
    "event.participants": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 소속으로 거른다 */
                affiliation?: string;
                /** @description 신청 상태로 거른다 */
                applyStatus?: string;
                /** @description 납부 상태로 거른다 */
                payStatus?: string;
                /** @description 출석 상태로 거른다 */
                attendStatus?: string;
                /** @description 몇 쪽인가. 넘기지 않으면 첫 쪽이다 */
                page?: number;
            };
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
                        /** @description 참가자를 가리키는 값. 표에 그려지지 않지만, 골라서 무엇을 할 때 '누구인지'로 넘어간다 — 그리지 않는 조각이다. 예: P-01 */
                        id: string;
                        /** @description 참가자 이름. 예: 김학생 */
                        name: string;
                        /** @description 학번. 자릿수가 학교마다 다르므로 수가 아니라 글로 온다. 예: 2022111111 */
                        studentNo: string;
                        /** @description 참가자가 속한 학부·학과. 예: 컴퓨터학부 */
                        affiliation: string;
                        /** @description 신청이 어디까지 됐는지 알리는 말. 예: 신청 완료 · 대기 중 */
                        applyStatus: string;
                        /** @description 신청 상태 딱지에 배정된 색 이름. 상태가 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        applyStatusTone: string;
                        /** @description 참가비가 들어왔는지 알리는 말. 예: 납부 확인 · 미납 · 미확인 */
                        payStatus: string;
                        /** @description 입금 상태 딱지의 색 이름. 예: green */
                        payStatusTone: string;
                        /** @description 당일 참석 여부를 알리는 말. 행사 전에는 미확인이다. 예: 참석 · 불참 · 미확인 */
                        attendStatus: string;
                        /** @description 참석 상태 딱지의 색 이름. 예: red */
                        attendStatusTone: string;
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
    "event.participantPaging": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 소속으로 거른다 */
                affiliation?: string;
                /** @description 신청 상태로 거른다 */
                applyStatus?: string;
                /** @description 납부 상태로 거른다 */
                payStatus?: string;
                /** @description 출석 상태로 거른다 */
                attendStatus?: string;
            };
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
                        /** @description 모두 몇 명인지를 말한 완성된 문구. 무엇을 세어 뭐라 부르는지는 서버가 안다 — 화면이 수에 '명'을 붙이지 않는다. 예: 총 6명 */
                        totalNote: string;
                        /** @description 쪽이 몇 개인지. 쪽 번호 버튼을 그리는 데 쓴다. 예: 1 */
                        pageCount: number;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.financeSummary": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 행사에 배정된 예산. 예: 3,000,000 */
                        budget: string;
                        /** @description 승인됐거나 집행이 예정된 금액. 예: 1,100,000 */
                        committed: string;
                        /** @description 실제로 나간 금액. 예: 950,000 */
                        spent: string;
                        /** @description 아직 쓸 수 있는 금액. 배정에서 무엇을 빼는지가 재정 규칙이라 화면이 계산하지 않는다. 예: 950,000 */
                        available: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.financeAlerts": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 검토를 기다리는 구매 요청 수. 예: 1 */
                        pendingReviewCount: number;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.financeBoard": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 칸반 열 하나의 단계. 열마다 따로 조회한다 */
                stage: string;
            };
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
                        /** @description 구매 요청을 가리키는 값. 카드에 그려지지 않지만, 눌러서 요청을 열 때 '어느 요청인지'로 넘어간다 — 그리지 않는 조각이다. 예: PR-01 */
                        id: string;
                        /** @description 요청한 부서. 예: 운영부 */
                        departmentLabel: string;
                        /** @description 요청한 날. 예: 2026-03-15 */
                        requestedAt: string;
                        /** @description 무엇을 사려는지. 예: 체육대회 운영 물품 4종 */
                        title: string;
                        /** @description 품목 수와 이름을 이어 붙인 완성된 문구. 몇 개까지 늘어놓을지는 서버가 정한다. 예: 품목 4개 · 박스테이프, 생수 500ml, 이름표 용지, 유성 마커 */
                        itemsNote: string;
                        /** @description 요청 금액. 단위까지 붙어서 온다 — 요약의 금액과 달리 카드에서는 '원'이 값과 한 덩이로 그려진다. 예: 135,000원 */
                        amountNote: string;
                        /** @description 이 요청이 지금 무엇을 기다리는지. 예: 검토 대기 · 보완 요청 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 재정 처리 단계가 조직 규칙에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: orange */
                        statusTone: string;
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
    "finance.purchaseRequestDraft": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 어느 구매 요청의 초안인가. **없으면 새로 쓰는 것**이다 */
                requestId?: string;
            };
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
                        /** @description 요청 제목. 예: 체육대회 운영 물품 */
                        title: string;
                        /** @description 요청 부서. 작성자의 소속이라 이 화면에서 고르지 않는다. 예: 운영부 */
                        department: string;
                        /** @description 필요한 날짜. YYYY-MM-DD. 예: 2026-08-12 */
                        neededOn: string;
                        /** @description 우선순위. finance.requestPriorities의 값. 예: normal */
                        priority: string;
                        /** @description 구매 목적. 예산을 쓰는 이유와 용도. */
                        purpose: string;
                        /** @description 요청에 담긴 품목들. 개수는 요청마다 다르다. */
                        items: {
                            /** @description 품목명. 예: 박스테이프 */
                            itemName: string;
                            /** @description 품목 카테고리. finance.itemCategories의 값. */
                            itemCategory: string;
                            /** @description 어느 예산 항목에서 쓰는지. finance.budgetItems의 값. */
                            budgetItem: string;
                            /** @description 구매 유형. finance.purchaseTypes의 값. */
                            purchaseType: string;
                            /** @description 수량. 수로 읽힌다. 예: 5. **아직 안 적었으면 오지 않는다** — 빈 글로 오지 않는다. 0은 값이므로(0개·0원) 빈 것과 0을 글로 섞으면 갈린다. */
                            quantity?: number;
                            /** @description 세는 말. 예: 개 */
                            unit: string;
                            /** @description 예상 단가. 수로 읽힌다. 자릿점 없이 온다 — 곱해야 하는 수이지 읽으라고 준 글이 아니다. 예: 2000. **아직 안 적었으면 오지 않는다** — 빈 글로 오지 않는다. 0은 값이므로(0개·0원) 빈 것과 0을 글로 섞으면 갈린다. */
                            unitPrice?: number;
                            /** @description 판매처 또는 쇼핑몰. 없으면 오지 않는다. */
                            vendor?: string;
                            /** @description 상품 URL. 없으면 오지 않는다. */
                            productUrl?: string;
                            /** @description 상품 옵션 또는 규격. 없으면 오지 않는다. */
                            option?: string;
                            /** @description 배송 요청사항. 없으면 오지 않는다. */
                            deliveryNote?: string;
                            /** @description 견적서 확보 상태. finance.quoteStatus의 값. */
                            quoteStatus: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.purchaseRequestDetail": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 요청 번호. 사람이 이 요청을 부르는 말이다. 예: REQ-001 */
                        code: string;
                        /** @description 지금 상태. 딱지에 그려진다. 예: 보완 요청 */
                        status: string;
                        /** @description 상태 딱지의 색 이름(design/tones.ts의 톤). 예: yellow */
                        statusTone: string;
                        /** @description 요청 제목. 예: 체육대회 운영 물품 4종 */
                        title: string;
                        /** @description 전체 요청액. 자릿점과 단위까지 찍혀서 온다 — 화폐 표기는 조직의 것이다. 예: 135,000원 */
                        amountNote: string;
                        /** @description 어느 행사의 요청인지. 예: 2026 소프트웨어융합대학 체육대회 */
                        eventName: string;
                        /** @description 요청 부서. 예: 운영부 */
                        department: string;
                        /** @description 요청자. 예: 박해랑 */
                        requester: string;
                        /** @description 필요한 날짜. YYYY-MM-DD. 예: 2026-03-15 */
                        neededOn: string;
                        /** @description 지금 어느 단계인지. steps 요소의 items[].key와 같은 말이어야 한다. 예: review */
                        stage: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.purchaseRequestItems": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 항목 식별자. 그려지지 않는다. */
                        id: string;
                        /** @description 품목명. 예: 박스테이프 */
                        name: string;
                        /** @description 수량과 세는 말이 함께 온다 — 세는 말이 품목마다 다르다. 예: 10박스 */
                        quantityNote: string;
                        /** @description 이 품목의 요청액. 자릿점과 단위까지 찍혀서 온다. 예: 10,000원 */
                        amountNote: string;
                        /** @description 재정부의 처리 결과. 딱지에 그려진다. 예: 승인 */
                        result: string;
                        /** @description 처리 결과 딱지의 색 이름. 예: green */
                        resultTone: string;
                        /** @description 재정부가 남긴 말. 없으면 줄표가 온다 — 빈 칸과 할 말이 없다는 것은 다르다. 예: 규격·수량 확인 후 견적서 재첨부 요망 */
                        note: string;
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
    "finance.purchaseRequestHistory": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 항목 식별자. 그려지지 않는다. */
                        id: string;
                        /** @description 무슨 일이 있었는지. 예: 재정부 검토 시작 */
                        action: string;
                        /** @description 누가 언제 했는지가 한 줄로 온다 — 사람과 시각을 잇는 방식은 조직의 표기다. 예: 김바다 · 2026-03-02 09:30 */
                        actorNote: string;
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
    "event.myPurchaseRequestSummary": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 무엇을 모아 보고 있는지가 한 줄로 온다. 예: 이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원 */
                        scopeNote: string;
                        /** @description 검토를 기다리는 요청 수. 예: 1 */
                        reviewCount: string;
                        /** @description 보완이 필요한 요청 수. 예: 0 */
                        supplementCount: string;
                        /** @description 승인이 끝난 요청 수. 예: 0 */
                        approvedCount: string;
                        /** @description 구매가 진행 중인 요청 수. 예: 0 */
                        purchasingCount: string;
                        /** @description 처리가 끝난 요청 수. 예: 0 */
                        doneCount: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.myPurchaseRequests": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 구매 요청을 가리키는 값. 표에 그려지지 않지만, 눌러서 상세를 열 때 '어느 요청인지'로 넘어간다. 예: PR-2026-0031 */
                        id: string;
                        /** @description 사람이 부르는 요청 번호. 예: REQ-001 */
                        code: string;
                        /** @description 무엇을 사려는지. 예: 체육대회 운영 물품 4종 */
                        title: string;
                        /** @description 요청 금액. 단위까지 붙어서 온다. 예: 135,000원 */
                        amountNote: string;
                        /** @description 품목이 몇인지가 세는 말까지 붙어서 온다 — 무엇을 무엇으로 세는지는 조직의 표기다. 예: 4종 */
                        itemCountNote: string;
                        /** @description 요청한 날. 예: 2026-03-01 */
                        requestedAt: string;
                        /** @description 필요한 날짜. 예: 2026-03-15 */
                        neededOn: string;
                        /** @description 이 요청이 지금 무엇을 기다리는지. 예: 검토 대기 */
                        status: string;
                        /** @description 상태 딱지에 배정된 색 이름. 상태가 조직 규칙에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        statusTone: string;
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
    "finance.supplementRequest": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 누가 걸었는지. 예: 요청 담당자 김바다 */
                        reviewerNote: string;
                        /** @description 언제 걸렸는지. 예: 보완 요청일 2026-03-03 */
                        requestedAtNote: string;
                        /** @description 언제까지 다시 내야 하는지. 예: 재제출 권장 기한 2026-03-07 */
                        dueNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.supplementItems": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 이 보완 품목을 가리키는 값. 그려지지 않지만 이 품목이 채워야 할 칸을 물을 때 넘어간다. 예: PRI-03 */
                        id: string;
                        /** @description 무엇의 보완인지가 머리글로 온다. 예: 보완 품목 — 이름표 용지 */
                        title: string;
                        /** @description 분류와 예산 항목이 한 줄로 온다. 예: 제작·인쇄 · 홍보비 */
                        categoryNote: string;
                        /** @description 왜 보완이 필요한지. 재정부가 쓴 글이다. */
                        reason: string;
                        /** @description 기존에 적었던 품목명. 예: 이름표 용지 */
                        name: string;
                        /** @description 기존 수량. 세는 말까지 붙어서 온다. 예: 200장 */
                        quantityNote: string;
                        /** @description 기존 단가. 예: 300원 */
                        unitPriceNote: string;
                        /** @description 기존 합계. 예: 60,000원 */
                        amountNote: string;
                        /** @description 기존 예산 항목. 예: 행사 운영비 */
                        budgetItem: string;
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
    "finance.supplementInputFields": {
        parameters: {
            query: {
                /** @description 요청 안의 어느 품목인가 */
                itemId: string;
            };
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
                        /** @description 칸의 이름. 화면에 그려지지 않고 값을 담는 자리가 된다. 예: size */
                        key: string;
                        /** @description 칸 위에 그려지는 글. 예: 사이즈·규격 */
                        label: string;
                        /** @description 빈 칸에 흐리게 보이는 예시. 예: 예: A4 (210×297mm) */
                        placeholder: string;
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
    "finance.supplementAttachments": {
        parameters: {
            query: {
                /** @description 요청 안의 어느 품목인가 */
                itemId: string;
            };
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
                        /** @description 첨부 자리의 이름. 그려지지 않는다. 예: designFile */
                        key: string;
                        /** @description 무엇을 넣는 자리인지. 예: 디자인 파일 */
                        label: string;
                        /** @description 아직 아무것도 넣지 않았을 때 그려지는 글. 예: 클릭하여 파일 추가 */
                        placeholder: string;
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
    "finance.reviewSummary": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 요청 번호. 예: REQ-001 */
                        code: string;
                        /** @description 지금 무엇을 기다리는지. 예: 보완 요청 */
                        status: string;
                        /** @description 상태 딱지의 색 이름. 예: yellow */
                        statusTone: string;
                        /** @description 전체 요청액. 단위까지 붙어서 온다. 예: 135,000원 */
                        amountNote: string;
                        /** @description 이 요청을 승인해도 되는지를 가르는 값. 남은 예산에서 무엇을 빼야 사용 가능액이 되는지는 조직의 재정 규칙이라 서버가 셈한다. 예: 950,000원 */
                        budgetAvailableNote: string;
                        /** @description 어느 행사의 요청인지. 예: 2026 소프트웨어융합대학 체육대회 */
                        eventName: string;
                        /** @description 요청 부서. 예: 운영부 */
                        department: string;
                        /** @description 요청자. 예: 박해랑 */
                        requester: string;
                        /** @description 필요한 날짜. 예: 2026-03-15 */
                        neededOn: string;
                        /** @description 요청일. 예: 2026-03-01 */
                        requestedAt: string;
                        /** @description 구매 목적. 요청자가 쓴 글이다. */
                        purpose: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.purchaseRequest.sendReview": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 승인액 */
                    approvedAmount: number;
                    /** @description 검토 결과 */
                    result: string;
                    /** @description 보완 사유 */
                    reviewNote?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.reviewItems": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 품목을 가리키는 값. 그려지지 않지만 판정이 이 값에 붙는다. 예: PRI-01 */
                        id: string;
                        /** @description 품목명. 예: 박스테이프 */
                        name: string;
                        /** @description 분류와 예산 항목이 한 줄로 온다. 예: 운영 물품 · 행사 운영비 */
                        categoryNote: string;
                        /** @description 구매 유형. 무엇을 다시 물어야 하는지가 여기서 갈린다. 예: 일반 구매 */
                        purchaseType: string;
                        /** @description 수량. 세는 말까지 붙어서 온다. 예: 5개 */
                        quantityNote: string;
                        /** @description 요청액. 예: 10,000원 */
                        amountNote: string;
                        /** @description 승인액의 처음 값. 재정부가 깎을 수 있으므로 요청액과 따로 온다 — 단위 없는 수다(사람이 고치는 값이라 자릿점도 붙지 않는다). 예: 10000 */
                        approvedAmount: string;
                        /** @description 이 품목에 이미 내린 판정. 검토는 한 번에 끝나지 않으므로 앞서 고른 것이 함께 온다 - 항목의 칸은 조각 이름이 같으면 그 값으로 시작한다(draftFrom과 같은 규칙이다). 아직 판정하지 않았으면 빈 값이다. 예: supplement */
                        result: string;
                        /** @description 앞서 적어 둔 보완 사유. 검토는 한 번에 끝나지 않으므로 다시 열면 적었던 글이 칸에 되돌아온다(`result`와 같은 까닭). 적은 적이 없으면 오지 않는다. 요청자는 이 글을 FIN-SUP-01에서 읽는다(`finance.supplementItems.reason`). */
                        reviewNote?: string;
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
    "finance.purchaseOrderSummary": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 어느 행사의 요청인지. 빵부스러기가 그 행사를 가리킨다. 예: 2026 소프트웨어융합대학 체육대회 */
                        eventName: string;
                        /** @description 요청 번호. 예: REQ-001 */
                        code: string;
                        /** @description 지금 어느 단계인지. 예: 구매 진행 중 */
                        status: string;
                        /** @description 상태 딱지의 색 이름. 예: blue */
                        statusTone: string;
                        /** @description 무엇을 사는지. 예: 체육대회 운영 물품 4종 */
                        title: string;
                        /** @description 누가 언제까지 필요하다 했는지가 한 줄로 온다. 예: 운영부 · 박해랑 · 필요한 날짜 2026-03-15 */
                        requesterNote: string;
                        /** @description 검토에서 승인된 전체 금액. 단위까지 붙어서 온다. 예: 135,000원 */
                        approvedAmountNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.purchaseOrders": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 발주를 가리키는 값. 그려지지 않는다. 예: PO-01 */
                        id: string;
                        /** @description 어느 업체에 주문했는지. 무엇을 어떻게 부르는지는 조직이 정한다. 예: 다이소 온라인몰 · 인쇄업체 A (제작 발주) */
                        vendor: string;
                        /** @description 언제 누가 주문했는지가 한 줄로 온다. 아직 주문하지 않았으면 자리를 비운 채로 온다. 예: 주문일 2026-03-08 · 담당 김바다 · 주문일 — · 담당 — */
                        orderNote: string;
                        /** @description 이 업체 몫의 금액. 단위까지 붙어서 온다. 예: 25,000원 */
                        amountNote: string;
                        /** @description 이 업체에 주문한 품목들. */
                        items: {
                            /** @description 품목을 가리키는 값. 그려지지 않는다. 예: POI-01 */
                            id: string;
                            /** @description 품목명. 제작 발주는 그 사실이 이름에 붙는다. 예: 박스테이프 · 이름표 용지 (제작) */
                            name: string;
                            /** @description 수량. 세는 말까지 붙어서 온다. 예: 5개 */
                            quantityNote: string;
                            /** @description 검토에서 승인된 금액. 예: 10,000원 */
                            amountNote: string;
                            /** @description 주문이 어디까지 됐는지. 예: 주문 완료 · 품절·변경 필요 */
                            orderStatus: string;
                            /** @description 주문 상태 딱지의 색 이름. 예: green · red */
                            orderStatusTone: string;
                            /** @description 언제 올 예정인지. 모르면 '—'로 온다. 예: 2026-03-12 */
                            deliveryOn: string;
                            /** @description 배송이 어디까지 됐는지. 예: 배송 중 · 배송 예정 · — */
                            deliveryStatus: string;
                            /** @description 배송 상태 글의 색 이름. 딱지가 아니라 글에 색이 붙는다 - 어느 쪽으로 그리는지는 design이 말한다. 예: blue · gray · red */
                            deliveryStatusTone: string;
                        }[];
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
    "finance.paymentEvidenceSummary": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 어느 행사의 요청인지. 빵부스러기가 그 행사를 가리킨다. 예: 2026 소프트웨어융합대학 체육대회 */
                        eventName: string;
                        /** @description 요청 번호. 예: REQ-001 */
                        code: string;
                        /** @description 지금 어느 단계인지. 예: 증빙 정리 중 */
                        status: string;
                        /** @description 상태 딱지의 색 이름. 예: blue */
                        statusTone: string;
                        /** @description 무엇을 산 요청인지. 예: 체육대회 운영 물품 4종 */
                        title: string;
                        /** @description 누가 낸 요청인지가 한 줄로 온다. 예: 운영부 · 박해랑 */
                        requesterNote: string;
                        /** @description 검토에서 승인된 금액. 예: 135,000원 */
                        approvedAmountNote: string;
                        /** @description 실제로 결제된 합계. 승인 금액과 다를 수 있다. 예: 137,500원 */
                        paidAmountNote: string;
                        /** @description 처리를 끝낼 수 없으면 그 이유. 끝낼 수 있으면 빈 값으로 온다 - **무엇이 '다 됐다'인지는 조직의 재정 규칙이고 화면이 세지 않는다.** 예: 증빙 서류 2건이 아직 등록되지 않았습니다. */
                        completeBlockedNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.paymentEvidences": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                        /** @description 결제를 가리키는 값. 그려지지 않는다. 예: PAY-01 */
                        id: string;
                        /** @description 어느 업체에 냈는지. 예: 다이소 온라인몰 */
                        vendor: string;
                        /** @description 언제 누가 무엇으로 냈는지가 한 줄로 온다. 결제 수단의 이름은 조직이 정한다. 예: 결제일 2026-03-08 · 결제자 김바다 · 법인카드 */
                        paidNote: string;
                        /** @description 승인액과 실결제액을 잇는 완성된 문구. 화면이 두 수를 화살표로 잇지 않는다 - 무엇을 무엇에 견주는지가 곧 재정의 표기다. 예: 승인 25,000원 → 실결제 24,500원 */
                        amountNote: string;
                        /** @description 승인액과 다를 때 그 차이를 설명하는 글(선택). 같으면 오지 않는다. 어떻게 다른지는 서버가 세어 문장으로 준다. 예: 실결제액이 승인액보다 500원 적음 */
                        gapNote?: string;
                        /** @description 이 결제에 연결된 품목들. */
                        items: {
                            /** @description 품목을 가리키는 값. 그려지지 않는다. 예: POI-01 */
                            id: string;
                            /** @description 품목명. 예: 박스테이프 */
                            name: string;
                        }[];
                        /** @description 이 결제에 받아야 할 증빙 서류들. **무엇을 받아야 하는지는 결제마다 다르다** - 세금계산서가 필요한 결제도 있고 영수증만으로 되는 결제도 있다. */
                        documents: {
                            /** @description 서류 자리를 가리키는 값. 그려지지 않는다. 예: DOC-01 */
                            id: string;
                            /** @description 무엇을 받는 자리인지. 예: 영수증 · 거래명세서 · 세금계산서 */
                            label: string;
                            /** @description 그 자리가 채워졌는지. 예: 등록 완료 · 누락 */
                            status: string;
                            /** @description 상태 딱지의 색 이름. 예: green · red */
                            statusTone: string;
                        }[];
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
    "org.areaSummaries": {
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
                        /** @description 부서 & 구성원 영역의 한 줄. 예: 부서 5개 · 구성원 18명 */
                        departments: string;
                        /** @description 학생 명단 영역의 한 줄. 예: 학생 1,284명 · 최근 갱신 07.01 */
                        students: string;
                        /** @description 역할 및 권한 영역의 한 줄. 예: 기본 역할 3종 · 확정된 권한 매트릭스 */
                        roles: string;
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
    "org.chartTitle": {
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
                        /** @description 학생회의 이름. 예: 제12대 소프트웨어융합대학 학생회 */
                        name: string;
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
    "org.executives": {
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
                        /** @description 구성원 id */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속 학부. 예: 컴퓨터학부 */
                        major: string;
                        /** @description 학년. 예: 3학년 */
                        grade: string;
                        /** @description 이 사람의 자리. 예: 회장 · 부회장 */
                        roleLabel: string;
                        /** @description 자리 딱지의 색 이름. 회장과 부회장이 다른 색으로 그려진다 */
                        roleTone: string;
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
    "org.departments": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 부서 id */
                        id: string;
                        /** @description 부서 이름. 예: 기획부 */
                        name: string;
                        /** @description 부원 목록 위에 그려지는 한 줄. 예: 부원 2명 */
                        memberCountLabel: string;
                        /** @description 부서장. 0개이거나 1개다. */
                        leaders: {
                            /** @description 구성원 id */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 소속 학부. 예: 컴퓨터학부 */
                            major: string;
                            /** @description 학년. 예: 3학년 */
                            grade: string;
                        }[];
                        /** @description 부원들 */
                        members: {
                            /** @description 구성원 id */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 소속 학부. 예: 컴퓨터학부 */
                            major: string;
                            /** @description 학년. 예: 3학년 */
                            grade: string;
                        }[];
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
    "org.unassignedMembers": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 구성원 id */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속 학부 */
                        major: string;
                        /** @description 학년 */
                        grade: string;
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
    "org.unassignedHint": {
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
                        /** @description 완성된 안내. 예: 2명 · 드래그해서 부서로 이동 */
                        hint: string;
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
    "org.invite": {
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
                        /** @description 초대가 지금 쓸 수 있는 것인지. 예: 활성 */
                        stateLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        stateTone: string;
                        /** @description 완성된 한 줄. 예: 현재 사용할 수 있는 초대 정보입니다. */
                        stateNote: string;
                        /** @description 마지막으로 되살린 때. 예: 마지막 재생성: 2026.07.22 18:30 */
                        regeneratedNote: string;
                        /** @description 공용 초대 링크 */
                        url: string;
                        /** @description 짧은 초대 코드. 예: AB12CD34 */
                        code: string;
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
    "org.regenerateInvite": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
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
                    "application/json": Record<string, never>;
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
    "org.roleCounts": {
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
                        /** @description 회장단 인원 */
                        chairCount: number;
                        /** @description 부서장 인원 */
                        headCount: number;
                        /** @description 부원 인원 */
                        memberCount: number;
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
    "org.permissionMatrix": {
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
                        /** @description 기능 영역의 id */
                        id: string;
                        /** @description 기능 영역의 이름. 예: 재정 현황·사용 내역 열람 */
                        area: string;
                        /** @description 회장단이 할 수 있는 정도 */
                        chair: string;
                        /** @description 그 딱지의 색 이름 */
                        chairTone: string;
                        /** @description 부서장이 할 수 있는 정도 */
                        head: string;
                        /** @description 그 딱지의 색 이름 */
                        headTone: string;
                        /** @description 부원이 할 수 있는 정도 */
                        member: string;
                        /** @description 그 딱지의 색 이름 */
                        memberTone: string;
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
    "org.roleAssignments": {
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
                        /** @description 구성원 id */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속 부서 */
                        department: string;
                        /** @description 지금의 기본 역할 이름 */
                        roleLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        roleTone: string;
                        /** @description 지금의 기본 역할 값. org.baseRoles의 value다 */
                        role: string;
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
    "org.roleAssignmentCount": {
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
                        /** @description 완성된 한 줄. 예: 7명 */
                        total: string;
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
    "org.selectedRoleAssignment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 구성원인가 */
                memberId: string;
            };
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
                        /** @description 구성원 id */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속 부서 */
                        department: string;
                        /** @description 지금의 기본 역할 이름 */
                        roleLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        roleTone: string;
                        /** @description 지금의 기본 역할 값 */
                        role: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "org.rosterScope": {
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
                        /** @description 범위의 경로. 예: 한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부 */
                        path: string;
                        /** @description 완성된 안내. 예: 컴퓨터학부 학생만 이 명단에 등록할 수 있습니다. … */
                        note: string;
                        /** @description 학생 명단이 갱신된 때 */
                        rosterUpdatedAt: string;
                        /** @description 누가 어떻게 갱신했는지. 예: 학생 명단 업로드 · 이지원 */
                        rosterUpdatedBy: string;
                        /** @description 학생회비 명단이 갱신된 때 */
                        duesUpdatedAt: string;
                        /** @description 어느 학기의 것을 누가 올렸는지. 예: 2026년 1학기 · 김민준 */
                        duesUpdatedBy: string;
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
    "org.students": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 학년으로 거른다 */
                grade?: string;
                /** @description 학생회비 납부 상태로 거른다 */
                duesStatus?: string;
                /** @description 몇 쪽인가. 넘기지 않으면 첫 쪽이다 */
                page?: number;
            };
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
                        /** @description 학생 id */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 학번 */
                        studentNumber: string;
                        /** @description 단과대학 */
                        college: string;
                        /** @description 학부·학과 */
                        department: string;
                        /** @description 학년 */
                        grade: string;
                        /** @description 학생회비 상태. 예: 납부 · 미납 · 확인 필요 */
                        duesLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        duesTone: string;
                        /** @description 줄 전체의 색 이름. 손봐야 하는 줄에만 있다 - 대부분은 비어 있다 */
                        rowTone: string;
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
    "org.studentPaging": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 학년으로 거른다 */
                grade?: string;
                /** @description 학생회비 납부 상태로 거른다 */
                duesStatus?: string;
            };
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
                        /** @description 모두 몇 명인지를 말한 완성된 문구. 예: 총 8명 */
                        totalNote: string;
                        /** @description 쪽이 몇 개인지 */
                        pageCount: number;
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
    "meeting.detail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 회의 이름. 제목·빵부스러기 마지막 마디·머리 카드가 같은 값을 쓴다. 예: 체육대회 안전 관리 최종 회의 */
                        title: string;
                        /** @description 회의 목적 한 줄. 취소된 회의에서는 과거형으로 온다 — 어느 시제로 쓸지는 서버가 상태를 보고 정한다 */
                        description: string;
                        /** @description 회의 상태를 알리는 말. **명세가 목록을 들지 않는다** — 조직 운영에 따라 는다. 예: 예정 · 진행 중 · 정리 중 · 완료 · 취소 */
                        status: string;
                        /** @description 상태 딱지의 색 이름. 상태가 늘 수 있으므로 색도 데이터가 갖는다. 예: blue */
                        statusTone: string;
                        /** @description **회의록**의 상태. 회의의 상태와 다른 축이다 — OPS-MEET-07의 '완료' 딱지가 매달린 문장은 '회의록 정리가 완료되었습니다'다. 예: 작성 전 · 작성 중 · 정리 완료 */
                        minutesStatus?: string;
                        /** @description 그 딱지의 색 이름 */
                        minutesStatusTone?: string;
                        /** @description 회의 분류 딱지. 조직 운영에 따라 늘 수 있다. 예: 행사 관련 회의 */
                        kindLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        kindTone?: string;
                        /** @description 딸린 행사 이름. 정기·상시 회의에는 오지 않는다 */
                        eventTitle?: string;
                        /** @description 그 행사로 갈 때 넘기는 인자 */
                        eventId?: string;
                        /** @description 만든 사람. 이름과 소속을 이은 완성된 한 줄. 예: 박해랑 · 운영부 */
                        creatorNote: string;
                        /** @description 마지막 손댄 때. 예: 2026.07.17 18:42 수정 */
                        updatedNote?: string;
                        /** @description 예정 일시. 취소된 회의에서는 '원래 예정 일시'로 그려진다. 예: 2026.07.25 15:00 */
                        scheduledAt: string;
                        /** @description 예상 시간. 세는 말까지. 예: 1시간 30분 */
                        plannedDurationNote?: string;
                        /** @description 장소. 정해지지 않았으면 완성된 안내로 온다('미정') — 화면이 빈 값을 무엇으로 채울지 정하지 않는다 */
                        place: string;
                        /** @description 초대 인원. 세는 말까지. 예: 4명 */
                        inviteeCountNote: string;
                        /** @description **보는 사람이 어떤 자리인지.** 띠의 제목. meeting.attention의 같은 이름과 같은 계급이다. 예: 일반 참가자 화면 · 회의 생성자 화면 · 진행 권한자 화면 */
                        viewerTitle: string;
                        /** @description 그 자리에서 무엇을 할 수 있는지 */
                        viewerNote: string;
                        /** @description 보는 사람과 이 회의의 관계 딱지. 예: 15:07 참석 · 불참 · 참석 처리됨 · 15:07 참가 */
                        viewerChipLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        viewerChipTone?: string;
                        /** @description 상태 띠의 제목. 상태와 보는 사람 둘 다에 매인다. 예: 아직 회의가 시작되지 않았습니다 · 회의가 종료되어 정리 중입니다 · 이 회의는 취소되었습니다 */
                        stateBannerTitle?: string;
                        /** @description 그 띠의 본문 */
                        stateBannerNote?: string;
                        /** @description 그 띠의 색 이름. 다른 톤 조각과 같이 **색 이름**이다(design/tones.ts의 BANNER_TONE이 이름을 색으로 옮긴다). 예: blue · yellow · red */
                        stateBannerTone?: string;
                        /**
                         * @description 회의를 시작할 수 있는가. **변형을 가르는 값이다** — 역할 이름이 아니라 할 수 있는 일로 가른다
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canStart: boolean;
                        /**
                         * @description 회의를 끝낼 수 있는가
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canEnd: boolean;
                        /**
                         * @description 회의를 고칠 수 있는가. 생성자만
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canEdit: boolean;
                        /**
                         * @description 회의를 취소할 수 있는가. 생성자만
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canCancel: boolean;
                        /**
                         * @description 진행 권한을 주고 뺄 수 있는가. 생성자만
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canManageHostRole: boolean;
                        /**
                         * @description 회의록을 정리할 수 있는가
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canEditMinutes: boolean;
                        /** @description **실제** 시작 때. 예정 일시와 다르다. 진행 중부터 온다. 예: 15:00 시작 */
                        startedAt?: string;
                        /** @description 얼마나 지났는지. 가만히 있어도 자란다. 예: 진행 27분 */
                        elapsedNote?: string;
                        /** @description 지금 몇 명이 들어와 있는지. 예: 3명 참가 중 */
                        presentNote?: string;
                        /** @description 실제 진행 시각. 끝난 뒤 온다. 예: 15:00–16:12 */
                        actualTimeNote?: string;
                        /** @description 누가 언제 끝냈는지. 예: 박해랑 · 16:12 */
                        closedByNote?: string;
                        /** @description 참석 결과를 이은 한 줄. 예: 3명 참석 · 1명 불참 */
                        attendanceResultNote?: string;
                        /** @description 안건 수와 예상 시간. 예: 총 3개 · 예상 60분 */
                        agendaCountNote?: string;
                        /** @description 등록된 자료 수. 예: 등록 자료 3개 */
                        materialCountNote?: string;
                        /** @description 참가자 수와 진행 권한자 수. 예: 초대 4명 · 진행 권한 2명 */
                        participantCountNote?: string;
                        /** @description 확정된 결정 수. 예: 2건 */
                        decisionCountNote?: string;
                        /** @description 후속 업무 딱지에 그려지는 말. 없으면 '없음'까지 완성해 온다 */
                        followUpCountLabel?: string;
                        /** @description 나에게 배정된 후속 업무 딱지. 예: 0건 */
                        myFollowUpCountLabel?: string;
                        /** @description 받아 갈 회의록 파일. 무엇을 어떤 형식으로 낼지는 서버가 정한다 */
                        exportName?: string;
                        /** @description 취소 사유. 취소된 회의에만 온다 */
                        cancelReason?: string;
                        /** @description 누가 취소했는지. 예: 김바다 · 기획부 */
                        cancelledByNote?: string;
                        /** @description 언제 취소했는지. 예: 2026.07.29 11:20 */
                        cancelledAtNote?: string;
                        /** @description 대체 회의를 알리는 완성된 글. 대체 회의가 없는 취소도 있으므로 안 올 수 있다 */
                        replacementNote?: string;
                        /** @description 그 대체 회의로 갈 때 넘기는 인자 */
                        replacementMeetingId?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.agendas": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이 안건을 가리키는 값 */
                        agendaId: string;
                        /** @description 몇 번째인지. 예: 안건 1 */
                        orderLabel: string;
                        /** @description 안건 이름 */
                        title: string;
                        /** @description 안건 설명. 회의 전에 적은 것 */
                        description?: string;
                        /** @description 예상 소요. 예: 20분 */
                        durationNote?: string;
                        /** @description 안건의 상태를 알리는 말. **명세가 목록을 들지 않는다.** 예: 대기 · 진행 중 · 논의 완료 · 정리 필요 · 정리됨 */
                        status?: string;
                        /** @description 그 딱지의 색 이름 */
                        statusTone?: string;
                        /**
                         * @description 지금 진행 중인 안건인가
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        isCurrent?: boolean;
                        /** @description 논의 내용. 회의 중에 참가자가 함께 쓴다 */
                        discussionText?: string;
                        /** @description 확정된 결정. 없으면 오지 않는다 */
                        decisionText?: string;
                        /** @description 결정이 아직 없을 때 그 자리에 그릴 말 */
                        decisionEmptyNote?: string;
                        /** @description 목록에서 한 줄로 줄여 보일 때의 글 */
                        summaryLine?: string;
                        /** @description 이 안건에서 나온 결정 수. 예: 결정 1 */
                        decisionCountNote?: string;
                        /** @description 이 안건에서 나온 업무 수. 예: 업무 1 */
                        taskCountNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.participants": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 지금 사회를 맡은 사람을 빼고 줄 것인가 */
                excludeHostOwner?: boolean;
            };
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이 사람을 가리키는 값 */
                        memberId: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속만. 03 계열은 줄에 '운영부'만 그리고 할 수 있는 일은 오른쪽에 따로 그린다. 04B는 같은 줄에 '운영부 · 회의 참가자'를 한 덩이로 그리므로 조각이 둘 필요하다 — 한 조각이 두 그림을 담을 수 없다. */
                        department: string;
                        /** @description 소속과 이 회의에서의 자리를 이은 한 줄. 예: 운영부 · 회의 참가자 */
                        departmentNote: string;
                        /** @description 이 사람에게 붙는 딱지들. **한 사람에 여럿일 수 있다** — 생성자는 '회의 생성자'와 '진행 권한'을 함께 단다 */
                        chips?: {
                            /** @description 딱지에 그려지는 말 */
                            label: string;
                            /** @description 딱지의 색 이름 */
                            tone: string;
                        }[];
                        /** @description 이 사람이 무엇을 할 수 있는지. 예: 시작·종료 가능 · 일반 참가자 */
                        capabilityNote?: string;
                        /** @description 참석 딱지에 그려지는 완성된 말. 시각까지 붙어서 온다 — 화면이 시각과 상태를 잇게 하면 잇는 방법이 명세의 일이 된다. 예: 15:00 참석 · 불참 · 미참석 */
                        attendanceLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        attendanceTone?: string;
                        /**
                         * @description 지금 들어와 있는가. 진행 중에만 온다
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        isPresent?: boolean;
                        /** @description 줄 오른쪽 단추에 그려지는 말. **명세가 들지 않는다** — '진행 권한 부여'와 '권한 해제'가 그 줄의 상태에 따라 갈리고, 생성자 줄처럼 단추가 아예 없는 자리도 있다 */
                        actionLabel?: string;
                        /** @description 그 단추의 강조도 */
                        actionEmphasis?: string;
                        /**
                         * @description 그 단추를 누를 수 있는가. 진행 권한자가 하나뿐이면 뺄 수 없다.
                         *
                         *     **참거짓으로 온다.** 'y'로 오고 있었는데 응답의 다른 판정들을 참거짓으로 고칠 때 빠졌다 — 훑는 규칙이 `can`으로 시작하는 이름만 봤기 때문이다. 이름이 규칙을 벗어나면 훑개가 조용히 놓친다.
                         */
                        actionEnabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.minutes": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 전체 요약 글 한 덩이 */
                        summaryText?: string;
                        /** @description 이 요약이 확정된 것인지 아닌지. 예: 정리 중 · 변경될 수 있음 */
                        statusLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        statusTone?: string;
                        /** @description AI 초안이 무엇을 하고 무엇을 하지 않는지. **화면에 적힌 이 글이 곧 계약이다** — 06B가 '기록에 없는 결정·담당자·기한을 새로 만들지 않습니다'라고 적어 두었다. 명세가 이 문장을 들면 계약이 바뀔 때 명세가 틀린다 */
                        aiDisclaimer?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.saveMinutes": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description agendaId */
                    agendaId: string;
                    /** @description 결정사항 */
                    decisionText?: string;
                    /** @description 이 안건은 결정사항 없음 */
                    noDecision?: boolean;
                    /** @description 후속 업무 없음 */
                    noFollowUp?: boolean;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "meeting.minutesProgress": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 필수 조건이 몇 개나 찼는지. 예: 필수 2 / 4 */
                        requiredDoneNote: string;
                        /** @description 정리를 마칠 수 없을 때 무엇이 남았는지. 예: 안건별 필수 정리를 완료해 주세요 */
                        blockedNote?: string;
                        /**
                         * @description 정리 완료를 누를 수 있는가
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canComplete: boolean;
                        /** @description 조건 하나하나 */
                        conditions: {
                            /** @description 무엇을 채워야 하는지 */
                            label: string;
                            /** @description 찼는가 */
                            done: string;
                            /** @description 없어도 되는 것인가. 전체 요약이 그렇다 */
                            optional?: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.minutesStatus": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 회의록의 부분 하나하나 */
                        parts: {
                            /** @description 어느 부분인지. 예: 안건 내용 · 의사결정 */
                            label: string;
                            /** @description 그 부분이 지금 어디까지 왔는지. **세는 것도 잇는 것도 서버다** — 부분마다 세는 단위가 달라서(안건은 몇 개 중 몇, 결정은 몇 건, 요약은 초안인지) 화면이 규칙을 가질 수 없다. 예: 2 / 3 정리 · 2건 확인 · 초안 작성 */
                            stateNote: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.documents": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이 자료를 가리키는 값 */
                        documentId: string;
                        /** @description 파일 이름. 받아 갈 때 이 조각을 가리킨다 */
                        name: string;
                        /** @description 어느 안건의 자료인지. 회의 전체에 붙은 것이면 오지 않는다 */
                        agendaId?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.followUps": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이 업무를 가리키는 값 */
                        taskId: string;
                        /** @description 업무 이름 */
                        title: string;
                        /** @description 누가 언제까지. 예: 정하늘 · 07.23까지 · 위 결정사항에서 생성 */
                        assigneeNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.myFollowUps": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이 업무를 가리키는 값 */
                        taskId: string;
                        /** @description 업무 이름 */
                        title: string;
                        /** @description 누가 언제까지. 예: 정하늘 · 07.23까지 · 위 결정사항에서 생성 */
                        assigneeNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.permissionNotice": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 예: 이 회의에만 적용되는 권한입니다 */
                        title: string;
                        /** @description 진행 권한자가 할 수 있는 것 */
                        grantNote: string;
                        /** @description 생성자만 할 수 있는 것 */
                        limitNote: string;
                        /** @description 지켜야 하는 규칙 딱지. 예: 최소 1명 유지 */
                        ruleChipLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        ruleChipTone?: string;
                        /** @description 지금 몇 명인지. 예: 현재 진행 권한자 2명 · 일반 참가자 3명 */
                        summaryNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.startConfirm": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 눈여겨볼 것을 이은 완성된 한 줄. 예정 시각에 시작하면 오지 않을 수 있다. 예: 예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요. */
                        warningNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.endConfirm": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 셋을 이어 서버가 완성한 한 줄. 예: 미완료 안건 1개 · 참석 3명 · 미참가 1명 */
                        warningNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.hostGrantConfirm": {
        parameters: {
            query: {
                /** @description 어느 구성원인가 */
                memberId: string;
            };
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 예: 이수현에게 진행 권한을 부여할까요? */
                        title: string;
                        /** @description 그 사람이 갖게 되는 것 */
                        grantNote: string;
                        /** @description 그래도 갖지 못하는 것 */
                        limitNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.draft": {
        parameters: {
            query?: {
                /** @description 어느 회의의 초안인가. **없으면 새로 만드는 것**이다 */
                meetingId?: string;
            };
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
                        /** @description 정기·상시인지 행사 관련인지 */
                        meetingType?: string;
                        /** @description 연결 행사 */
                        linkedEventId?: string;
                        /** @description 회의명 */
                        title?: string;
                        /** @description 주최자. **읽기 전용 칸에 그대로 그린다** — 사람이 정하는 값이 아니다 */
                        hostName: string;
                        /** @description 주관 부서 */
                        departmentId?: string;
                        /** @description 회의 상태 칸에 그릴 말. **'예정'을 명세에 박으면 안 된다** — 상태 이름은 는다 */
                        statusLabel: string;
                        /** @description 회의 목적 */
                        purpose?: string;
                        /** @description 회의 날짜 */
                        date?: string;
                        /** @description 시작 예정 시각 */
                        startTime?: string;
                        /** @description 종료 예정 시각 */
                        endTime?: string;
                        /** @description 진행 방식 */
                        mode?: string;
                        /** @description 장소 */
                        place?: string;
                        /** @description 온라인 링크 */
                        onlineLink?: string;
                        /** @description 비공개 회의인가. 참/거짓이다 */
                        isPrivate?: boolean;
                        /** @description 고른 참가자들 */
                        participants?: {
                            /** @description 이 사람을 가리키는 값 */
                            memberId: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 소속 */
                            departmentNote: string;
                            /** @description 붙는 딱지들 */
                            chips?: {
                                /** @description 말 */
                                label: string;
                                /** @description 색 이름 */
                                tone: string;
                            }[];
                            /** @description 줄 오른쪽 단추의 말. 명세가 들지 않는다 */
                            actionLabel?: string;
                            /** @description 그 단추의 강조도. 글만으로는 부족하다 — 권한을 빼는 것과 주는 것이 줄마다 다른 색으로 그려진다. meeting.participants가 같은 짝을 갖는다. */
                            actionEmphasis?: string;
                            /**
                             * @description 뺄 수 있는가
                             *
                             *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                             */
                            canRemove?: boolean;
                        }[];
                        /** @description 세워 둔 안건들 */
                        agendaItems?: {
                            /** @description 안건명 */
                            agendaTitle: string;
                            /** @description 안건 설명 */
                            agendaNote?: string;
                            /** @description 사전 자료 파일 이름 */
                            attachmentName?: string;
                            /** @description 예상 소요 시간 */
                            duration?: string;
                        }[];
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
    "meeting.memberCandidates": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 이 사람을 가리키는 값 */
                        memberId: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 소속 */
                        departmentNote: string;
                        /**
                         * @description 이미 넣은 사람인가.
                         *
                         *     **참거짓으로 온다.** 'y'로 오고 있었는데 판정 조각들을 참거짓으로 고칠 때 빠졌다 — 훑는 규칙이 `can`으로 시작하는 이름만 봤기 때문이다. 값으로 훑는 눈금을 만들자 `actionEnabled`와 함께 걸렸다.
                         */
                        alreadyAdded?: boolean;
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
    "meeting.hostOwner": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 이름 */
                        name: string;
                        /** @description 소속과 이 사람이 무엇을 할 수 있는지를 이은 한 줄. 예: 운영부 · 권한 변경 및 회의 관리 가능 */
                        departmentNote: string;
                        /** @description 붙는 딱지들. 생성자는 '회의 생성자'와 '진행 권한'을 함께 단다 */
                        chips: {
                            /** @description 딱지에 그려지는 말 */
                            label: string;
                            /** @description 딱지의 색 이름 */
                            tone: string;
                        }[];
                        /** @description 이 사람을 뺄 수 없다는 표시. 예: 필수 권한자 */
                        capabilityNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.listViewer": {
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
                        /**
                         * @description 새 행사를 만들 수 있는가. 만들 수 있는 사람에게만 머리에 그 단추가 그려진다
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canCreateEvent: boolean;
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
    "event.wrapUpBanner": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 상태 딱지에 그려지는 말. 예: 후속 정리 중 */
                        stateLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        stateTone: string;
                        /** @description 누가 다음 단계로 넘길 수 있는지. 예: 행사 완료 처리는 회장단만 할 수 있습니다. */
                        permissionNote: string;
                        /** @description 띠의 제목. 예: 행사가 종료되었습니다 */
                        headline: string;
                        /** @description 띠의 본문 */
                        note: string;
                        /** @description 띠 자체의 색 이름 */
                        tone: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.wrapUpCounts": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 미완료 업무 수 */
                        unfinishedTasks: string;
                        /** @description 그 색 이름 */
                        unfinishedTasksTone: string;
                        /** @description 정리되지 않은 문서 수 */
                        unorganizedDocs: string;
                        /** @description 그 색 이름 */
                        unorganizedDocsTone: string;
                        /** @description 작성되지 않은 회의록 수 */
                        unwrittenMinutes: string;
                        /** @description 그 색 이름 */
                        unwrittenMinutesTone: string;
                        /** @description 확인이 필요한 것의 수 */
                        needsCheck: string;
                        /** @description 그 색 이름 */
                        needsCheckTone: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.wrapUpRemaining": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 그 원본을 가리키는 값 */
                        id: string;
                        /** @description 무엇이 남았는지 */
                        title: string;
                        /** @description 그 까닭이나 때 */
                        detail: string;
                        /** @description 급한 정도에 배정된 색 이름 */
                        tone: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.endPermission": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 예: 행사를 종료할 권한이 없습니다 */
                        title: string;
                        /** @description 누가 할 수 있는지를 적은 완성된 글 */
                        note: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.completeConfirm": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 눈여겨볼 것. 예: 미완료 업무 6건 */
                        warningNote?: string;
                        /** @description 그 상자의 색 이름 */
                        warningTone?: string;
                        /** @description 누가 완료 처리할 수 있는지. 예: 행사 완료 처리는 회장단만 할 수 있습니다. */
                        permissionNote: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffLeaders": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 사람을 가리키는 값 */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 학부·학과 */
                        major: string;
                        /** @description 학년 */
                        grade: string;
                        /** @description 이 행사에서의 자리. **명세가 들지 않는다** */
                        roleLabel?: string;
                        /** @description 그 딱지의 색 이름 */
                        roleTone?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffDepartments": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 부서를 가리키는 값 */
                        id: string;
                        /** @description 부서 이름 */
                        name: string;
                        /** @description 부원 수. 세는 말까지. 예: 부원 4명 */
                        memberCountLabel: string;
                        /** @description 부서장들 */
                        leaders?: {
                            /** @description 가리키는 값 */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 학부·학과 */
                            major: string;
                            /** @description 학년 */
                            grade: string;
                        }[];
                        /** @description 부원들 */
                        members?: {
                            /** @description 가리키는 값 */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 학부·학과 */
                            major: string;
                            /** @description 학년 */
                            grade: string;
                            /** @description 이 부서에서의 자리(부서장을 겸하는 부원에게만 온다). **명세가 들지 않는다** — leaders로는 그 글을 알 수 없다. */
                            roleLabel?: string;
                            /** @description 그 글의 색 이름 */
                            roleTone?: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffUnassignedMembers": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 가리키는 값 */
                        id: string;
                        /** @description 이름 */
                        name: string;
                        /** @description 학부·학과 */
                        major: string;
                        /** @description 학년 */
                        grade: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffSetupPreview": {
        parameters: {
            query: {
                /** @description 어느 방식으로 만들 것인가. 아직 만들어지지 않은 것의 미리보기이므로 방식이 조회에 든다 */
                setupMode: string;
            };
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 가리키는 값 */
                        id: string;
                        /** @description 부서 이름 */
                        name: string;
                        /** @description 부원 수. 세는 말까지 */
                        memberCountLabel: string;
                        /** @description 부서장들 */
                        leaders?: {
                            /** @description 가리키는 값 */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 학부·학과 */
                            major: string;
                            /** @description 학년 */
                            grade: string;
                        }[];
                        /** @description 부원들 */
                        members?: {
                            /** @description 가리키는 값 */
                            id: string;
                            /** @description 이름 */
                            name: string;
                            /** @description 학부·학과 */
                            major: string;
                            /** @description 학년 */
                            grade: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.basicsDraft": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사명 */
                        title: string;
                        /** @description 행사 소개 */
                        intro?: string;
                        /** @description 행사 목적·주요 내용 */
                        purpose?: string;
                        /** @description 시작 일시 */
                        startAt?: string;
                        /** @description 종료 일시 */
                        endAt?: string;
                        /** @description 종료 시간이 아직 정해지지 않았는가 */
                        endUnset?: boolean;
                        /** @description 장소 */
                        place?: string;
                        /** @description 장소가 아직 정해지지 않았는가 */
                        placeUnset?: boolean;
                        /** @description 주소 */
                        address?: string;
                        /** @description 상세 위치·집합 장소 */
                        placeDetail?: string;
                        /** @description 참가 대상 */
                        audience?: string;
                        /** @description 참가비 유형 */
                        feeType: string;
                        /** @description 납부자 금액 */
                        paidAmount?: string;
                        /** @description 미납자 금액 */
                        unpaidAmount?: string;
                        /** @description 결제 안내 */
                        payGuide?: string;
                        /** @description 정원 유형 */
                        capacityType: string;
                        /** @description 정원 인원 */
                        capacity?: string;
                        /** @description 담당 부서 */
                        hostDepartment?: string;
                        /** @description 담당자 */
                        hostPerson?: string;
                        /** @description 문의 방법·연락처 */
                        contact?: string;
                        /** @description 참가자 유의사항 */
                        notice?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.attendanceQr": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description QR의 상태를 알리는 말. **명세가 목록을 들지 않는다.** 예: 활성 중 */
                        statusLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        statusTone: string;
                        /** @description 체크인을 받기 시작하는 때 */
                        startAt: string;
                        /** @description 체크인을 그만 받는 때 */
                        endAt: string;
                        /** @description 참가자가 어떻게 쓰는지 알리는 완성된 글 */
                        guideNote: string;
                        /** @description 받아 갈 QR 그림 파일. 무엇을 어떤 형식으로 낼지는 서버가 정한다 */
                        fileName: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.survey": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 설문의 상태를 알리는 말. 예: 초안 · 활성 */
                        statusLabel: string;
                        /** @description 그 딱지의 색 이름 */
                        statusTone: string;
                        /** @description 미리 볼 수 있는 주소. 아직 없으면 오지 않는다 */
                        previewUrl?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.surveySettingsDraft": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 신청 시작 */
                        applyStart?: string;
                        /** @description 신청 마감 */
                        applyEnd?: string;
                        /** @description 신청 방식 */
                        applyMethod?: string;
                        /** @description 정원 초과 시 대기 신청을 받는가 */
                        waitlist?: boolean;
                        /** @description 학생회비 납부 여부를 대조하는가 */
                        duesCheck?: string;
                        /** @description 신청 완료 안내 문구 */
                        completionNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.surveyActivation": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 못 채운 조건 수. 세는 말까지. 예: 미충족 2개 */
                        unmetCountNote: string;
                        /** @description 그 수 */
                        unmetCount: number;
                        /**
                         * @description 지금 켤 수 있는가
                         *
                         *     **참거짓으로 온다.** 빈 글과 'y'로 쓰던 것을 고쳤다(2026-08-30) — 권한 판정이 글로 API를 건너면 받는 쪽이 무엇이 참인지 규칙을 따로 알아야 한다.
                         */
                        canActivate: boolean;
                        /** @description 켤 수 없을 때 그 까닭 */
                        blockedNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.surveyActivationConditions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 묶음 이름. 예: 행사 기본정보 */
                        groupLabel: string;
                        /** @description 그 묶음의 조건들 */
                        rows: {
                            /** @description 이 조건을 가리키는 값 */
                            key: string;
                            /** @description 무엇을 채워야 하는지 */
                            label: string;
                            /** @description 채워졌는가 */
                            met: string;
                            /** @description 그 표시의 색 이름 */
                            tone: string;
                            /** @description 지금 무엇이 들어 있는지 */
                            detail?: string;
                            /** @description 어디서 채우는지 */
                            locationNote?: string;
                            /** @description 채우러 가는 문구. 갈 곳이 없으면 오지 않는다 */
                            actionLabel?: string;
                            /** @description 어느 화면으로 가는지를 아는 열쇠. 화면 id가 아니다 — 갈 곳은 명세가 든다 */
                            targetKind?: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.surveyQuestions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 문항을 가리키는 값 */
                        id: string;
                        /** @description 질문 글 */
                        title: string;
                        /** @description 문항의 종류를 알리는 말. **명세가 목록을 들지 않는다** */
                        typeLabel: string;
                        /** @description 문항에 붙는 딱지들. 개수가 데이터에 달렸다 */
                        badges?: {
                            /** @description 딱지의 말 */
                            label: string;
                            /** @description 그 색 이름 */
                            tone: string;
                        }[];
                        /** @description 고칠 수 없는 문항인가. 응답이 있으면 잠긴다 */
                        locked?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.surveyReplaceImpact": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 무엇을 하려는지 */
                        title: string;
                        /** @description 되돌릴 수 없다는 것을 알리는 글 */
                        warning: string;
                        /** @description 지금 설문의 응답자 수 */
                        currentRespondents: string;
                        /** @description 영향을 받는 응답자 수 */
                        affectedRespondents: string;
                        /** @description 함께 알아야 할 것들 */
                        notes: {
                            /** @description 한 줄 */
                            text: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.budgetPlanDraft": {
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
                        /** @description 회계 기간 시작. YYYY-MM-DD. **아직 안 정했으면 오지 않는다.** 예: 2026-03-01 */
                        periodStart?: string;
                        /** @description 회계 기간 끝. YYYY-MM-DD. 아직 안 정했으면 오지 않는다. 예: 2026-08-31 */
                        periodEnd?: string;
                        /** @description 수입원들. 총예산은 이것의 합이다. 없으면 빈 목록이다. */
                        sources: {
                            /** @description 이 줄을 가리키는 값. 새 줄은 비어 있다. */
                            id?: string;
                            /** @description 어디서 온 돈인가. 예: 학생회비 */
                            sourceName: string;
                            /** @description 금액(원). 수로 온다 — 자릿점은 화면이 붙인다. 예: 24000000 */
                            sourceAmount: number;
                        }[];
                        /** @description 행사에 속하지 않는 상시 예산 항목들. 없으면 빈 목록이다. */
                        items: {
                            /** @description 이 줄을 가리키는 값. 새 줄은 비어 있다. */
                            id?: string;
                            /** @description 항목 이름. 예: 운영비 */
                            itemName: string;
                            /** @description 배정액(원). 수로 온다. 예: 3000000 */
                            itemAmount: number;
                            /** @description 담당 부서. org.departments의 값. 부서별 집행률이 이것으로 선다. 없으면 오지 않는다. */
                            itemDepartment?: string;
                            /**
                             * @description 담당 부서의 이름. 값(`itemDepartment`) 곁에 함께 온다 — 고르는 목록이 열리기 전에도 화면이 그 말을 그린다. 안 고른 줄에는 오지 않는다.
                             *
                             *     **값 곁에 이름이 함께 온다**(2026-09-06). 값은 id라 첫 그림에 사람이 읽을 말이 없었고, 이름은 고르는 목록이 열릴 때에야 왔다 — 그림 대조가 그 이름과 그것이 든 칸을 못 보아 자리 예외 열셋이 걸려 있었다. 예외로 버티는 것은 눈금이 아니라 기록이다.
                             */
                            itemDepartmentName?: string;
                        }[];
                        /** @description 행사별 예산 항목들. 줄마다 어느 행사의 것인지를 든다. 없으면 빈 목록이다. */
                        eventItems: {
                            /** @description 이 줄을 가리키는 값. 새 줄은 비어 있다. */
                            id?: string;
                            /** @description 어느 행사의 항목인가. finance.budgetEvents의 값. */
                            eventItemEvent: string;
                            /** @description 항목 이름. 예: 물품비 */
                            eventItemName: string;
                            /** @description 배정액(원). 수로 온다. 예: 1200000 */
                            eventItemAmount: number;
                            /**
                             * @description 담당 부서. `org.departments`의 값. 부서별 집행률이 이것으로 선다. 없으면 오지 않는다.
                             *
                             *     **2026-09-06에 사람이 정했다: 행사 항목도 부서를 고른다.** 이 칸이 없던 동안 행사에 쓴 돈이 전부 재정 겉면의 '부서 미지정' 한 줄에 모였고, 부서별로 본다는 축이 뜻을 거의 잃었다. 안 고를 수 있다 — 학생회 전체가 함께 쓰는 항목이 있고, 그런 것만 '부서 미지정'에 남는다.
                             */
                            eventItemDepartment?: string;
                            /** @description 담당 부서의 이름. 값 곁에 함께 온다. 안 고른 줄에는 오지 않는다. */
                            eventItemDepartmentName?: string;
                            /** @description 그 행사의 이름. 값 곁에 함께 온다 — 행사 고르기가 첫 그림부터 그 말을 그린다. */
                            eventItemEventName: string;
                        }[];
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
    "finance.budgetPlan.save": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 시작일 */
                    periodStart: string;
                    /** @description 끝일 */
                    periodEnd: string;
                    /** @description 수입원 */
                    sources?: {
                        /** @description 이름 */
                        sourceName: string;
                        /** @description 금액(원) */
                        sourceAmount: number;
                    }[];
                    /** @description 이름 */
                    sourceName: string;
                    /** @description 금액(원) */
                    sourceAmount: number;
                    /** @description 상시 예산 항목 */
                    items?: {
                        /** @description 이름 */
                        itemName: string;
                        /** @description 배정액(원) */
                        itemAmount: number;
                        /** @description 담당 부서(선택) */
                        itemDepartment?: string;
                    }[];
                    /** @description 이름 */
                    itemName: string;
                    /** @description 배정액(원) */
                    itemAmount: number;
                    /** @description 담당 부서(선택) */
                    itemDepartment?: string;
                    /** @description 행사 */
                    event?: string;
                    /** @description 행사별 예산 항목 */
                    eventItems?: {
                        /** @description 이름 */
                        eventItemName: string;
                        /** @description 배정액(원) */
                        eventItemAmount: number;
                        /** @description 담당 부서(선택) */
                        eventItemDepartment?: string;
                    }[];
                    /** @description 이름 */
                    eventItemName: string;
                    /** @description 배정액(원) */
                    eventItemAmount: number;
                    /** @description 담당 부서(선택) */
                    eventItemDepartment?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.orgOverview": {
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
                        /** @description 회계 기간. 예: 2026년 1학기 */
                        termNote: string;
                        /** @description 언제를 기준으로 센 값인지. 예: 2026.07.18 기준 */
                        asOfNote: string;
                        /** @description 총예산. 자릿점까지 찍힌 글로 온다 — 화폐 표기가 조직·지역의 것이기 때문이다. 예: 30,000,000원 */
                        totalBudget: string;
                        /** @description 그 예산이 어디서 왔는지. 예: 학생회비 외 1건 */
                        totalBudgetNote: string;
                        /** @description 실제 지출. 예: 12,400,000원 */
                        spent: string;
                        /** @description 무엇을 실제 지출로 셌는지. 예: 결제가 완료된 9건 */
                        spentNote: string;
                        /** @description 지출 예정. 예: 3,100,000원 */
                        planned: string;
                        /** @description 무엇을 예정으로 셌는지. 예: 결제 예정 3건 */
                        plannedNote: string;
                        /** @description 사용 가능. 총예산에서 무엇을 빼는지가 재정 규칙이라 화면이 계산하지 않는다. 예: 14,500,000원 */
                        available: string;
                        /** @description 그 금액이 무엇인지 알리는 문구. 예: 새로 사용할 수 있는 금액 */
                        availableNote: string;
                        /** @description 집행률을 말한 완성된 문구. 예: 전체 예산 집행률 41.3% */
                        executionNote: string;
                        /** @description 지출 예정까지 더한 집행률의 완성된 문구. 예: 지출 예정 포함 51.7% */
                        plannedIncludedNote: string;
                        /** @description 실제 지출이 총예산에서 차지하는 비율(0-100). 막대의 첫 마디다 — 수는 데이터이고 막대는 디자인이다 */
                        spentPercent: number;
                        /** @description 지출 예정이 차지하는 비율(0-100). 첫 마디에 이어 붙는 몫이라 둘을 더하면 '지출 예정 포함' 비율이 된다 */
                        plannedPercent: number;
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
    "finance.orgBreakdown": {
        parameters: {
            query: {
                /** @description 총예산을 무엇 단위로 나눠 볼 것인가(행사별·부서별). **줄의 뜻이 통째로 바뀐다** */
                scope: string;
            };
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
                        /** @description 그 행사 또는 부서의 id */
                        id: string;
                        /** @description 구분의 이름. 행사별이면 행사명, 부서별이면 부서명 */
                        name: string;
                        /** @description 배정 예산. 예: 5,000,000원 */
                        budget: string;
                        /** @description 실제 지출. 예: 2,100,000원 */
                        spent: string;
                        /** @description 지출 예정. 예: 600,000원 */
                        planned: string;
                        /** @description 사용 가능. 예: 2,300,000원 */
                        available: string;
                        /** @description 집행률(0-100). 수는 데이터이고 막대는 디자인이다(home.events의 progressPercent 선례) */
                        executionPercent: number;
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
    "finance.recentExpenses": {
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
                        /** @description 장부 줄의 id */
                        id: string;
                        /** @description 쓴 날. 예: 07.17 */
                        date: string;
                        /** @description 지출 내용. 예: 현수막 제작 */
                        title: string;
                        /** @description 어느 행사 또는 어디에 썼는지. 예: 체육대회 */
                        context: string;
                        /** @description 금액. 예: 180,000원 */
                        amountNote: string;
                        /** @description 증빙 상태. 조직의 절차가 정하는 말이라 명세가 목록을 들지 않는다 */
                        proof: string;
                        /** @description 그 딱지의 색 이름 */
                        proofTone: string;
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
    "finance.proofSummary": {
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
                        /** @description 증빙이 끝난 건수. 단위까지 붙어서 온다. 예: 6건 */
                        completed: string;
                        /** @description 보완이 필요한 건수. 예: 1건 */
                        supplement: string;
                        /** @description 아직 증빙이 등록되지 않은 건수. 예: 2건 */
                        unregistered: string;
                        /** @description 전체 지출 건수. 예: 26건 */
                        totalNote: string;
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
    "finance.ledgerSummary": {
        parameters: {
            query?: {
                /** @description 어느 달인가. **달의 이름도 서버가 준다** — 이것이 없으면 낼 글이 없다 */
                month?: string;
            };
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
                        /** @description 이번 학기에 쓴 돈 전부. 예: 3,842,000원 */
                        termTotal: string;
                        /** @description 고른 달의 지출을 부르는 말. 예: 7월 지출 */
                        monthLabel: string;
                        /** @description 그 달에 쓴 돈. 예: 1,286,000원 */
                        monthTotal: string;
                        /** @description 증빙이 끝난 건수를 전체와 함께 말한 문구. 예: 42건 중 37건 */
                        proofDone: string;
                        /** @description 증빙이 빠진 건수. 예: 5건 */
                        proofMissing: string;
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
    "finance.ledger": {
        parameters: {
            query?: {
                /** @description 어느 달의 내역만 볼 것인가 */
                month?: string;
                /** @description 어느 행사가 쓴 것만 볼 것인가 */
                eventId?: string;
                /** @description 어느 부서가 쓴 것만 볼 것인가 */
                departmentId?: string;
                /** @description 어느 예산 항목의 것만 볼 것인가 */
                budgetItemId?: string;
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 어느 결재 단계의 내역만 볼 것인가. 주소가 실어 오는데 화면이 **없어도 열린다**고 말하므로, 없이 오면 전부다 */
                stage?: string;
            };
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
                        /** @description 장부 줄의 id */
                        id: string;
                        /** @description 쓴 날. 예: 07.17 */
                        date: string;
                        /** @description 무엇에 썼는지. 예: 케이블 커버 6m 외 1건 */
                        title: string;
                        /** @description 어느 행사 또는 어디에 썼는지. 행사에 속하지 않는 지출은 '운영 (상시)'처럼 온다 */
                        context: string;
                        /** @description 쓴 부서. 예: 운영부 */
                        department: string;
                        /** @description 어느 예산 항목에서 나갔는지. 예: 안전·설비 */
                        budgetItem: string;
                        /** @description 금액. 예: 84,000원 */
                        amountNote: string;
                        /** @description 증빙 상태. 조직의 절차가 정하는 말이라 명세가 목록을 들지 않는다 */
                        proof: string;
                        /** @description 그 딱지의 색 이름 */
                        proofTone: string;
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
    "finance.ledgerScope": {
        parameters: {
            query?: {
                /** @description 어느 달의 내역만 볼 것인가 */
                month?: string;
                /** @description 어느 행사가 쓴 것만 볼 것인가 */
                eventId?: string;
                /** @description 어느 부서가 쓴 것만 볼 것인가 */
                departmentId?: string;
                /** @description 어느 예산 항목의 것만 볼 것인가 */
                budgetItemId?: string;
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
                /** @description 어느 결재 단계의 내역만 볼 것인가. 주소가 실어 오는데 화면이 **없어도 열린다**고 말하므로, 없이 오면 전부다 */
                stage?: string;
            };
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
                        /** @description 무엇의 몇 줄을 보고 있는지. 예: 2026년 7월 · 총 42건 중 최근 10건 표시 */
                        rangeNote: string;
                        /** @description 증빙과 정산을 누가 어디서 하는지 알리는 완성된 문구. **역할 이름이 여기 들어간다**(event.endPermission 선례) — 조직 규칙이 바뀌면 명세가 아니라 이 값이 바뀐다 */
                        handlingNote: string;
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
    "ops.calendarMonth": {
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
                        /** @description 지금 보고 있는 달의 이름. 예: 2026년 7월 */
                        monthLabel: string;
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
    "ops.calendarDays": {
        parameters: {
            query: {
                /** @description 달력이 무엇을 그리는가 */
                type: string;
            };
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
                        /** @description 그 칸이 어느 날인지. 그려지지 않는다. 예: 2026-07-19 */
                        id: string;
                        /** @description 칸에 그려지는 날짜 수. 달에 들지 않는 빈칸은 빈 글이다. 예: 19 */
                        dayLabel: string;
                        /** @description 날짜 수의 색 이름. 토·일이 갈리고 오늘이 따로 있다 — **오늘이 언제인지는 서버만 안다.** 예: gray · blue · red · today */
                        dayTone: string;
                        /** @description 그날에 걸린 일정들. 없는 날은 빈 목록이다. */
                        schedules: {
                            /** @description 일정 하나를 가리키는 값. 그려지지 않는다. 예: SCH-0720-1 */
                            id: string;
                            /** @description 딱지에 그려지는 일정의 이름. 예: 체육대회 참가 신청 마감 */
                            title: string;
                            /** @description 일정 유형에 배정된 색 이름. **유형의 이름이 곧 톤 이름이다** — 유형이 하나 늘면 색도 하나 는다. 예: event · meeting · deadline */
                            typeTone: string;
                        }[];
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
    "ops.calendarWeekRange": {
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
                        /** @description 이번 주의 범위와 오늘. 예: 07.19 (일) – 07.25 (토) · 오늘 07.19 */
                        rangeNote: string;
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
    "ops.calendarWeek": {
        parameters: {
            query: {
                /** @description 달력이 무엇을 그리는가 */
                type: string;
            };
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
                        /** @description 일정 하나를 가리키는 값. 그려지지 않는다. 예: SCH-0720-1 */
                        id: string;
                        /** @description 유형 딱지의 글. 예: 마감 · 회의 · 행사 */
                        typeLabel: string;
                        /** @description 그 딱지의 색 이름. 예: deadline · meeting · event */
                        typeTone: string;
                        /** @description 일정이 걸린 날. 예: 07.20 */
                        dateLabel: string;
                        /** @description 일정의 이름. 예: 체육대회 참가 신청 마감 */
                        title: string;
                        /** @description 그 줄에서 열 수 있는 것의 이름. 예: 행사 일정 보기. **행사에 딸리지 않은 줄에는 오지 않는다** — 상시 업무의 마감과 운영 회의가 그렇다. */
                        actionLabel?: string;
                        /** @description 행사에 딸린 줄이면 그 행사의 id. actionLabel과 함께 오거나 함께 오지 않는다. 예: E-01 */
                        eventId?: string;
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
    "record.completedEventAlert": {
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
                        /** @description 인수인계 문서가 아직 발행되지 않은 행사 수. 세는 말까지 서버가 붙인다. 한 건도 없으면 오지 않는다. 예: 인수인계 문서 미발행 2건 */
                        unpublishedNote?: string;
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
    "record.completedEvents": {
        parameters: {
            query?: {
                /** @description 검색어. 거르지 않으려면 넘기지 않는다 */
                query?: string;
            };
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
                        /** @description 이 행사를 가리키는 값. 아카이브를 열 때 넘긴다. */
                        id: string;
                        /** @description 행사 자체의 상태. 이 목록에는 완료된 것만 오지만 무엇이라 부를지는 조직이 정한다. 예: 완료 */
                        statusLabel: string;
                        /** @description 인수인계 문서가 어디까지 왔는지. 예: 발행 v1.0 · 검토 중 · 인수인계 문서 미발행 */
                        archiveStatus: string;
                        /** @description 그 딱지의 색 이름. 단계가 조직 운영에 따라 늘 수 있으므로 색도 데이터가 갖는다. 예: green · blue · gray */
                        archiveStatusTone: string;
                        /** @description 행사 이름. 예: 봄 축제 학생회 부스 */
                        title: string;
                        /** @description 행사가 열린 날. 예: 2026. 05. 28 */
                        date: string;
                        /** @description 맡은 부서 또는 사람. 완성된 문구로 온다. 예: 대외협력부 · 홍길동 */
                        host: string;
                        /** @description 그 행사를 한눈에 말하는 딱지들. 완성된 문구로 오고 개수가 행사마다 다르다. */
                        highlights: {
                            /** @description 딱지에 쓰이는 완성된 문구. 예: 186명 참석 (신청 210명) */
                            label: string;
                        }[];
                        /** @description 완료 처리된 때. 완성된 문구로 온다. 예: 완료 처리 2026. 06. 04 */
                        completedNote: string;
                        /** @description 아카이브를 열러 가는 문구. 열 것이 없으면 오지 않는다(event.checklist의 actionLabel과 같은 규칙). 예: 상세 보기 → */
                        actionLabel?: string;
                        /** @description 열 것이 없을 때 그 까닭. actionLabel과 짝이라 둘 중 하나만 온다. 예: 인수인계 문서가 아직 발행되지 않았습니다 */
                        blockedNote?: string;
                        /** @description 이 줄을 열면 어느 화면인지를 아는 열쇠. **화면 id가 아니다** — 발행된 문서는 읽는 화면으로, 아직 발행되지 않은 것은 쓰고 검토받는 화면으로 간다. 갈 곳은 명세가 든다. */
                        targetKind?: string;
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
    "record.archive": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사 이름. 문서의 제목이자 빵부스러기의 마지막 조각이다. 예: 봄 축제 학생회 부스 */
                        title: string;
                        /** @description 이 문서의 상태. 예: 발행 v1.0 */
                        statusLabel: string;
                        /** @description 그 딱지의 색 이름. 예: green */
                        statusTone: string;
                        /** @description 행사가 열린 때. 완성된 문구로 온다. 발행된 문서에만 온다. 예: 2026. 05. 28 (목) 11:00–17:00 */
                        scheduleNote?: string;
                        /** @description 맡은 부서와 책임자. 완성된 문구로 온다. 발행된 문서에만 온다. 예: 대외협력부 · 책임자 이윤슬 */
                        ownerNote?: string;
                        /** @description 발행된 때. 발행된 문서에만 온다. 예: 발행 2026. 06. 04 */
                        publishedNote?: string;
                        /** @description 누가 썼는지. 발행된 문서에만 온다. 예: 작성 이윤슬 */
                        authorNote?: string;
                        /** @description 누가 검토했는지. 역할 이름까지 서버가 완성해 보낸다 — 명세는 역할의 목록을 들지 않는다. 발행된 문서에만 온다. 예: 검토 김바다 (회장단) */
                        reviewerNote?: string;
                        /** @description 이 일을 다음에 맡는 자리. 인수인계 절의 마지막 줄이다. 발행된 문서에만 온다. 예: 다음 담당: 대외협력부 부서장 */
                        nextOwnerNote?: string;
                        /** @description AI 초안이 무엇을 하고 무엇을 하지 않는지. 화면에 적힌 이 글이 곧 그 동작의 계약이다(meeting.minutes의 aiDisclaimer와 같은 자리) — 명세가 이 문장을 들면 계약이 바뀔 때 명세가 틀린다. 쓰는 화면에만 온다. */
                        aiDisclaimer?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveSections": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 절을 가리키는 값. 예: overview */
                        key: string;
                        /** @description 절의 이름. 예: 개요 */
                        label: string;
                        /** @description 이 절이 어디까지 왔는지. 쓰는 화면에만 온다. 예: 자동 · 작성 전 */
                        statusLabel?: string;
                        /** @description 그 글의 색 이름. 예: gray · orange */
                        statusTone?: string;
                        /** @description 절 안에서 다시 나뉘는 갈래. 나뉘지 않는 절에는 오지 않는다(발행된 문서의 회고만 셋으로 나뉜다). */
                        rows?: {
                            /** @description 갈래를 가리키는 값. 예: retroGood */
                            key: string;
                            /** @description 갈래의 이름. 예: 잘된 점 */
                            label: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveDetail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 행사 목표. 예: 재학생 교류 확대와 학생회 활동 홍보 */
                        goal: string;
                        /** @description 참여 대상. 예: 소프트웨어융합대학 재학생 전체 */
                        audience: string;
                        /** @description 일정과 장소. 완성된 문구로 온다. 예: 2026. 05. 28 11:00–17:00 · 한양대 ERICA 잔디밭 */
                        scheduleAndPlace: string;
                        /** @description 책임 부서와 책임자. 예: 대외협력부 · 이윤슬 */
                        owner: string;
                        /** @description 행사 규모. 예: 부스 4개 · 운영 인력 12명 · 참석 186명 */
                        scale: string;
                        /** @description 신청 대비 참석. 비율까지 서버가 셈해 보낸다. 예: 신청 210명 → 참석 186명 (88.6%) */
                        attendance: string;
                        /** @description 만족도. 예: 설문 응답 142건 · 긍정 89% */
                        satisfaction: string;
                        /** @description 예산 계획 대비 집행. 예: 계획 1,200,000원 → 집행 1,104,000원 (92%) */
                        budget: string;
                        /** @description 업무 완료. 예: 전체 14건 완료 · 지연 2건 */
                        taskCompletion: string;
                        /** @description 실제 진행 순서. 예: 09:00 설치 → 11:00 개장 → 14:00 경품 추첨 → 16:30 정리 → 17:00 종료 */
                        runOrder: string;
                        /** @description 인력 배치. 예: 부스별 2명 · 안내 2명 · 물품 관리 1명 · 총괄 1명 */
                        staffing: string;
                        /** @description 돌발 상황과 대응. 예: 13시경 강풍으로 배너 2개 전도. 즉시 고정 추가 후 재설치 */
                        incident: string;
                        /** @description 운영 변경. 예: 대기 인원이 몰려 경품 추첨을 30분 앞당김 */
                        operationChange: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveTimeline": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 마디를 가리키는 값. */
                        id: string;
                        /** @description 그 날. 완성된 문구로 온다. 예: 04. 12 */
                        date: string;
                        /** @description 무슨 일이 있었는지. 예: 기획 확정 */
                        title: string;
                        /** @description 그 일의 내용. 예: 부스 4종 구성과 예산 규모를 운영회의에서 승인 */
                        description: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveEvidence": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 줄을 가리키는 값. */
                        id: string;
                        /** @description 어떤 원본인지. 예: 행사 업무 */
                        title: string;
                        /** @description 발행 시점의 수치. 완성된 문구로 온다. 예: 14건 (완료 12 · 지연 2) */
                        detail: string;
                        /** @description 원본을 열러 가는 문구. 갈 곳이 없으면 오지 않는다. 예: 원본 보기 → */
                        actionLabel?: string;
                        /** @description 이 줄을 누르면 어느 종류의 화면으로 가는지를 아는 열쇠. 화면 id가 아니다 — 갈 곳은 명세가 이 열쇠로 정한다(itemAction.targets). 갈 곳이 없는 줄에는 오지 않는다. 예: tasks · meetings · documents · finance */
                        targetKind?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveRetro": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 묶음 이름. 예: 잘된 점 · 미흡했던 점 · 다음 행사 개선안 */
                        groupLabel: string;
                        /** @description 그 묶음의 줄들 */
                        rows: {
                            /** @description 이 줄을 가리키는 값. */
                            key: string;
                            /** @description 적힌 내용. 예: 부스별 담당자를 미리 2명씩 배치해 공백이 없었다 */
                            label: string;
                            /** @description 그 까닭. 원인까지 적는 묶음에만 온다. 예: 원인 · 업체 확정을 행사 3주 전에 시작했다 */
                            causeNote?: string;
                            /** @description 이 개선안을 맡을 부서. 맡는 곳이 정해진 줄에만 온다. 예: 홍보부 */
                            ownerLabel?: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveHandover": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 묶음 이름. 예: 재사용 자산 · 협력처·담당자 · 주의사항 */
                        groupLabel: string;
                        /** @description 그 묶음의 줄들 */
                        rows: {
                            /** @description 이 줄을 가리키는 값. */
                            key: string;
                            /** @description 줄의 앞부분. 이름만 있는 줄은 이것이 전부다. 예: 현수막 제작 · · 부스 배치도 (재사용 가능) */
                            label: string;
                            /** @description 줄의 뒷부분. 이름과 값이 갈리는 줄에만 온다. 예: 한빛기획 · 031-000-0000 */
                            value?: string;
                            /** @description 그 줄의 색 이름. 눈에 띄어야 하는 줄에만 온다 — 주의사항이 그 자리다. 예: orange */
                            tone?: string;
                        }[];
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveAutoFilled": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 개요를 한 줄로 줄인 것. 예: 2025 신입생 환영회 · 2025. 03. 14 · 담당 홍길동 · 책임자 홍길동 · 210명 참석 (신청 240명) */
                        overview: string;
                        /** @description 성과를 한 줄로 줄인 것. 예: 210명 참석 (신청 240명) · 예산 집행 95% · 완료 업무 9건 */
                        outcome: string;
                        /** @description 타임라인을 한 줄로 줄인 것. 예: 행사 2025. 03. 14 → 완료 처리 2025. 03. 28 · 참석자 210명 · 참여 설문 완료 */
                        timeline: string;
                        /** @description 근거 자료를 한 줄로 줄인 것. 이어진 데이터가 없으면 그 사실까지 서버가 적는다. 예: 완료 업무 9건 · 회의·문서·구매 연결 데이터 없음 */
                        evidence: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveDraft": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 현장 운영에 적어 둔 글. 아직 안 썼으면 빈 채로 온다. */
                        onSiteOperation?: string;
                        /** @description 회고 · 잘된 점에 적어 둔 글. */
                        retroGood?: string;
                        /** @description 회고 · 미흡했던 점과 원인에 적어 둔 글. */
                        retroIssues?: string;
                        /** @description 회고 · 다음 행사 개선안에 적어 둔 글. */
                        retroImprovements?: string;
                        /** @description 개선안을 맡을 부서로 고른 값. org.departments의 값과 같다. */
                        improvementDepartment?: string;
                        /** @description 인수인계에 적어 둔 글. AI 초안을 만들면 이 자리가 채워진다. */
                        handover?: string;
                        /** @description 다음 담당자로 적어 둔 글. */
                        nextOwner?: string;
                        /** @description 검토자로 고른 사람. record.archiveReviewers의 값과 같다. */
                        reviewer?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveGate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 채운 조건이 몇 개인지. 세는 말까지 서버가 만든다. 예: 0 / 6 */
                        metCountNote: string;
                        /** @description 넘길 수 없을 때 그 까닭. 비어 있으면 열린다. */
                        blockedNote?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveGateConditions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 이 조건을 가리키는 값. */
                        key: string;
                        /** @description 무엇을 채워야 하는지. 예: 회고 · 미흡했던 점과 원인 */
                        label: string;
                        /** @description 채워졌는가 */
                        met: string;
                        /** @description 그 표시의 색 이름. 예: orange · green */
                        tone: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "record.archiveReview": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 검토자가 적은 의견. 아직 검토되지 않았으면 오지 않는다. */
                        comment?: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "org.invitedOrganization": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 초대 링크가 실어 온 코드. 어느 학생회의 초대인지를 이것이 정한다 */
                inviteCode: string;
            };
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
                        /** @description 학생회 이름. 예: 제12대 소프트웨어융합대학 학생회 */
                        name: string;
                        /** @description 어떤 학생회인지. 예: 단과대 학생회 */
                        kind: string;
                        /** @description 대표하는 범위. 예: 한양대학교 ERICA · 소프트웨어융합대학 */
                        scope: string;
                        /** @description 운영 연도. 예: 2026년 */
                        term: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "survey.applyForm": {
        parameters: {
            query: {
                /** @description 설문 링크가 실어 온 토큰. 어느 설문인지를 이것이 정한다 */
                surveyToken: string;
            };
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
                        /** @description 행사 이름. 예: 2026 소프트웨어융합대학 체육대회 */
                        title: string;
                        /** @description 행사 일시. 완성된 문구로 온다. 예: 2026-08-20 10:00 */
                        startAt: string;
                        /** @description 장소. 예: ERICA 체육관 */
                        place: string;
                        /** @description 참가 대상. 예: 소프트웨어융합대학 전체 */
                        audience: string;
                        /** @description 참가비. 조건까지 문장으로 온다 — 무엇이 무료인지 화면이 유도할 수 없다(event.basics.fee와 같은 사실이고, EVT-02B가 납부자·미납자 금액을 따로 받아 이 한 줄로 이어진다). 예: 납부자 무료 / 미납자 5000원 */
                        fee: string;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "survey.applyResult": {
        parameters: {
            query: {
                /** @description 보내고 받은 영수증. **사람마다 다르다** — 같은 QR로 온 다른 사람의 결과를 열 수 없게 하는 것이 이 값이다 */
                receiptToken: string;
            };
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
                        /** @description 신청이 어떻게 됐는지 알리는 제목. 운영진이 설문마다 적는다 */
                        title: string;
                        /** @description 어느 행사의 신청인지 */
                        eventTitle: string;
                        /** @description 누가 냈는지. **라벨까지 품은 완성된 한 줄이다** — 그림이 한 덩이로 그렸고, 신청자를 무엇이라 부를지는 조직의 말이다. 예: 신청자: 김바다 */
                        applicantNote: string;
                        /** @description 참가비가 지금 어떤 상태인지. **금액일 수도 상태일 수도 있다** — 학생회비 조건부 행사는 대조가 끝나야 금액이 정해진다. 예: 관리자 확인 중 · 5,000원 */
                        feeStatus: string;
                        /** @description 그 아래 붙는 보조문. 금액이 이미 정해진 행사에는 오지 않는다 */
                        feeNote?: string;
                        /** @description 안내 사항. **몇 줄인지는 데이터가 정한다** — 문의처를 적지 않은 행사는 한 줄이다. 화면은 이 배열을 itemList의 itemsField로 받는다. */
                        notices: {
                            /** @description 한 줄. 앞머리 기호까지 붙어서 온다 */
                            text: string;
                        }[];
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "survey.linkState": {
        parameters: {
            query: {
                /** @description 설문 링크가 실어 온 토큰. 어느 설문인지를 이것이 정한다 */
                surveyToken: string;
            };
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
                        /** @description 왜 막혔는지의 이름. 예: 모집 전 · 정원 마감 · 링크 비활성화 */
                        label: string;
                        /** @description 그 카드의 색 이름. 알림의 세기가 상태마다 다르다 — 아직 안 열린 것은 무채색이고 정원이 찬 것은 주황이다 */
                        tone: string;
                        /** @description 그 상태를 풀어 쓴 한 줄 */
                        note: string;
                        /** @description 갈 곳이 있을 때 그 단추의 글. **갈 곳이 없는 상태에는 오지 않는다** — 다섯 중 넷은 응답자가 갈 데가 없다 */
                        actionLabel?: string;
                        /** @description 이 설문을 대신하는 새 설문의 토큰. 교체된 설문에만 온다. **화면이 이 값을 지어낼 수 없다** — 옛 토큰과 새 토큰을 잇는 것은 서버뿐이다(OPS-MEET-09의 replacementMeetingId와 같은 자리) */
                        replacementToken?: string;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "attendance.checkInForm": {
        parameters: {
            query: {
                /** @description QR이 실어 온 토큰. 어느 행사의 출석인지를 이것이 정한다 */
                checkInToken: string;
            };
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
                        /** @description 어느 행사의 참석 확인인지. 예: 2026 소프트웨어융합대학 체육대회 */
                        eventName: string;
                        /** @description 지금 체크인을 받는지 알리는 말. **명세가 목록을 들지 않는다.** 예: 체크인 가능 */
                        statusLabel: string;
                        /** @description 그 딱지의 색 이름(design/tones.ts의 톤) */
                        statusTone: string;
                        /** @description 체크인을 받는 시간대. 완성된 글로 온다 — 때의 표기는 조직의 것이다. 예: 09:30 ~ 11:00 */
                        checkInWindow: string;
                        /** @description 무엇을 어떻게 적어야 하는지 알리는 완성된 글 */
                        guideNote: string;
                        /** @description 지금 받을 수 없을 때 그 까닭의 이름. 예: 비활성화된 QR */
                        blockedLabel?: string;
                        /** @description 그 까닭 카드의 색 이름 */
                        blockedTone?: string;
                        /** @description 그 까닭을 풀어 쓴 글. **이 조각이 오면 이름·학번 칸을 그리지 않는다.** 무엇이 막는 조건인지는 조직과 QR의 사정이라 화면이 셀 수 없다 */
                        blockedNote?: string;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "attendance.checkInResult": {
        parameters: {
            query: {
                /** @description 보내고 받은 영수증. **사람마다 다르다** — 같은 QR로 온 다른 사람의 결과를 열 수 없게 하는 것이 이 값이다 */
                receiptToken: string;
            };
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
                        /** @description 결과의 이름. 예: 참석 완료 */
                        label: string;
                        /** @description 그 결과의 색 이름(design/tones.ts의 톤). 예: green */
                        tone: string;
                        /** @description 그 결과를 나타내는 그림의 이름(check · circle-alert · info · x · clock). **톤만으로는 갈리지 않는다** — '체크인 시간 전·후'와 '비활성화된 QR'이 둘 다 회색인데 시계와 X로 다르다. 지금 명세에 이 조각을 가리킬 자리가 없어(제안: summary.iconField) 화면이 직접 읽는다 */
                        iconName: string;
                        /** @description 결과를 풀어 쓴 글. 때·까닭·시간대가 이미 찍혀서 온다. 예: 2026. 08. 20 09:47 체크인되었습니다. */
                        description: string;
                        /** @description 이 결과에서 이름·학번을 **다시 낼 수 있는가**(참·거짓). 판정은 서버가 한다 — 명세가 '명단 불일치일 때만'이라고 적으면 그 규칙이 명세에 박히고, 규칙이 바뀔 때마다 명세를 고쳐야 한다. 지금은 이름이 명단과 다를 때만 참이다(사람이 정한 것: docs/decisions/product-decisions.md). 참석이 이미 끝났거나 QR이 꺼진 결과에서는 다시 내도 같은 답이 온다. */
                        canRetry: boolean;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "auth.ways": {
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
                        /** @description 구글로 들어오는 길이 열려 있는가 */
                        google: boolean;
                        /** @description 카카오로 들어오는 길이 열려 있는가 */
                        kakao: boolean;
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
    "org.memberToRemove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 누구를 내보내는가 */
                memberId: string;
            };
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
                        /** @description 확인 화면이 묻는 말. '김바다 님을 내보낼까요?'처럼 이름이 든 완성된 글이다. */
                        question: string;
                        /** @description 그 사람의 이름. 되돌아간 화면이 무엇을 했는지 알릴 때 쓴다. */
                        name: string;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "my.profile": {
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
                        /** @description 이름. 로그인한 계정에서 온다. 예: 김바다 */
                        name: string;
                        /** @description 학번. 아직 안 적었으면 빈 글이다. 예: 2022123456 */
                        studentNumber: string;
                        /** @description 학생회의 대표 학교 이름. 고르는 값이 아니라 보여 주는 글이다. 예: 한양대학교 ERICA */
                        schoolName: string;
                        /** @description 단과대학의 값. 예: COL-HYU-ERICA-SW */
                        college: string;
                        /** @description 그 단과대학의 이름표. **서버가 완성된 글을 준다** — 화면이 코드를 그리지 않는다. 예: 소프트웨어융합대학 */
                        collegeName: string;
                        /** @description 학부·학과의 값. 예: DEP-HYU-ERICA-SW-CS */
                        department: string;
                        /** @description 그 학부·학과의 이름표. 예: ICT융합학부 */
                        departmentName: string;
                        /** @description 현재 학년의 값. education.currentGrades의 값. 예: 3 */
                        currentGrade: string;
                        /** @description 그 학년의 이름표. 예: 3학년 */
                        currentGradeName: string;
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
    "my.saveProfile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 이름 */
                    name?: string;
                    /** @description 학번 */
                    studentNumber: string;
                    /** @description 학교 */
                    schoolName?: string;
                    /** @description 단과대학 */
                    college: string;
                    /** @description 학부·학과 */
                    department: string;
                    /** @description 현재 학년 */
                    currentGrade: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "my.belonging": {
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
                        /** @description 소속 학생회 이름. 예: 제12대 소프트웨어융합대학 학생회 */
                        orgName: string;
                        /** @description 학생회 안에서의 소속 부서. 배정 전이면 그 사실이 온다. 예: 회장단 */
                        orgDepartment: string;
                        /** @description 직책. 없으면 역할의 이름이 온다. 예: 회장 */
                        executiveTitle: string;
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
    "education.schools.options": {
        parameters: {
            query?: {
                /** @description 검색어. 2자 이상 */
                q?: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "education.colleges.options": {
        parameters: {
            query: {
                /** @description 어느 학교의 단과대학인가 */
                schoolId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "education.departments.options": {
        parameters: {
            query: {
                /** @description 어느 학교인가 */
                schoolId: string;
                /** @description 어느 단과대학의 학부·학과인가 */
                collegeId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "event.participantAffiliations.options": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "event.participantApplyStatus.options": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "event.participantPayStatus.options": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "event.participantAttendStatus.options": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "finance.budgetItems.options": {
        parameters: {
            query: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "org.duesTerms.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "event.linkable.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "org.departments.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "meeting.agendaPicker.options": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffLeaderCandidates.options": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffDeptLeaderCandidates.options": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 어느 부서인가 */
                departmentId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.staffMemberCandidates.options": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
                /** @description 어느 부서인가 */
                departmentId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "finance.ledgerMonths.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "finance.ledgerEvents.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "finance.orgBudgetItems.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "record.archiveReviewers.options": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "survey.colleges.options": {
        parameters: {
            query: {
                /** @description 설문 링크가 실어 온 토큰. 어느 설문인지를 이것이 정한다 */
                surveyToken: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
                    }[];
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
    "survey.departments.options": {
        parameters: {
            query: {
                /** @description 설문 링크가 실어 온 토큰. 어느 설문인지를 이것이 정한다 */
                surveyToken: string;
                /** @description 어느 단과대학의 학부·학과인가 */
                collegeId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
                    }[];
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
    "finance.budgetEvents.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "my.colleges.options": {
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "my.departments.options": {
        parameters: {
            query: {
                /** @description 어느 단과대학의 학부·학과인가 */
                collegeId: string;
            };
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
                        /** @description 고른 값 */
                        value: string;
                        /** @description 그려지는 글 */
                        label: string;
                        /** @description 곁에 붙는 설명(선택) */
                        description?: string;
                        /** @description 고를 수 없는가(선택) */
                        disabled?: boolean;
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
    "org.create": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 학생회 유형 */
                    orgType: string;
                    /** @description 학교 */
                    repSchool: string;
                    /** @description 단과대학 */
                    repCollege: string;
                    /** @description 학생회명 */
                    orgName: string;
                    /** @description 운영 연도 */
                    operatingYear: string;
                    /** @description setupMode */
                    setupMode: string;
                    /** @description 부서 */
                    departments?: {
                        /** @description 부서 */
                        name: string;
                    }[];
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.purchaseRequest.submit": {
        parameters: {
            query: {
                /** @description 어느 행사의 구매 요청인가 */
                eventId: string;
            };
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 요청 제목 */
                    title: string;
                    /** @description 요청 부서 */
                    department?: string;
                    /** @description 필요한 날짜 */
                    neededOn: string;
                    /** @description 우선순위 */
                    priority?: string;
                    /** @description 구매 목적 */
                    purpose: string;
                    /** @description 품목 리스트 */
                    items?: {
                        /** @description 품목명 */
                        itemName: string;
                        /** @description 품목 카테고리 */
                        itemCategory: string;
                        /** @description 예산 항목 */
                        budgetItem: string;
                        /** @description 구매 유형 */
                        purchaseType: string;
                        /** @description 수량 */
                        quantity: number;
                        /** @description 단위 */
                        unit: string;
                        /** @description 예상 단가 */
                        unitPrice: number;
                        /** @description 판매처 또는 쇼핑몰 */
                        vendor?: string;
                        /** @description 상품 URL */
                        productUrl?: string;
                        /** @description 상품 옵션 또는 규격 */
                        option?: string;
                        /** @description 배송 요청사항 */
                        deliveryNote?: string;
                        /** @description 견적서 확보 상태 */
                        quoteStatus?: string;
                    }[];
                    /** @description 품목명 */
                    itemName: string;
                    /** @description 품목 카테고리 */
                    itemCategory: string;
                    /** @description 예산 항목 */
                    budgetItem: string;
                    /** @description 구매 유형 */
                    purchaseType: string;
                    /** @description 수량 */
                    quantity: number;
                    /** @description 단위 */
                    unit: string;
                    /** @description 예상 단가 */
                    unitPrice: number;
                    /** @description 판매처 또는 쇼핑몰 */
                    vendor?: string;
                    /** @description 상품 URL */
                    productUrl?: string;
                    /** @description 상품 옵션 또는 규격 */
                    option?: string;
                    /** @description 배송 요청사항 */
                    deliveryNote?: string;
                    /** @description 견적서 확보 상태 */
                    quoteStatus?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.purchaseRequest.saveDraft": {
        parameters: {
            query: {
                /** @description 어느 행사의 구매 요청인가 */
                eventId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 요청 제목 */
                    title: string;
                    /** @description 요청 부서 */
                    department?: string;
                    /** @description 필요한 날짜 */
                    neededOn: string;
                    /** @description 우선순위 */
                    priority?: string;
                    /** @description 구매 목적 */
                    purpose: string;
                    /** @description 품목 리스트 */
                    items?: {
                        /** @description 품목명 */
                        itemName: string;
                        /** @description 품목 카테고리 */
                        itemCategory: string;
                        /** @description 예산 항목 */
                        budgetItem: string;
                        /** @description 구매 유형 */
                        purchaseType: string;
                        /** @description 수량 */
                        quantity: number;
                        /** @description 단위 */
                        unit: string;
                        /** @description 예상 단가 */
                        unitPrice: number;
                        /** @description 판매처 또는 쇼핑몰 */
                        vendor?: string;
                        /** @description 상품 URL */
                        productUrl?: string;
                        /** @description 상품 옵션 또는 규격 */
                        option?: string;
                        /** @description 배송 요청사항 */
                        deliveryNote?: string;
                        /** @description 견적서 확보 상태 */
                        quoteStatus?: string;
                    }[];
                    /** @description 품목명 */
                    itemName: string;
                    /** @description 품목 카테고리 */
                    itemCategory: string;
                    /** @description 예산 항목 */
                    budgetItem: string;
                    /** @description 구매 유형 */
                    purchaseType: string;
                    /** @description 수량 */
                    quantity: number;
                    /** @description 단위 */
                    unit: string;
                    /** @description 예상 단가 */
                    unitPrice: number;
                    /** @description 판매처 또는 쇼핑몰 */
                    vendor?: string;
                    /** @description 상품 URL */
                    productUrl?: string;
                    /** @description 상품 옵션 또는 규격 */
                    option?: string;
                    /** @description 배송 요청사항 */
                    deliveryNote?: string;
                    /** @description 견적서 확보 상태 */
                    quoteStatus?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.purchaseRequest.resubmitSupplement": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.purchaseRequest.saveSupplement": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "finance.purchaseRequest.completeEvidence": {
        parameters: {
            query: {
                /** @description 어느 구매 요청인가 */
                requestId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "org.saveChart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 이름 검색 */
                    memberQuery?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "org.regenerateInviteLink": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
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
                    "application/json": Record<string, never>;
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
    "org.regenerateInviteCode": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
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
                    "application/json": Record<string, never>;
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
    "org.changeRole": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 누구의 역할을 바꾸는가 */
                memberId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 기본 역할 변경 */
                    baseRole: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "org.removeMember": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 누구를 내보내는가 */
                memberId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.saveDraft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description meetingType */
                    meetingType: string;
                    /** @description 연결 행사 */
                    linkedEventId: string;
                    /** @description 회의명 */
                    title: string;
                    /** @description 주최자 */
                    hostName?: string;
                    /** @description 주관 부서 */
                    departmentId: string;
                    /** @description 회의 상태 */
                    statusLabel?: string;
                    /** @description 회의 목적 */
                    purpose: string;
                    /** @description 회의 날짜 */
                    date: string;
                    /** @description 시작 예정 시각 */
                    startTime: string;
                    /** @description 종료 예정 시각 */
                    endTime: string;
                    /** @description 진행 방식 */
                    mode: string;
                    /** @description 장소 */
                    place: string;
                    /** @description 온라인 링크 */
                    onlineLink?: string;
                    /** @description 비공개 회의 */
                    isPrivate?: boolean;
                    /** @description 이름 또는 부서로 구성원 검색 */
                    memberQuery?: string;
                    /** @description 참가자 */
                    participants?: {
                        /** @description 참가자 */
                        memberId: string;
                    }[];
                    /** @description 안건 */
                    agendaItems?: {
                        /** @description 안건명 */
                        agendaTitle: string;
                        /** @description 안건 설명 */
                        agendaNote?: string;
                        /** @description 사전 자료 */
                        attachmentName?: string;
                        /** @description 예상 소요 시간 */
                        duration?: string;
                    }[];
                    /** @description 안건명 */
                    agendaTitle: string;
                    /** @description 안건 설명 */
                    agendaNote?: string;
                    /** @description 사전 자료 */
                    attachmentName?: string;
                    /** @description 예상 소요 시간 */
                    duration?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "meeting.start": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.end": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.cancel": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 취소 사유 */
                    cancelReason: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "meeting.grantHostRole": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
                /** @description 누구에게 주는가 */
                memberId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.revokeHostRole": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
                /** @description 어느 구성원인가 */
                memberId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.completeAgenda": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.startNextAgenda": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.generateSummary": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "meeting.completeMinutes": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "meeting.acknowledgeSummary": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 회의인가 */
                meetingId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.saveBasics": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 행사명 */
                    title?: string;
                    /** @description 행사 소개 */
                    intro?: string;
                    /** @description 행사 목적·주요 내용 */
                    purpose?: string;
                    /** @description 시작 일시 */
                    startAt?: string;
                    /** @description 종료 일시 */
                    endAt?: string;
                    /** @description 종료 시간 미정 */
                    endUnset?: boolean;
                    /** @description 장소 */
                    place?: string;
                    /** @description 장소 미정 */
                    placeUnset?: boolean;
                    /** @description 주소 */
                    address?: string;
                    /** @description 상세 위치·집합 장소 */
                    placeDetail?: string;
                    /** @description 참가 대상 */
                    audience?: string;
                    /** @description 참가비 */
                    feeType?: string;
                    /** @description 납부자 금액 (0원 가능) */
                    paidAmount?: number;
                    /** @description 미납자 금액 */
                    unpaidAmount?: number;
                    /** @description 결제 안내 */
                    payGuide?: string;
                    /** @description 행사 정원 */
                    capacityType?: string;
                    /** @description 정원 인원 */
                    capacity?: number;
                    /** @description 담당 부서 */
                    hostDepartment?: string;
                    /** @description 담당자 */
                    hostPerson?: string;
                    /** @description 문의 방법·연락처 */
                    contact?: string;
                    /** @description 참가자 유의사항 */
                    notice?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "event.staff.save": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 행사 책임자 */
                    leaderId: string;
                    /** @description 부서 추가 */
                    newDepartmentName?: string;
                    /** @description 부서장 */
                    departmentLeaderId?: string;
                    /** @description 구성원 추가 */
                    departmentMemberId?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "event.staff.setup": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description setupMode */
                    setupMode: string;
                    /** @description 행사 책임자 */
                    leaderId: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "event.attendanceQr.regenerate": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.attendanceQr.deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "event.survey.activate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
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
    "event.survey.replace": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 새 설문 초안 생성 방식 */
                    replaceMode?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "record.archive.saveDraft": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 현장 운영 */
                    onSiteOperation?: string;
                    /** @description 잘된 점 */
                    retroGood?: string;
                    /** @description 미흡했던 점과 원인 */
                    retroIssues?: string;
                    /** @description 다음 행사 개선안 */
                    retroImprovements?: string;
                    /** @description 담당 부서 */
                    improvementDepartment?: string;
                    /** @description 인수인계 */
                    handover?: string;
                    /** @description 다음 담당자 */
                    nextOwner?: string;
                    /** @description 검토자 */
                    reviewer?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "record.archive.requestReview": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 현장 운영 */
                    onSiteOperation?: string;
                    /** @description 잘된 점 */
                    retroGood?: string;
                    /** @description 미흡했던 점과 원인 */
                    retroIssues?: string;
                    /** @description 다음 행사 개선안 */
                    retroImprovements?: string;
                    /** @description 담당 부서 */
                    improvementDepartment?: string;
                    /** @description 인수인계 */
                    handover?: string;
                    /** @description 다음 담당자 */
                    nextOwner?: string;
                    /** @description 검토자 */
                    reviewer?: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "record.archive.generateHandoverDraft": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 어느 행사인가 */
                eventId: string;
            };
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
                    "application/json": Record<string, never>;
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
            /** @description 가리킨 것이 없다 */
            404: {
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
    "organization.verifyInviteCode": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 초대 코드 */
                    inviteCode: string;
                    /** @description 학교 */
                    school: string;
                    /** @description 단과대학 */
                    college: string;
                    /** @description 학부·학과 */
                    department: string;
                    /** @description 현재 학년 */
                    currentGrade: string;
                    /** @description 학번 */
                    studentNumber: string;
                    /** @description 이름 */
                    name: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "org.join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 초대 코드 */
                    inviteCode: string;
                    /** @description 학교 */
                    school: string;
                    /** @description 단과대학 */
                    college: string;
                    /** @description 학부·학과 */
                    department: string;
                    /** @description 현재 학년 */
                    currentGrade: string;
                    /** @description 학번 */
                    studentNumber: string;
                    /** @description 이름 */
                    name: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
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
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
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
    "survey.apply": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path: {
                /** @description 설문 링크가 실어 온 토큰. 어느 설문인지를 이것이 정한다 */
                surveyToken: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 이름 */
                    name: string;
                    /** @description 학번 */
                    studentNumber: string;
                    /** @description 단과대학 */
                    college: string;
                    /** @description 학부·학과 */
                    department: string;
                    /** @description 학년 */
                    currentGrade: string;
                    /** @description 참가 동기 (선택) */
                    motivation?: string;
                    /** @description 동의합니다 */
                    privacyConsent: boolean;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description **이 사람의 이 신청 하나**를 가리키는 값. 결과 화면이 이것으로 조회한다.
                         *
                         *     설문의 토큰으로는 안 된다 — 같은 링크를 여러 사람이 연다(attendance.checkIn의 receiptToken과 같은 까닭).
                         */
                        receiptToken: string;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "attendance.checkIn": {
        parameters: {
            query?: never;
            header: {
                /** @description 보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다. */
                "Idempotency-Key": string;
            };
            path: {
                /** @description QR이 실어 온 토큰. 어느 행사의 출석인지를 이것이 정한다 */
                checkInToken: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 이름 */
                    name: string;
                    /** @description 학번 */
                    studentNumber: string;
                };
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description **이 사람의 이 확인 하나**를 가리키는 값. 결과 화면이 이것으로 조회한다.
                         *
                         *     QR의 토큰으로는 안 된다 — **같은 QR을 여러 사람이 찍는다.** 그것으로 결과를 조회하면 "이 QR로 낸 마지막 결과"가 오고, 뒤에 찍은 사람이 앞사람의 이름과 결과를 본다. 앞사람의 결과는 덮인다.
                         *
                         *     추측할 수 없어야 하고(높은 엔트로피), 한 번 쓴 뒤 오래 살아 있지 않아야 한다. 저장할 때는 해시로 둔다 — 그대로 두면 로그나 백업에서 새면 그 사람의 결과가 열린다.
                         */
                        receiptToken: string;
                    };
                };
            };
            /** @description 가리킨 것이 없다 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 보낸 값이 받을 수 없는 것이다 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
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
    "auth.signOut": {
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
                    "application/json": Record<string, never>;
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
