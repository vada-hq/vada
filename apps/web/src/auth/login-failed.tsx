/**
 * 로그인을 세우지 못했을 때 그 자리에서 멈춘다.
 *
 * 화면을 그대로 그리지 않는 이유가 있다. 그리면 모든 요청이 401을 받고,
 * 사용자에게는 화면마다 "데이터가 없다"로만 보인다. 원인이 로그인이라는 것을
 * 아무 데서도 알 수 없다.
 *
 * 다시 시도할 길을 준다. 실패의 상당수는 되돌아오는 사이에 값이 사라진 것이라
 * 한 번 더 하면 지나간다.
 */
export function LoginFailed({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        로그인하지 못했습니다
      </h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div>
        <a
          className="inline-block rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          href="/"
        >
          다시 시도
        </a>
      </div>
    </main>
  );
}
