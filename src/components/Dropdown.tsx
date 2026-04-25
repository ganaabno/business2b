import { useState, useRef, useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  label,
  id,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--mono-text-muted)] mb-1.5"
        >
          {label}
        </label>
      )}
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            ref={triggerRef}
            id={id}
            disabled={disabled}
            className="mono-select flex items-center justify-between w-full text-left"
            aria-label={label || placeholder}
          >
            <span className={selectedOption ? "text-[var(--mono-text)]" : "text-[var(--mono-text-soft)]"}>
              {selectedOption?.label || placeholder}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[var(--mono-text-muted)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[180px] z-50 mt-1.5 rounded-lg border border-[var(--mono-border)] bg-[var(--mono-surface)] p-1 shadow-[var(--mono-shadow-md)] animate-fadeIn"
            sideOffset={4}
            align="start"
          >
            {options.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                disabled={option.disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!option.disabled) {
                    onChange(option.value);
                    setOpen(false);
                  }
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none transition-colors ${
                  option.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-[var(--mono-surface-muted)] focus:bg-[var(--mono-surface-muted)]"
                } ${
                  value === option.value
                    ? "text-[var(--mono-accent)] font-medium"
                    : "text-[var(--mono-text)]"
                }`}
              >
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="flex-1">{option.label}</span>
                {value === option.value && <Check className="w-4 h-4" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export interface ActionDropdownProps {
  trigger: ReactNode;
  options: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "danger";
  }[];
  align?: "start" | "center" | "end";
}

export function ActionDropdown({ trigger, options, align = "end" }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] z-50 rounded-lg border border-[var(--mono-border)] bg-[var(--mono-surface)] p-1 shadow-[var(--mono-shadow-md)] animate-fadeIn"
          sideOffset={4}
          align={align}
        >
          {options.map((option, index) => (
            <DropdownMenu.Item
              key={index}
              disabled={option.disabled}
              onSelect={(event) => {
                event.preventDefault();
                if (!option.disabled) {
                  option.onClick();
                  setOpen(false);
                }
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none transition-colors ${
                option.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-[var(--mono-surface-muted)] focus:bg-[var(--mono-surface-muted)]"
              } ${
                option.variant === "danger"
                  ? "text-red-600 hover:bg-red-50 focus:bg-red-50"
                  : "text-[var(--mono-text)]"
              }`}
            >
              {option.icon && <span className="shrink-0 w-4 h-4">{option.icon}</span>}
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
