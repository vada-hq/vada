import { Select as BaseSelect } from "@base-ui/react/select";

import { cn } from "../../lib/cn";
import { useFormFieldControl } from "./form-field";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  "aria-label"?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string | null;
}

export function Select({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  disabled,
  name,
  onValueChange,
  options,
  placeholder,
  required,
  value,
}: SelectProps) {
  const field = useFormFieldControl();

  return (
    <BaseSelect.Root
      defaultValue={defaultValue}
      disabled={disabled}
      items={options}
      name={name}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange?.(nextValue);
        }
      }}
      required={required ?? field?.required}
      value={value}
    >
      <BaseSelect.Trigger
        // 폼 필드 밖에서 쓰면 이름 붙일 자리가 없다. 표 안의 선택처럼
        // 레이블 없이 서는 자리가 있어 받아 넘긴다.
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid}
        className={cn(
          "flex w-full items-center justify-between rounded-sm border border-input bg-card px-snug py-tight text-left text-body-lg text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-danger/20",
          className,
        )}
        id={field?.controlId}
      >
        <BaseSelect.Value placeholder={placeholder} />
        <BaseSelect.Icon
          aria-hidden="true"
          className="ml-2 text-muted-foreground"
        >
          ▾
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        {/*
          z-index는 위치가 잡힌 요소에만 먹는다. 팝업 자체는 static이라 여기에
          붙여야 한다. 안쪽에 붙였더니 무시됐고, 그 결과 팝업 대화상자(z-50)
          안에서 목록이 대화상자 뒤로 깔렸다 — 열리기는 하는데 클릭이 안 됐다.
          대화상자보다 위여야 하므로 한 단 높인다.
        */}
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          className="z-60"
          sideOffset={4}
        >
          <BaseSelect.Popup className="min-w-[var(--anchor-width)] rounded-sm border border-border bg-popover p-1 text-body-lg text-popover-foreground shadow-md outline-none">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item
                  className="grid w-full min-h-9 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 whitespace-nowrap rounded-sm px-2 text-sm outline-none data-highlighted:bg-muted data-highlighted:text-foreground"
                  key={option.value}
                  value={option.value}
                >
                  <BaseSelect.ItemIndicator aria-hidden="true">
                    ✓
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
