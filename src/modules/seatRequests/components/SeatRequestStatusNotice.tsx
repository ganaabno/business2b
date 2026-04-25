type SeatRequestStatusNoticeProps = {
  tr: (english: string, mongolian: string) => string;
  hasApprovedAccess: boolean;
  approvedAccessCount: number;
  showRejectedNotice: boolean;
  declineMessage: string;
  showAgentPoints: boolean;
  activeAgentPoints: number;
};

export default function SeatRequestStatusNotice({
  tr,
  hasApprovedAccess,
  approvedAccessCount,
  showRejectedNotice,
  declineMessage,
  showAgentPoints,
  activeAgentPoints,
}: SeatRequestStatusNoticeProps) {
  const statusTone = hasApprovedAccess
    ? "border-green-300 bg-green-50 text-green-800"
    : "border-amber-300 bg-amber-50 text-amber-800";

  const statusLabel = hasApprovedAccess
    ? tr("Ready", "Бэлэн")
    : tr("Pending approval", "Баталгаажуулалт хүлээгдэж байна");

  return (
    <div className="mono-card p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {tr("What to do now", "Одоо юу хийх вэ")}
        </p>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-xs ${statusTone}`}>
        {hasApprovedAccess
          ? tr(
              `You have ${approvedAccessCount} approved request${approvedAccessCount > 1 ? "s" : ""}. Open Step 2, pick one request, then confirm your tour and seats.`,
              `Танд ${approvedAccessCount} батлагдсан хүсэлт байна. 2-р алхам руу орж нэг хүсэлт сонгоод аялал, суудлаа баталгаажуулна уу.`,
            )
          : tr(
              "Send one access request first (date, destination, seats). After manager/admin approval, tour selection unlocks automatically.",
              "Эхлээд нэг access хүсэлт илгээнэ үү (огноо, чиглэл, суудал). Менежер/админ баталсны дараа аялал сонголт автоматаар нээгдэнэ.",
            )}
      </div>

      {showRejectedNotice && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">{tr("Latest decline", "Сүүлийн татгалзалт")}</p>
          <p className="mt-1">{declineMessage}</p>
        </div>
      )}

      {showAgentPoints && (
        <p className="text-sm text-gray-700">
          {tr(
            "Agent points: +10,000 per passenger in each confirmed seat request. Current points",
            "Агентын оноо: Баталгаажсан seat request бүрийн зорчигч тутамд +10,000. Одоогийн оноо",
          )}
          : {activeAgentPoints}
        </p>
      )}
    </div>
  );
}
