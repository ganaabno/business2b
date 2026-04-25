import type { B2BSeatRequestRow } from "../../../api/b2b";

type Translator = (key: string, options?: Record<string, unknown>) => string;

type SeatAccessGatePanelProps = {
  t: Translator;
  strictSeatRequestCanRegister: boolean;
  strictBundleHealth: "healthy" | "payment_due" | "blocked";
  strictBundleHealthLabel: string;
  strictSelectedSeatRequestId: string;
  onSelectSeatRequest: (value: string) => void;
  strictGateLoading: boolean;
  strictEligibilityLoading: boolean;
  registerSeatRequestOptions: B2BSeatRequestRow[];
  onRefresh: () => void;
  strictSelectedMetaText: string;
  strictSelectedSeatUsedSeats: number;
  strictRequestedSeats: number;
  hasSelectedSeatRequest: boolean;
  strictGateError: string | null;
  strictBlockReasonText: string | null;
  strictBlockingSeatRequestId: string | null;
  strictNextDeadlineText: string | null;
  strictRegisterLocked: boolean;
  onOpenRequests: () => void;
  onOpenBlockingPaymentPlan: (requestId: string) => void;
};

export default function SeatAccessGatePanel({
  t,
  strictSeatRequestCanRegister,
  strictBundleHealth,
  strictBundleHealthLabel,
  strictSelectedSeatRequestId,
  onSelectSeatRequest,
  strictGateLoading,
  strictEligibilityLoading,
  registerSeatRequestOptions,
  onRefresh,
  strictSelectedMetaText,
  strictSelectedSeatUsedSeats,
  strictRequestedSeats,
  hasSelectedSeatRequest,
  strictGateError,
  strictBlockReasonText,
  strictBlockingSeatRequestId,
  strictNextDeadlineText,
  strictRegisterLocked,
  onOpenRequests,
  onOpenBlockingPaymentPlan,
}: SeatAccessGatePanelProps) {
  const gateState: "ready" | "payment_due" | "blocked" = strictSeatRequestCanRegister
    ? "ready"
    : strictBundleHealth === "blocked"
      ? "blocked"
      : "payment_due";

  const healthBadgeClass =
    strictBundleHealth === "healthy"
      ? "border-green-300 bg-green-50 text-green-700"
      : strictBundleHealth === "blocked"
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-amber-300 bg-amber-50 text-amber-700";

  const gateCardClass =
    gateState === "ready"
      ? "border-green-300 bg-green-50 text-green-800"
      : gateState === "blocked"
        ? "border-red-300 bg-red-50 text-red-800"
        : "border-amber-300 bg-amber-50 text-amber-800";

  return (
    <div id="register-gate-section" className="mono-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="mono-title text-base">{t("seatAccessGateTitle")}</h3>
          <p className="mt-1 text-xs text-gray-600">{t("seatAccessGateSelectLabel")}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${healthBadgeClass}`}
        >
          {strictBundleHealthLabel}
        </span>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-xs ${gateCardClass}`}>
        <p className="font-semibold">
          {gateState === "ready"
            ? t("seatAccessGateSubtitleOpen")
            : t("seatAccessGateSubtitleLocked")}
        </p>
        {strictBlockReasonText && !strictSeatRequestCanRegister && (
          <p className="mt-1">{strictBlockReasonText}</p>
        )}
        {!strictSeatRequestCanRegister && !strictBlockReasonText && (
          <p className="mt-1">{t("seatAccessGateRequiredPayment")}</p>
        )}
        {strictNextDeadlineText && <p className="mt-1">{strictNextDeadlineText}</p>}
      </div>

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("seatAccessGateSelectLabel")}
          </label>
          <select
            className="mono-input"
            value={strictSelectedSeatRequestId}
            onChange={(event) => onSelectSeatRequest(event.target.value)}
            disabled={strictGateLoading || registerSeatRequestOptions.length === 0}
          >
            <option value="">{t("seatAccessGateSelectPlaceholder")}</option>
            {registerSeatRequestOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.request_no} | {row.destination} | {row.travel_date} | {row.status}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="mono-button mono-button--ghost"
          onClick={onRefresh}
          disabled={strictGateLoading}
        >
          {t("seatAccessGateRefresh")}
        </button>
      </div>

      {(strictGateLoading || strictEligibilityLoading) && (
        <p className="text-xs text-gray-500">{t("seatAccessGateLoading")}</p>
      )}

      {!strictGateLoading &&
        !strictEligibilityLoading &&
        registerSeatRequestOptions.length === 0 && (
          <p className="text-xs text-amber-700">{t("seatAccessGateNoRequests")}</p>
        )}

      {hasSelectedSeatRequest && (
        <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <p>{strictSelectedMetaText}</p>
          <p>
            {t("seatAccessGateSeatQuota", {
              used: strictSelectedSeatUsedSeats,
              total: strictRequestedSeats,
            })}
          </p>
          {strictBlockingSeatRequestId && (
            <p>
              {t("seatAccessGateBlockingRequest", {
                requestId: strictBlockingSeatRequestId,
              })}
            </p>
          )}
        </div>
      )}

      {strictGateError && <p className="text-xs text-red-600">{strictGateError}</p>}

      {strictRegisterLocked && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="mono-button"
            onClick={onOpenRequests}
          >
            {t("goToYourRequests")}
          </button>
          {strictBlockingSeatRequestId && (
            <button
              type="button"
              className="mono-button mono-button--ghost"
              onClick={() => onOpenBlockingPaymentPlan(strictBlockingSeatRequestId)}
            >
              {t("seatAccessGateOpenBlockingPaymentPlan")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
