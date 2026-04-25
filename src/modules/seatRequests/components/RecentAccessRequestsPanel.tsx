import { ChevronDown } from "lucide-react";
import type {
  B2BSeatAccessRequestRow,
  B2BSeatRequestRow,
} from "../../../api/b2b";

type Props = {
  recentAccessRequests: B2BSeatAccessRequestRow[];
  recentlySubmittedAccessRequestId: string;
  expandedRecentAccessRequestId: string;
  requests: B2BSeatRequestRow[];
  isMongolianLanguage: boolean;
  tr: (english: string, mongolian: string) => string;
  onExpand: (accessRequestId: string) => void;
  onContinueRequest: (accessRequestId: string) => void;
  onOpenAccessHistory: () => void;
  onOpenPaymentPlan: (seatRequestId: string) => void;
  resolveAccessApprovalDeadline: (
    accessRequest: Pick<B2BSeatAccessRequestRow, "approved_at" | "expires_at">,
  ) => string | null;
  formatDateTime: (
    value: string | null | undefined,
    fallback?: string,
  ) => string;
  accessStatusClass: (status: B2BSeatAccessRequestRow["status"]) => string;
  accessStatusLabel: (
    status: B2BSeatAccessRequestRow["status"],
    useMongolian?: boolean,
  ) => string;
  toRoleLabel: (
    role: B2BSeatAccessRequestRow["requester_role"],
    useMongolian?: boolean,
  ) => string;
  requestStatusClass: (status: string) => string;
  requestStatusLabel: (
    request: B2BSeatRequestRow,
    useMongolian?: boolean,
  ) => string;
  paymentStateLabel: (state: string | null, useMongolian?: boolean) => string;
};

export default function RecentAccessRequestsPanel({
  recentAccessRequests,
  recentlySubmittedAccessRequestId,
  expandedRecentAccessRequestId,
  requests,
  isMongolianLanguage,
  tr,
  onExpand,
  onContinueRequest,
  onOpenAccessHistory,
  onOpenPaymentPlan,
  resolveAccessApprovalDeadline,
  formatDateTime,
  accessStatusClass,
  accessStatusLabel,
  toRoleLabel,
  requestStatusClass,
  requestStatusLabel,
  paymentStateLabel,
}: Props) {
  return (
    <div className="mono-card p-4 sm:p-5">
      <h3 className="font-semibold mb-3">
        {tr("Recently Sent Requests", "Саяхан илгээсэн хүсэлтүүд")}
      </h3>
      {recentAccessRequests.length === 0 ? (
        <p className="text-sm text-gray-500">
          {tr("No requests sent yet.", "Одоогоор хүсэлт илгээгээгүй байна.")}
        </p>
      ) : (
        <div className="space-y-3">
          {recentAccessRequests.map((row) => {
            const isJustSent = row.id === recentlySubmittedAccessRequestId;
            const isExpanded = row.id === expandedRecentAccessRequestId;
            const linkedSeatRequest = row.seat_request_id
              ? requests.find((request) => request.id === row.seat_request_id) || null
              : null;
            const resolvedAccessExpiry = resolveAccessApprovalDeadline(row);
            const reviewedBy =
              String(row.reviewed_by_email || "").trim() ||
              String(row.reviewed_by || "").trim() ||
              tr("Not reviewed yet", "Одоогоор хянаагүй");

            return (
              <div
                key={row.id}
                className={`rounded-lg border p-3 text-sm transition-all duration-300 ${
                  isJustSent
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white"
                } ${isExpanded ? "shadow-sm" : ""}`}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  className="group w-full rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  onClick={() => onExpand(row.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.destination}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {isExpanded
                          ? tr("Details expanded", "Дэлгэрэнгүй нээгдсэн")
                          : tr("Show details", "Дэлгэрэнгүй харах")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${accessStatusClass(
                          row.status,
                        )}`}
                      >
                        {accessStatusLabel(row.status, isMongolianLanguage)}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </div>
                  </div>
                </button>
                <p className="text-xs text-gray-600 mt-1">
                  {row.from_date} - {row.to_date} |{" "}
                  {tr("Planned seats", "Төлөвлөсөн суудал")}: {row.planned_seats}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {tr("Sent", "Илгээсэн")}: {formatDateTime(row.created_at)}
                </p>
                {isJustSent && (
                  <p className="text-xs text-blue-700 mt-1 font-medium">
                    {tr("Just sent", "Дөнгөж илгээгдсэн")}
                  </p>
                )}
                <div
                  className={`mono-collapse mt-3 ${
                    isExpanded ? "mono-collapse--open" : ""
                  }`}
                >
                  <div className="mono-collapse__inner">
                    <div className="space-y-3 border-t border-gray-200 pt-3">
                      <div className="grid grid-cols-1 gap-2 text-xs text-gray-700 sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Access ID", "Access ID")}:
                          </span>{" "}
                          {row.id}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Role", "Үүрэг")}:
                          </span>{" "}
                          {toRoleLabel(row.requester_role, isMongolianLanguage)}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Reviewer", "Шалгасан")}:
                          </span>{" "}
                          {reviewedBy}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Reviewed at", "Шалгасан огноо")}:
                          </span>{" "}
                          {formatDateTime(
                            row.reviewed_at,
                            tr("Not reviewed yet", "Одоогоор хянаагүй"),
                          )}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Approved at", "Батлагдсан огноо")}:
                          </span>{" "}
                          {formatDateTime(
                            row.approved_at,
                            tr("Not approved", "Батлагдаагүй"),
                          )}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Approval expires", "Баталгаажуулалт дуусах")}:
                          </span>{" "}
                          {formatDateTime(resolvedAccessExpiry, tr("N/A", "Байхгүй"))}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Consumed at", "Ашиглагдсан огноо")}:
                          </span>{" "}
                          {formatDateTime(
                            row.consumed_at,
                            tr("Not consumed", "Ашиглагдаагүй"),
                          )}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Seat request ID", "Seat request ID")}:
                          </span>{" "}
                          {row.seat_request_id || tr("Not linked yet", "Холбогдоогүй")}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                        <p className="font-semibold text-gray-900">
                          {tr("Decision details", "Шийдвэрийн дэлгэрэнгүй")}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Reviewer note", "Шийдвэрийн тайлбар")}:
                          </span>{" "}
                          {row.decision_reason?.trim() || tr("No note", "Тайлбаргүй")}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900">
                            {tr("Your note", "Таны тайлбар")}:
                          </span>{" "}
                          {row.note?.trim() || tr("No note", "Тайлбаргүй")}
                        </p>
                      </div>

                      {row.seat_request_id && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1">
                          <p className="font-semibold text-gray-900">
                            {tr(
                              "Linked seat request status",
                              "Холбогдсон seat request төлөв",
                            )}
                          </p>
                          {linkedSeatRequest ? (
                            <>
                              <p className="text-gray-700">
                                <span className="font-medium text-gray-900">
                                  {tr("Request", "Хүсэлт")}:
                                </span>{" "}
                                {linkedSeatRequest.request_no}
                              </p>
                              <p className="text-gray-700">
                                <span className="font-medium text-gray-900">
                                  {tr("Travel date", "Аяллын огноо")}:
                                </span>{" "}
                                {linkedSeatRequest.travel_date}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${requestStatusClass(
                                    linkedSeatRequest.status,
                                  )}`}
                                >
                                  {requestStatusLabel(
                                    linkedSeatRequest,
                                    isMongolianLanguage,
                                  )}
                                </span>
                                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                  {tr("Payment", "Төлбөр")}: {" "}
                                  {paymentStateLabel(
                                    linkedSeatRequest.payment_state,
                                    isMongolianLanguage,
                                  )}
                                </span>
                              </div>
                            </>
                          ) : (
                            <p className="text-amber-700">
                              {tr(
                                "Linked seat request is not in the current history list yet. Try refresh.",
                                "Холбогдсон seat request одоогийн түүхэнд харагдахгүй байна. Шинэчилж үзнэ үү.",
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {row.status === "approved" && (
                          <button
                            type="button"
                            className="mono-button mono-button--ghost mono-button--sm"
                            onClick={() => onContinueRequest(row.id)}
                          >
                            {tr(
                              "Continue with this request",
                              "Энэ хүсэлтээр үргэлжлүүлэх",
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          className="mono-button mono-button--ghost mono-button--sm"
                          onClick={onOpenAccessHistory}
                        >
                          {tr(
                            "Open full access history",
                            "Access хүсэлтийн бүтэн түүх нээх",
                          )}
                        </button>
                        {row.seat_request_id && (
                          <button
                            type="button"
                            className="mono-button mono-button--sm"
                            onClick={() => onOpenPaymentPlan(String(row.seat_request_id || ""))}
                          >
                            {tr("Open payment plan", "Төлбөрийн төлөв нээх")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
