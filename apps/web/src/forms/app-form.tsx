import {
  createFormHook,
  createFormHookContexts,
} from "@tanstack/react-form";
import type { ComponentProps, FormEvent } from "react";

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {},
  fieldContext,
  formComponents: {},
  formContext,
});

export function createFormSubmitHandler(
  handleSubmit: () => void | Promise<unknown>,
) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nativeEvent = event.nativeEvent as Event & { isComposing?: boolean };
    if (nativeEvent.isComposing) {
      return;
    }

    void handleSubmit();
  };
}

export interface AppFormProps
  extends Omit<ComponentProps<"form">, "noValidate" | "onSubmit"> {
  onSubmit: () => void | Promise<unknown>;
}

export function AppForm({ onSubmit, ...props }: AppFormProps) {
  return (
    <form
      noValidate
      onSubmit={createFormSubmitHandler(onSubmit)}
      {...props}
    />
  );
}
