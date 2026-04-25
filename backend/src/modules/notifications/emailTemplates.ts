export type EmailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

type OptionalText = string | null | undefined;

function normalizeText(value: OptionalText) {
  return String(value || "").trim();
}

function escapeHtml(value: OptionalText) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value: OptionalText) {
  const text = normalizeText(value);
  if (!text) {
    return "N/A";
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatReason(reason: OptionalText) {
  const text = normalizeText(reason);
  return text || "No additional reason was provided.";
}

function formatMilestoneLabel(code: OptionalText) {
  const normalized = normalizeText(code).toLowerCase();
  switch (normalized) {
    case "deposit_6h":
      return "Deposit (6-hour window)";
    case "reconfirm_100k_if_gt_30d":
      return "Reconfirmation payment";
    case "min_paid_30pct_at_21d":
      return "Minimum 30% at 21 days";
    case "min_paid_50pct_at_14d":
      return "Minimum 50% at 14 days";
    case "min_paid_100pct_at_10d":
      return "Full payment at 10 days";
    default:
      return normalizeText(code) || "Payment milestone";
  }
}

function buildFooter(appUrl: string | null) {
  const safeUrl = normalizeText(appUrl);
  if (!safeUrl) {
    return {
      text: "Please open the B2B portal to view full details.",
      html: "<p>Please open the B2B portal to view full details.</p>",
    };
  }

  const escapedUrl = escapeHtml(safeUrl);
  return {
    text: `Open portal: ${safeUrl}`,
    html: `<p><a href="${escapedUrl}">Open B2B portal</a></p>`,
  };
}

export function buildPendingUserApprovedEmail(params: {
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  return {
    subject: "Your signup request has been approved",
    text: [
      "Good news - your B2B signup request is now approved.",
      "You can sign in and continue from your workspace.",
      footer.text,
    ].join("\n\n"),
    html: [
      "<p>Good news - your B2B signup request is now approved.</p>",
      "<p>You can sign in and continue from your workspace.</p>",
      footer.html,
    ].join(""),
  };
}

export function buildPendingUserDeclinedEmail(params: {
  reason: string | null;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const reason = formatReason(params.reason);
  return {
    subject: "Your signup request was declined",
    text: [
      "Your B2B signup request was reviewed and declined.",
      `Reason: ${reason}`,
      footer.text,
    ].join("\n\n"),
    html: [
      "<p>Your B2B signup request was reviewed and declined.</p>",
      `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildSeatAccessApprovedEmail(params: {
  destination: string;
  fromDate: string;
  toDate: string;
  expiresAt: string | null;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const destination = normalizeText(params.destination) || "your selected destination";
  return {
    subject: `Seat access approved: ${destination}`,
    text: [
      `Your seat access request for ${destination} is approved.`,
      `Approved range: ${params.fromDate} to ${params.toDate}`,
      `Approval expires at: ${formatDateTime(params.expiresAt)}`,
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>Your seat access request for <strong>${escapeHtml(destination)}</strong> is approved.</p>`,
      `<p>Approved range: ${escapeHtml(params.fromDate)} to ${escapeHtml(params.toDate)}</p>`,
      `<p>Approval expires at: ${escapeHtml(formatDateTime(params.expiresAt))}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildSeatAccessRejectedEmail(params: {
  destination: string;
  reason: string | null;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const destination = normalizeText(params.destination) || "your selected destination";
  const reason = formatReason(params.reason);
  return {
    subject: `Seat access rejected: ${destination}`,
    text: [
      `Your seat access request for ${destination} was rejected.`,
      `Reason: ${reason}`,
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>Your seat access request for <strong>${escapeHtml(destination)}</strong> was rejected.</p>`,
      `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildSeatRequestApprovedEmail(params: {
  requestNo: string;
  destination: string;
  travelDate: string;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const requestNo = normalizeText(params.requestNo) || "(unknown request)";
  return {
    subject: `Seat request approved: ${requestNo}`,
    text: [
      `Your seat request ${requestNo} has been approved.`,
      `Destination: ${params.destination}`,
      `Travel date: ${params.travelDate}`,
      "Please check your dashboard for payment milestones.",
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>Your seat request <strong>${escapeHtml(requestNo)}</strong> has been approved.</p>`,
      `<p>Destination: ${escapeHtml(params.destination)}</p>`,
      `<p>Travel date: ${escapeHtml(params.travelDate)}</p>`,
      "<p>Please check your dashboard for payment milestones.</p>",
      footer.html,
    ].join(""),
  };
}

export function buildSeatRequestRejectedEmail(params: {
  requestNo: string;
  reason: string | null;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const requestNo = normalizeText(params.requestNo) || "(unknown request)";
  const reason = formatReason(params.reason);
  return {
    subject: `Seat request rejected: ${requestNo}`,
    text: [
      `Your seat request ${requestNo} was rejected.`,
      `Reason: ${reason}`,
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>Your seat request <strong>${escapeHtml(requestNo)}</strong> was rejected.</p>`,
      `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildSeatRequestCancelledEmail(params: {
  requestNo: string;
  status: "cancelled_by_admin" | "cancelled_by_requester" | "cancelled_expired";
  reason: string | null;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const requestNo = normalizeText(params.requestNo) || "(unknown request)";
  const reason = formatReason(params.reason);

  const titleByStatus: Record<string, string> = {
    cancelled_by_admin: "cancelled by admin",
    cancelled_by_requester: "cancelled",
    cancelled_expired: "cancelled (payment deadline expired)",
  };

  const statusLabel = titleByStatus[params.status] || "cancelled";

  return {
    subject: `Seat request ${statusLabel}: ${requestNo}`,
    text: [
      `Your seat request ${requestNo} was ${statusLabel}.`,
      `Reason: ${reason}`,
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>Your seat request <strong>${escapeHtml(requestNo)}</strong> was ${escapeHtml(statusLabel)}.</p>`,
      `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildPaymentDueSoonEmail(params: {
  requestNo: string;
  destination: string;
  travelDate: string;
  milestoneCode: string;
  dueAt: string;
  leadLabel: string;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  const requestNo = normalizeText(params.requestNo) || "(unknown request)";
  const milestoneLabel = formatMilestoneLabel(params.milestoneCode);

  return {
    subject: `Payment due soon: ${requestNo}`,
    text: [
      `A payment milestone is due soon for seat request ${requestNo}.`,
      `Reminder window: ${params.leadLabel}`,
      `Milestone: ${milestoneLabel}`,
      `Due at: ${formatDateTime(params.dueAt)}`,
      `Destination: ${params.destination}`,
      `Travel date: ${params.travelDate}`,
      footer.text,
    ].join("\n\n"),
    html: [
      `<p>A payment milestone is due soon for seat request <strong>${escapeHtml(requestNo)}</strong>.</p>`,
      `<p>Reminder window: ${escapeHtml(params.leadLabel)}</p>`,
      `<p>Milestone: ${escapeHtml(milestoneLabel)}</p>`,
      `<p>Due at: ${escapeHtml(formatDateTime(params.dueAt))}</p>`,
      `<p>Destination: ${escapeHtml(params.destination)}</p>`,
      `<p>Travel date: ${escapeHtml(params.travelDate)}</p>`,
      footer.html,
    ].join(""),
  };
}

export function buildAdminTestEmail(params: {
  requestedByUserId: string;
  generatedAtIso: string;
  appUrl: string | null;
}): EmailTemplateContent {
  const footer = buildFooter(params.appUrl);
  return {
    subject: "B2B notification test email",
    text: [
      "This is a test email from the B2B admin interface.",
      `Requested by user id: ${normalizeText(params.requestedByUserId) || "unknown"}`,
      `Generated at: ${formatDateTime(params.generatedAtIso)}`,
      footer.text,
    ].join("\n\n"),
    html: [
      "<p>This is a test email from the B2B admin interface.</p>",
      `<p><strong>Requested by user id:</strong> ${escapeHtml(params.requestedByUserId)}</p>`,
      `<p><strong>Generated at:</strong> ${escapeHtml(formatDateTime(params.generatedAtIso))}</p>`,
      footer.html,
    ].join(""),
  };
}
