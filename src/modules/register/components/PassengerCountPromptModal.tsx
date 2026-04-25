type Translator = (key: string, options?: Record<string, unknown>) => string;

type PassengerCountPromptModalProps = {
  show: boolean;
  t: Translator;
  passengerCountInput: string;
  onPassengerCountChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function PassengerCountPromptModal({
  show,
  t,
  passengerCountInput,
  onPassengerCountChange,
  onCancel,
  onConfirm,
}: PassengerCountPromptModalProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="mono-card w-full max-w-md p-6">
        <h3 className="mono-title mb-4 text-lg">{t("addPassengers")}</h3>
        <div className="mb-4">
          <label htmlFor="passengerCount" className="block text-sm font-medium">
            {t("howManyPassengers")}
          </label>
          <input
            type="number"
            id="passengerCount"
            min="1"
            value={passengerCountInput}
            onChange={(e) => onPassengerCountChange(e.target.value)}
            className="mono-input mt-2"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="mono-button mono-button--ghost">
            {t("cancel")}
          </button>
          <button onClick={onConfirm} className="mono-button">
            {t("add")}
          </button>
        </div>
      </div>
    </div>
  );
}
