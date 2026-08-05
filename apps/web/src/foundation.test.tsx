import { http, HttpResponse } from "msw";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import App, { AppProviders, createAppRuntime } from "./App";
import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { FormField } from "./components/ui/form-field";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { StatusBadge } from "./components/ui/status-badge";
import {
  AppForm,
  useAppForm,
} from "./forms/app-form";
import { server } from "./mocks/server";

function QueryProbe() {
  const query = useQuery({
    queryKey: ["foundation-probe"],
    queryFn: async () => {
      const response = await fetch("http://localhost/__foundation");
      return z
        .object({ state: z.literal("ready") })
        .parse(await response.json());
    },
  });

  return <p>{query.data?.state ?? "loading"}</p>;
}

function FormProbe() {
  const [savedTitle, setSavedTitle] = useState("");
  const form = useAppForm({
    defaultValues: { title: "" },
    validators: {
      onSubmit: z.object({
        title: z.string().trim().min(1, "제목을 입력하세요."),
      }),
    },
    onSubmit: ({ value }) => setSavedTitle(value.title),
  });

  return (
    <>
      <AppForm onSubmit={() => form.handleSubmit()}>
        <form.Field name="title">
          {(field) => {
            const firstError = field.state.meta.errors[0];
            const error =
              typeof firstError === "string" ? firstError : firstError?.message;

            return (
              <FormField
                id="request-title"
                label="요청 제목"
                description="검토자가 알아볼 수 있는 제목을 입력하세요."
                error={error}
                required
              >
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </FormField>
            );
          }}
        </form.Field>
        <Button type="submit">저장</Button>
      </AppForm>
      <output aria-label="저장 결과">{savedTitle}</output>
    </>
  );
}

function ImeFormProbe({ onSubmit }: { onSubmit: () => void }) {
  return (
    <AppForm aria-label="요청 입력" onSubmit={onSubmit}>
      <Input aria-label="요청 제목" />
      <Button type="submit">저장</Button>
    </AppForm>
  );
}

describe("공통 애플리케이션 경계", () => {
  test("라우터가 애플리케이션 시작 화면을 렌더링한다", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "VADA" }),
    ).toBeInTheDocument();
  });

  test("Query 공급자와 MSW가 실제 네트워크 경계를 대체한다", async () => {
    server.use(
      http.get("http://localhost/__foundation", () =>
        HttpResponse.json({ state: "ready" }),
      ),
    );

    render(
      <AppProviders runtime={createAppRuntime()}>
        <QueryProbe />
      </AppProviders>,
    );

    expect(await screen.findByText("ready")).toBeInTheDocument();
  });
});

describe("공통 폼과 UI 기본 요소", () => {
  test("Zod 오류를 입력과 연결하고 유효한 값만 제출한다", async () => {
    const user = userEvent.setup();
    render(<FormProbe />);

    const input = screen.getByRole("textbox", { name: "요청 제목" });
    expect(input).toHaveAccessibleDescription(
      "검토자가 알아볼 수 있는 제목을 입력하세요.",
    );
    expect(input).toBeRequired();

    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("제목을 입력하세요.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.type(input, "체육대회 물품");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("status", { name: "저장 결과" })).toHaveTextContent(
      "체육대회 물품",
    );
  });

  test("한국어 조합 중 Enter는 막고 조합 종료 후 Enter는 제출한다", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<ImeFormProbe onSubmit={handleSubmit} />);

    const form = screen.getByRole("form", { name: "요청 입력" });
    const input = within(form).getByRole("textbox", { name: "요청 제목" });
    await user.click(input);

    fireEvent.compositionStart(input);
    await user.keyboard("{Enter}");
    expect(handleSubmit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    await user.keyboard("{Enter}");
    expect(handleSubmit).toHaveBeenCalledOnce();
  });

  test("버튼과 선택 입력을 키보드로 조작할 수 있다", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    const onValueChange = vi.fn();

    render(
      <>
        <Button onClick={onPress}>계속</Button>
        <FormField id="priority" label="우선순위">
          <Select
            placeholder="선택하세요"
            options={[
              { value: "normal", label: "보통" },
              { value: "urgent", label: "긴급" },
            ]}
            onValueChange={onValueChange}
          />
        </FormField>
      </>,
    );

    const button = screen.getByRole("button", { name: "계속" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledOnce();

    const select = screen.getByRole("combobox", { name: "우선순위" });
    await user.tab();
    expect(select).toHaveFocus();

    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("normal");
  });

  test("상태와 피드백 요소가 보조 기술에 의미를 전달한다", () => {
    render(
      <Card aria-label="요청 상태">
        <StatusBadge tone="success">제출 완료</StatusBadge>
        <Alert tone="danger" title="저장 실패">
          입력 내용을 유지한 채 다시 시도하세요.
        </Alert>
      </Card>,
    );

    expect(screen.getByLabelText("요청 상태")).toBeInTheDocument();
    expect(screen.getByText("제출 완료")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAccessibleName("저장 실패");
  });
});
