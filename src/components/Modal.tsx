import { useEffect, useRef, useCallback, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!closeOnEscape && e.key === "Escape") {
        e.preventDefault();
      }
    },
    [closeOnEscape],
  );

  useEffect(() => {
    if (closeOnEscape) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [closeOnEscape, handleKeyDown]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fadeIn"
          data-state={open ? "open" : "closed"}
        />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] ${sizeClasses[size]} max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--mono-border)] bg-[var(--mono-surface)] p-6 shadow-[var(--mono-shadow-lg)] focus:outline-none`}
          onPointerDownOutside={(e) => {
            if (!closeOnOverlayClick) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <Dialog.Title className="mono-title text-xl">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mono-subtitle mt-1 text-sm">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {showCloseButton && (
              <Dialog.Close asChild>
                <button
                  ref={closeButtonRef}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--mono-border)] bg-[var(--mono-surface)] text-[var(--mono-text-muted)] hover:bg-[var(--mono-surface-muted)] hover:text-[var(--mono-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--mono-ring)]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            )}
          </div>

          <div className="mt-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      showCloseButton={false}
    >
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="mono-button mono-button--ghost px-4 py-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`mono-button px-4 py-2 ${
              variant === "danger" ? "bg-red-600 border-red-600 hover:bg-red-700" : ""
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
