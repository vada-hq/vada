import { useState, type FormEvent } from "react";

import {
  REVIEW_CONTEXT,
  REVIEW_REQUEST,
  REVIEW_SCENARIOS,
  createReviewState,
  transitionReviewState,
} from "./du001-review-model.mjs";
import "./du001-review.css";

type ReviewState = {
  scenarioId: string;
  view: string;
  status: string;
};

const formatWon = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;

function StatusNotice({ status }: { status: string }) {
  const notices: Record<string, { tone: string; title: string; description: string }> = {
    "draft-restored": {
      tone: "info",
      title: "서버 초안을 불러왔습니다",
      description: "같은 계정에 저장된 개인 초안입니다. 다른 구성원과 재정부 검토 목록에는 보이지 않습니다.",
    },
    "draft-saved": {
      tone: "success",
      title: "서버에 임시 저장했습니다",
      description: "저장 완료 시각 2026. 8. 3. 오후 7:00 · 제출 전까지 본인만 확인할 수 있습니다.",
    },
    "validation-error": {
      tone: "danger",
      title: "제출하지 못했습니다",
      description: "행사 음향 운영 품목의 가격 근거가 필요합니다. 입력 내용은 그대로 유지했습니다.",
    },
    "server-unavailable": {
      tone: "danger",
      title: "서버에 저장하지 못했습니다",
      description: "완료된 것으로 처리하지 않았습니다. 입력 내용을 유지했으니 잠시 뒤 다시 시도해 주세요.",
    },
    reloaded: {
      tone: "success",
      title: "서버에서 다시 확인했습니다",
      description: "새로 조회한 기록에도 행사명, 실제 요청자, 두 품목과 총액이 동일합니다.",
    },
  };
  const notice = notices[status];
  if (!notice) return null;
  const isError = notice.tone === "danger";
  return (
    <div className={`du-review__notice du-review__notice--${notice.tone}`} role={isError ? "alert" : "status"}>
      <strong>{notice.title}</strong>
      <span>{notice.description}</span>
    </div>
  );
}

function ContextStrip() {
  return (
    <dl className="du-review__context" aria-label="서버에서 확인한 작성 맥락">
      <div><dt>행사</dt><dd>{REVIEW_CONTEXT.eventName}</dd></div>
      <div><dt>요청자</dt><dd>{REVIEW_CONTEXT.requesterName}</dd></div>
      <div><dt>요청 부서</dt><dd>{REVIEW_CONTEXT.departmentName}</dd></div>
    </dl>
  );
}

function EditorView({ state, dispatch }: { state: ReviewState; dispatch: (action: string) => void }) {
  const missingEvidence = state.scenarioId === "validation-error";
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent & { isComposing?: boolean };
    if (nativeEvent.isComposing) return;
    dispatch("submit");
  };

  return (
    <section className="du-review__surface" aria-labelledby="editor-title">
      <div className="du-review__surface-heading">
        <div>
          <p className="du-review__eyebrow">행사 재정 · 새 구매 요청</p>
          <h1 id="editor-title">구매 요청 작성</h1>
          <p>필요한 물품과 용역을 한 요청으로 묶어 재정부에 제출합니다.</p>
        </div>
        <span className="du-review__scope-chip">검토용 화면</span>
      </div>

      <StatusNotice status={state.status} />
      <ContextStrip />

      <form key={state.scenarioId} className="du-review__form" onSubmit={handleSubmit}>
        <div className="du-review__form-main">
          <section className="du-review__panel" aria-labelledby="request-info-title">
            <div className="du-review__panel-heading">
              <div><span>01</span><h2 id="request-info-title">기본 요청 정보</h2></div>
              <p>표시된 항목은 제출할 때 필수입니다.</p>
            </div>
            <div className="du-review__field-grid">
              <label className="du-review__field du-review__field--wide">
                <span>요청 제목</span>
                <input defaultValue={REVIEW_REQUEST.title} required />
              </label>
              <label className="du-review__field">
                <span>필요한 날짜</span>
                <input type="date" defaultValue={REVIEW_REQUEST.neededDate} required />
              </label>
              <label className="du-review__field">
                <span>우선순위</span>
                <select defaultValue={REVIEW_REQUEST.priority}>
                  <option value="normal">보통</option>
                  <option value="urgent">긴급</option>
                </select>
              </label>
              <label className="du-review__field du-review__field--wide">
                <span>구매 목적</span>
                <textarea defaultValue={REVIEW_REQUEST.purpose} rows={3} required />
              </label>
            </div>
          </section>

          <section className="du-review__panel" aria-labelledby="items-title">
            <div className="du-review__panel-heading">
              <div><span>02</span><h2 id="items-title">구매 품목</h2></div>
              <button className="du-review__button du-review__button--secondary" type="button">품목 추가</button>
            </div>
            <div className="du-review__items">
              {REVIEW_REQUEST.items.map((item, index) => {
                const invalid = missingEvidence && index === 1 && state.status === "validation-error";
                const evidenceId = `item-${index}-evidence`;
                const errorId = `${evidenceId}-error`;
                return (
                  <article className="du-review__item" key={item.itemId}>
                    <div className="du-review__item-heading">
                      <div><span>품목 {index + 1}</span><h3>{item.name}</h3></div>
                      <button type="button" aria-label={`${item.name} 삭제`}>삭제</button>
                    </div>
                    <div className="du-review__item-grid">
                      <label className="du-review__field"><span>품목명</span><input defaultValue={item.name} /></label>
                      <label className="du-review__field"><span>구매 유형</span><input defaultValue={item.purchaseType === "general" ? "일반 구매" : "용역"} readOnly /></label>
                      <label className="du-review__field"><span>수량</span><input type="number" defaultValue={item.quantity} min="1" /></label>
                      <label className="du-review__field"><span>예상 단가</span><input type="number" defaultValue={item.estimatedUnitPrice} min="1" /></label>
                      <label className="du-review__field du-review__field--wide">
                        <span>가격 근거</span>
                        <input
                          id={evidenceId}
                          defaultValue={missingEvidence && index === 1 ? "" : item.evidence}
                          aria-invalid={invalid || undefined}
                          aria-describedby={invalid ? errorId : undefined}
                        />
                        {invalid && <small id={errorId}>업체 견적 파일 또는 견적 메모를 입력해 주세요.</small>}
                      </label>
                    </div>
                    <p className="du-review__item-total">예상 금액 <strong>{formatWon(item.estimatedAmount)}</strong></p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="du-review__summary" aria-label="요청 요약">
          <p className="du-review__eyebrow">요청 요약</p>
          <h2>{formatWon(REVIEW_REQUEST.estimatedTotal)}</h2>
          <dl>
            <div><dt>품목</dt><dd>{REVIEW_REQUEST.items.length}개</dd></div>
            <div><dt>처리 상태</dt><dd>제출 전</dd></div>
          </dl>
          <button className="du-review__button du-review__button--primary" type="submit">구매 요청 제출</button>
          <button className="du-review__button du-review__button--secondary" type="button" onClick={() => dispatch("save-draft")}>임시 저장</button>
          <button className="du-review__button du-review__button--text" type="button">안전하게 나가기</button>
          <p className="du-review__summary-note">이 프로토타입은 실제 서버에 저장하지 않습니다.</p>
        </aside>
      </form>
    </section>
  );
}

function ListView({ dispatch }: { dispatch: (action: string) => void }) {
  return (
    <section className="du-review__surface" aria-labelledby="list-title">
      <div className="du-review__surface-heading">
        <div><p className="du-review__eyebrow">{REVIEW_CONTEXT.eventName}</p><h1 id="list-title">내 구매 요청</h1><p>내가 제출한 요청을 최신순으로 확인합니다.</p></div>
        <button className="du-review__button du-review__button--secondary" type="button" onClick={() => dispatch("back-to-editor")}>새 요청 작성</button>
      </div>
      <div className="du-review__notice du-review__notice--success" role="status"><strong>구매 요청을 제출했습니다</strong><span>검토 대기 상태로 저장됐습니다.</span></div>
      <div className="du-review__list" role="list">
        <button className="du-review__request-row du-review__request-row--new" type="button" role="listitem" onClick={() => dispatch("open-detail")}>
          <span className="du-review__request-main"><small>방금 제출</small><strong>{REVIEW_REQUEST.title}</strong><span>요청번호 {REVIEW_REQUEST.requestId}</span></span>
          <span className="du-review__status-chip">검토 대기</span>
          <strong>{formatWon(REVIEW_REQUEST.estimatedTotal)}</strong>
          <span className="du-review__row-action">상세 보기</span>
        </button>
        <div className="du-review__request-row" role="listitem">
          <span className="du-review__request-main"><small>2026. 8. 2.</small><strong>여름 행사 준비 물품</strong><span>요청번호 request-000</span></span>
          <span className="du-review__status-chip">검토 대기</span>
          <strong>100,000원</strong>
          <span className="du-review__warning-chip">예산 초과</span>
        </div>
      </div>
    </section>
  );
}

function DetailView({ state, dispatch }: { state: ReviewState; dispatch: (action: string) => void }) {
  return (
    <section className="du-review__surface" aria-labelledby="detail-title">
      <div className="du-review__surface-heading">
        <div><p className="du-review__eyebrow">{REVIEW_CONTEXT.eventName} · 요청 상세</p><h1 id="detail-title">{REVIEW_REQUEST.title}</h1><p>서버에 저장된 요청과 모든 품목을 다시 조회했습니다.</p></div>
        <span className="du-review__status-chip">검토 대기</span>
      </div>
      <StatusNotice status={state.status} />
      <div className="du-review__detail-actions">
        <button className="du-review__button du-review__button--secondary" type="button" onClick={() => dispatch("back-to-list")}>목록으로</button>
        <button className="du-review__button du-review__button--secondary" type="button" onClick={() => dispatch("refresh-detail")}>서버에서 다시 확인</button>
      </div>
      <ContextStrip />
      <div className="du-review__detail-grid">
        <section className="du-review__panel">
          <div className="du-review__panel-heading"><div><span>01</span><h2>요청 내용</h2></div></div>
          <dl className="du-review__facts">
            <div><dt>필요한 날짜</dt><dd>2026. 9. 15.</dd></div>
            <div><dt>우선순위</dt><dd>긴급</dd></div>
            <div className="du-review__facts-wide"><dt>구매 목적</dt><dd>{REVIEW_REQUEST.purpose}</dd></div>
          </dl>
        </section>
        <aside className="du-review__detail-total"><span>서버 계산 총액</span><strong>{formatWon(REVIEW_REQUEST.estimatedTotal)}</strong><small>두 품목 합계</small></aside>
      </div>
      <section className="du-review__panel">
        <div className="du-review__panel-heading"><div><span>02</span><h2>품목 {REVIEW_REQUEST.items.length}개</h2></div></div>
        <div className="du-review__detail-items">
          {REVIEW_REQUEST.items.map((item) => (
            <article key={item.itemId}><div><span>{item.purchaseType === "general" ? "일반 구매" : "용역"}</span><h3>{item.name}</h3><p>{item.quantity}{item.unit} × {formatWon(item.estimatedUnitPrice)}</p></div><strong>{formatWon(item.estimatedAmount)}</strong></article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ForbiddenView() {
  return (
    <section className="du-review__surface du-review__forbidden" aria-labelledby="forbidden-title">
      <span aria-hidden="true">403</span>
      <h1 id="forbidden-title">구매 요청을 작성할 권한이 없습니다</h1>
      <p>작성 폼이나 다른 사용자의 관계 정보는 표시하지 않습니다. 행사 재정으로 안전하게 돌아가 주세요.</p>
      <button className="du-review__button du-review__button--primary" type="button">행사 재정으로 돌아가기</button>
    </section>
  );
}

export default function Du001Review() {
  const requestedScenario = new URLSearchParams(window.location.search).get("scenario");
  const initialScenario = REVIEW_SCENARIOS.some(({ id }) => id === requestedScenario) ? requestedScenario! : "happy-path";
  const [state, setState] = useState<ReviewState>(() => createReviewState(initialScenario));
  const selectedScenario = REVIEW_SCENARIOS.find(({ id }) => id === state.scenarioId)!;

  const selectScenario = (scenarioId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", scenarioId);
    window.history.replaceState(null, "", url);
    setState(createReviewState(scenarioId));
  };
  const dispatch = (action: string) => setState((current) => transitionReviewState(current, action));

  return (
    <div className="du-review">
      <header className="du-review__header">
        <a href="/" className="du-review__brand" aria-label="VADA 와이어프레임 홈"><span>V</span><strong>VADA</strong></a>
        <div><strong>DU-001 화면 검토</strong><span>실제 저장 없는 인터랙션 프로토타입</span></div>
        <a className="du-review__exit" href="/">기존 와이어프레임으로</a>
      </header>
      <div className="du-review__layout">
        <aside className="du-review__scenario-rail" aria-labelledby="scenario-title">
          <p className="du-review__eyebrow">사람이 확인할 내용</p>
          <h2 id="scenario-title">검토할 상황</h2>
          <p>아래 다섯 상황에서 흐름과 안내가 자연스러운지만 확인합니다.</p>
          <nav aria-label="검토 시나리오">
            {REVIEW_SCENARIOS.map((scenario, index) => (
              <button
                className={scenario.id === state.scenarioId ? "is-active" : ""}
                key={scenario.id}
                type="button"
                aria-current={scenario.id === state.scenarioId ? "step" : undefined}
                onClick={() => selectScenario(scenario.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{scenario.label}</strong><small>{scenario.summary}</small></div>
              </button>
            ))}
          </nav>
          <div className="du-review__source-note"><strong>검토 기준</strong><span>FLOW-FIN-001@R2</span><span>CB-FIN-001@R2</span><span>화면 명세 R2 후보</span></div>
        </aside>
        <main className="du-review__main">
          <div className="du-review__scenario-summary"><span>현재 상황</span><strong>{selectedScenario.label}</strong><p>{selectedScenario.summary}</p></div>
          {state.view === "editor" && <EditorView state={state} dispatch={dispatch} />}
          {state.view === "list" && <ListView dispatch={dispatch} />}
          {state.view === "detail" && <DetailView state={state} dispatch={dispatch} />}
          {state.view === "forbidden" && <ForbiddenView />}
        </main>
      </div>
    </div>
  );
}
