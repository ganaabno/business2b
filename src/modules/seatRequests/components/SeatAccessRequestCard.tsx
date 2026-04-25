import type { Dispatch, SetStateAction } from "react";

export type SeatAccessRequestCardRole = "subcontractor" | "agent";

export type SeatAccessRequestFormState = {
  fromDate: string;
  toDate: string;
  destination: string;
  plannedSeats: string;
  note: string;
};

type DestinationOptionsSource =
  | "exact"
  | "current_window"
  | "broad"
  | "global_api"
  | "none";

type SeatAccessRequestCardProps = {
  tr: (english: string, mongolian: string) => string;
  accessForm: SeatAccessRequestFormState;
  setAccessForm: Dispatch<SetStateAction<SeatAccessRequestFormState>>;
  isAdminWorkspaceSubmitter: boolean;
  adminRequestedRole: SeatAccessRequestCardRole;
  setAdminRequestedRole: (role: SeatAccessRequestCardRole) => void;
  effectiveDestinationOptions: string[];
  destinationOptionsSource: DestinationOptionsSource;
  accessSubmitting: boolean;
  canSubmitAccessRequest: boolean;
  inlineError?: string | null;
  onSubmitAccessRequest: () => void;
};

export default function SeatAccessRequestCard({
  tr,
  accessForm,
  setAccessForm,
  isAdminWorkspaceSubmitter,
  adminRequestedRole,
  setAdminRequestedRole,
  effectiveDestinationOptions,
  destinationOptionsSource,
  accessSubmitting,
  canSubmitAccessRequest,
  inlineError,
  onSubmitAccessRequest,
}: SeatAccessRequestCardProps) {
  const destinationHint =
    effectiveDestinationOptions.length === 0
      ? {
          className: "text-xs text-amber-700",
          text: tr(
            "No matching destination found right now. You can still type destination manually.",
            "Одоогоор таарах чиглэл олдсонгүй. Чиглэлээ гараар оруулж болно.",
          ),
        }
      : destinationOptionsSource === "exact"
        ? {
            className: "text-xs text-gray-500",
            text: tr(
              "Choose the exact destination from the list to avoid mismatch.",
              "Зөрүү гарахаас сэргийлж жагсаалтаас яг тохирох чиглэлээ сонгоно уу.",
            ),
          }
        : {
            className: "text-xs text-amber-700",
            text: tr(
              "Showing closest available destinations. Pick one that matches your request intent.",
              "Ойролцоо боломжтой чиглэлүүдийг харуулж байна. Хүсэлттэйгээ хамгийн тохирохыг сонгоно уу.",
            ),
          };

  return (
    <div
      id="seat-access-request-section"
      className="mono-card p-4 sm:p-5 space-y-4"
    >
      <div className="space-y-1">
        <h3 className="font-semibold">
          {tr(
            "1) Request access",
            "1) Access хүсэлт илгээх",
          )}
        </h3>
        <p className="text-xs text-gray-500">
          {tr(
            "Fill required fields first. You can add an optional note if needed.",
            "Эхлээд шаардлагатай талбаруудаа бөглөнө үү. Хүсвэл нэмэлт тайлбар оруулж болно.",
          )}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {tr("Required", "Шаардлагатай")}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">
              {tr("From date", "Эхлэх огноо")}
            </span>
            <input
              className="mono-input"
              type="date"
              value={accessForm.fromDate}
              onChange={(e) =>
                setAccessForm((prev) => ({
                  ...prev,
                  fromDate: e.target.value,
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-600">
              {tr("To date", "Дуусах огноо")}
            </span>
            <input
              className="mono-input"
              type="date"
              value={accessForm.toDate}
              onChange={(e) =>
                setAccessForm((prev) => ({
                  ...prev,
                  toDate: e.target.value,
                }))
              }
            />
          </label>

          {isAdminWorkspaceSubmitter && (
            <>
              <select
                className="mono-input md:col-span-2"
                value={adminRequestedRole}
                onChange={(e) =>
                  setAdminRequestedRole(e.target.value as SeatAccessRequestCardRole)
                }
              >
                <option value="subcontractor">
                  {tr("Submit as SubContractor", "Туслан гүйцэтгэгчээр илгээх")}
                </option>
                <option value="agent">
                  {tr("Submit as Agent", "Агентаар илгээх")}
                </option>
              </select>
              <p className="text-xs text-blue-700 md:col-span-2">
                {tr(
                  "Testing mode: request is saved with the selected requester role.",
                  "Тест горим: хүсэлт сонгосон requester role-оор хадгалагдана.",
                )}
              </p>
            </>
          )}

          {effectiveDestinationOptions.length > 0 ? (
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-gray-600">
                {tr("Destination", "Чиглэл")}
              </span>
              <select
                className="mono-input"
                value={accessForm.destination}
                onChange={(e) =>
                  setAccessForm((prev) => ({
                    ...prev,
                    destination: e.target.value,
                  }))
                }
              >
                <option value="">
                  {tr(
                    "Select destination",
                    "Чиглэл сонгох",
                  )}
                </option>
                {effectiveDestinationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-gray-600">
                {tr("Destination", "Чиглэл")}
              </span>
              <input
                className="mono-input"
                type="text"
                minLength={2}
                maxLength={120}
                placeholder={tr(
                  "Type destination manually",
                  "Чиглэлээ гараар оруулна уу",
                )}
                value={accessForm.destination}
                onChange={(e) =>
                  setAccessForm((prev) => ({
                    ...prev,
                    destination: e.target.value,
                  }))
                }
              />
            </label>
          )}

          <p className={`${destinationHint.className} md:col-span-2`}>
            {destinationHint.text}
          </p>

          <label className="space-y-1 md:max-w-xs">
            <span className="text-xs font-medium text-gray-600">
              {tr("Planned seats", "Төлөвлөсөн суудал")}
            </span>
            <input
              className="mono-input"
              type="number"
              min={1}
              placeholder={tr("Planned seats", "Төлөвлөсөн суудал")}
              value={accessForm.plannedSeats}
              onChange={(e) =>
                setAccessForm((prev) => ({
                  ...prev,
                  plannedSeats: e.target.value,
                }))
              }
            />
          </label>
        </div>
      </div>

      <details className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
          {tr("Optional note to reviewer", "Хянагчид өгөх нэмэлт тайлбар")}
        </summary>
        <div className="mt-3">
          <textarea
            className="mono-input"
            placeholder={tr(
              "Optional message to manager/admin",
              "Менежер/админд илгээх нэмэлт тайлбар (заавал биш)",
            )}
            rows={3}
            value={accessForm.note}
            onChange={(e) =>
              setAccessForm((prev) => ({ ...prev, note: e.target.value }))
            }
          />
        </div>
      </details>

      {inlineError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {inlineError}
        </div>
      )}

      <button
        className="mono-button w-full sm:w-auto"
        onClick={onSubmitAccessRequest}
        disabled={accessSubmitting || !canSubmitAccessRequest}
      >
        {accessSubmitting
          ? tr("Submitting...", "Илгээж байна...")
          : tr("Send request for approval", "Батлуулах хүсэлт илгээх")}
      </button>
    </div>
  );
}
