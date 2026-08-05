import {
  createFormHook,
  createFormHookContexts,
} from "@tanstack/react-form";
import { useRef, type ComponentProps } from "react";

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {},
  fieldContext,
  formComponents: {},
  formContext,
});

export interface AppFormProps
  extends Omit<ComponentProps<"form">, "noValidate" | "onSubmit"> {
  onSubmit: () => void | Promise<unknown>;
}

export function AppForm({
  onCompositionEndCapture,
  onCompositionStartCapture,
  onKeyDownCapture,
  onSubmit,
  ...props
}: AppFormProps) {
  const isComposing = useRef(false);

  return (
    <form
      {...props}
      noValidate
      onCompositionEndCapture={(event) => {
        isComposing.current = false;
        onCompositionEndCapture?.(event);
      }}
      onCompositionStartCapture={(event) => {
        isComposing.current = true;
        onCompositionStartCapture?.(event);
      }}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Enter" &&
          (isComposing.current || event.nativeEvent.isComposing)
        ) {
          event.preventDefault();
        }

        onKeyDownCapture?.(event);
      }}
      onSubmit={(event) => {
        event.preventDefault();

        if (!isComposing.current) {
          void onSubmit();
        }
      }}
    />
  );
}
