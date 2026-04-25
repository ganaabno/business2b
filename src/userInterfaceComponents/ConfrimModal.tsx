import { useState } from "react";
import { ConfirmModal as NewConfirmModal } from "../components/Modal";

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleConfirm = () => {
    onConfirm();
    setIsOpen(false);
  };

  const handleCancel = () => {
    onCancel();
    setIsOpen(false);
  };

  return (
    <NewConfirmModal
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Confirm Action"
      description={message}
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      variant="danger"
    />
  );
}
