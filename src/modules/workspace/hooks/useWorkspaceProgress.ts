import { useMemo } from "react";

export type WorkspaceTabKey = "requests" | "register" | "bookings" | "history" | "chatbot";

export type WorkspaceProgressStatus =
  | "done"
  | "active"
  | "pending"
  | "locked";

export type WorkspaceProgressItem = {
  key: string;
  label: string;
  hint: string;
  status: WorkspaceProgressStatus;
};

export type WorkspaceNextAction = {
  title: string;
  description: string;
  ctaLabel: string;
  targetTab: WorkspaceTabKey;
  targetStep?: number;
  disabled?: boolean;
};

type UseWorkspaceProgressParams = {
  isMongolianLanguage: boolean;
  showSeatRequestsTab: boolean;
  workspaceTab: WorkspaceTabKey;
  activeStep: number;
  requestOnlyRegistrationMode: boolean;
  strictRegisterLocked: boolean;
  registerApprovedToursMissing: boolean;
  strictGateLoading: boolean;
  strictEligibilityLoading: boolean;
  seatRequestCount: number;
  approvedSeatRequestCount: number;
  bookingPassengersCount: number;
  submittedPassengersCount: number;
};

const tr = (useMongolianLanguage: boolean, english: string, mongolian: string) =>
  useMongolianLanguage ? mongolian : english;

export function useWorkspaceProgress(params: UseWorkspaceProgressParams) {
  const {
    isMongolianLanguage,
    showSeatRequestsTab,
    workspaceTab,
    activeStep,
    requestOnlyRegistrationMode,
    strictRegisterLocked,
    registerApprovedToursMissing,
    strictGateLoading,
    strictEligibilityLoading,
    seatRequestCount,
    approvedSeatRequestCount,
    bookingPassengersCount,
    submittedPassengersCount,
  } = params;

  return useMemo(() => {
    const hasRequests = seatRequestCount > 0;
    const hasApprovedRequests = approvedSeatRequestCount > 0;
    const hasRegisterDraft = bookingPassengersCount > 0;
    const hasSubmitted = submittedPassengersCount > 0;

    const requestStepStatus: WorkspaceProgressStatus = !showSeatRequestsTab
      ? "done"
      : hasApprovedRequests
        ? "done"
        : workspaceTab === "requests"
          ? "active"
          : hasRequests
            ? "pending"
            : "pending";

    const registerStepStatus: WorkspaceProgressStatus = requestOnlyRegistrationMode
      ? "locked"
      : strictRegisterLocked
        ? "locked"
        : activeStep > 1 || hasRegisterDraft
          ? "active"
          : hasSubmitted
            ? "done"
            : workspaceTab === "register"
              ? "active"
              : "pending";

    const bookingsStepStatus: WorkspaceProgressStatus =
      workspaceTab === "bookings"
        ? "active"
        : hasSubmitted
          ? "done"
          : "pending";

    const progressItems: WorkspaceProgressItem[] = showSeatRequestsTab
      ? [
          {
            key: "workflow",
            label: tr(
              isMongolianLanguage,
              "1. Guided Workflow",
              "1. Чиглүүлсэн урсгал",
            ),
            hint: tr(
              isMongolianLanguage,
              "Submit request → Select tour → Pay deposit → Register passenger",
              "Хүсэлт илгээх → Аялал сонгох → Төлбөр → Зорчигч бүртгэх",
            ),
            status: requestStepStatus,
          },
          {
            key: "history",
            label: tr(
              isMongolianLanguage,
              "2. History & Payments",
              "2. Түүх ба төлбөрүүд",
            ),
            hint: tr(
              isMongolianLanguage,
              "Request history, payment milestones, QPay invoice, transactions",
              "Хүсэлтийн түүх, төлбөрийн milestone, QPay invoice, төлөлт",
            ),
            status: bookingsStepStatus,
          },
          {
            key: "register",
            label: tr(
              isMongolianLanguage,
              "3. Register Passenger",
              "3. Зорчигч бүртгэх",
            ),
            hint: tr(
              isMongolianLanguage,
              "Tour selection → Add passenger details",
              "Аялал сонгоод зорчигчийн мэдээлэл оруулах",
            ),
            status: registerStepStatus,
          },
          {
            key: "bookings",
            label: tr(
              isMongolianLanguage,
              "4. Your Bookings",
              "4. Таны захиалгууд",
            ),
            hint: tr(
              isMongolianLanguage,
              "Submitted bookings → Download leads → Export excel",
              "Илгээсэн захиалга, lead, excel файл татах",
            ),
            status: bookingsStepStatus,
          },
        ]
      : [
          {
            key: "register",
            label: tr(
              isMongolianLanguage,
              "Register Passenger",
              "Зорчигч бүртгэх",
            ),
            hint: tr(
              isMongolianLanguage,
              "Select tour and register passengers",
              "Аялал сонгоод зорчигч бүртгэх",
            ),
            status: registerStepStatus,
          },
          {
            key: "bookings",
            label: tr(
              isMongolianLanguage,
              "Your Bookings",
              "Таны захиалгууд",
            ),
            hint: tr(
              isMongolianLanguage,
              "Submitted bookings",
              "Илгээсэн захиалга",
            ),
            status: bookingsStepStatus,
          },
        ];

    let nextAction: WorkspaceNextAction;
    if (showSeatRequestsTab && !hasRequests) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Send your first access request",
          "Эхний access хүсэлтээ илгээнэ үү",
        ),
        description: tr(
          isMongolianLanguage,
          "Choose date range, destination, and seats. Manager/admin will review it.",
          "Огноо, чиглэл, суудлаа оруулна. Менежер/админ хянаж батална.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Open Requests", "Хүсэлт рүү орох"),
        targetTab: "requests",
      };
    } else if (showSeatRequestsTab && !hasApprovedRequests) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Wait for approval",
          "Баталгаажуулалт хүлээнэ үү",
        ),
        description: strictGateLoading
          ? tr(
              isMongolianLanguage,
              "Checking seat access status...",
              "Seat access төлвийг шалгаж байна...",
            )
          : tr(
              isMongolianLanguage,
              "Request is sent. After approval, continue in Register.",
              "Хүсэлт илгээгдсэн. Батлагдсаны дараа Register хэсэгт үргэлжлүүлнэ.",
            ),
        ctaLabel: tr(
          isMongolianLanguage,
          "View Requests",
          "Хүсэлтүүдийг харах",
        ),
        targetTab: "requests",
      };
    } else if (requestOnlyRegistrationMode) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Registration is request-only",
          "Бүртгэл хүсэлтээр хязгаарлагдсан",
        ),
        description: tr(
          isMongolianLanguage,
          "Complete seat request workflow first, then registration opens.",
          "Эхлээд seat request урсгалаа дуусгаад дараа нь бүртгэл нээгдэнэ.",
        ),
        ctaLabel: tr(
          isMongolianLanguage,
          "Go to Requests",
          "Хүсэлт рүү очих",
        ),
        targetTab: "requests",
      };
    } else if (strictEligibilityLoading || strictGateLoading) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Validating seat access",
          "Seat access шалгаж байна",
        ),
        description: tr(
          isMongolianLanguage,
          "Please wait while we check your selected request.",
          "Сонгосон хүсэлтийг шалгаж байна. Түр хүлээнэ үү.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Stay here", "Эндээ хүлээх"),
        targetTab: "register",
        disabled: true,
      };
    } else if (strictRegisterLocked) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Complete payment milestones first",
          "Эхлээд milestone төлбөрөө гүйцээнэ үү",
        ),
        description: tr(
          isMongolianLanguage,
          "Finish required payment milestones first. Registration opens automatically after that.",
          "Эхлээд шаардлагатай milestone төлбөрөө хийж дуусгана. Дараа нь бүртгэл автоматаар нээгдэнэ.",
        ),
        ctaLabel: tr(
          isMongolianLanguage,
          "Review Requests",
          "Хүсэлтээ шалгах",
        ),
        targetTab: "requests",
      };
    } else if (registerApprovedToursMissing) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "No eligible tours yet",
          "Тохирох аялал алга",
        ),
        description: tr(
          isMongolianLanguage,
          "You have approval, but matching tours are not available yet.",
          "Танд батлагдсан хүсэлт байгаа ч тохирох аялал одоогоор алга.",
        ),
        ctaLabel: tr(
          isMongolianLanguage,
          "Back to Requests",
          "Хүсэлт рүү буцах",
        ),
        targetTab: "requests",
      };
    } else if (workspaceTab !== "register") {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Continue passenger registration",
          "Зорчигч бүртгэлээ үргэлжлүүлэх",
        ),
        description: tr(
          isMongolianLanguage,
          "Open Register to choose tour and complete passenger details.",
          "Register хэсэг рүү орж аяллаа сонгоод зорчигчийн мэдээллээ бөглөнө.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Open Register", "Бүртгэл рүү орох"),
        targetTab: "register",
        targetStep: Math.max(1, Math.min(activeStep, 4)),
      };
    } else if (activeStep === 1) {
      nextAction = {
        title: tr(isMongolianLanguage, "Select tour and date", "Аялал, огноо сонгох"),
        description: tr(
          isMongolianLanguage,
          "Start by selecting a tour and departure date.",
          "Эхлээд аялал, явах огноогоо сонгоно уу.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Stay on Register", "Бүртгэл дээр үргэлжлүүлэх"),
        targetTab: "register",
        targetStep: 1,
      };
    } else if (activeStep === 2) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Complete lead passenger",
          "Гол зорчигчийн мэдээллээ дуусгах",
        ),
        description: tr(
          isMongolianLanguage,
          "Complete lead passenger details before adding others.",
          "Нэмэлт зорчигч нэмэхээс өмнө гол зорчигчийн мэдээллээ бөглөнө үү.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Continue Step 2", "2-р алхам үргэлжлүүлэх"),
        targetTab: "register",
        targetStep: 2,
      };
    } else if (activeStep === 3) {
      nextAction = {
        title: tr(isMongolianLanguage, "Add passenger details", "Зорчигчоо бүртгэх"),
        description: tr(
          isMongolianLanguage,
          "Fill passenger cards, then continue to summary.",
          "Зорчигч бүрийн мэдээллийг бөглөөд дүгнэлт рүү орно.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Continue Step 3", "3-р алхам үргэлжлүүлэх"),
        targetTab: "register",
        targetStep: 3,
      };
    } else if (activeStep === 4) {
      nextAction = {
        title: tr(
          isMongolianLanguage,
          "Review and submit booking",
          "Захиалгаа шалгаад илгээх",
        ),
        description: tr(
          isMongolianLanguage,
          "Check payment method and passenger list before submitting.",
          "Илгээхээс өмнө төлбөрийн арга, зорчигчийн мэдээллээ шалгана.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Review Summary", "Дүгнэлтээ шалгах"),
        targetTab: "register",
        targetStep: 4,
      };
    } else {
      nextAction = {
        title: tr(isMongolianLanguage, "Track your bookings", "Захиалгаа хянах"),
        description: tr(
          isMongolianLanguage,
          "Review submitted passengers, leads, and flight data.",
          "Илгээсэн зорчигч, lead болон flight data-гаа хянаарай.",
        ),
        ctaLabel: tr(isMongolianLanguage, "Open Bookings", "Захиалга нээх"),
        targetTab: "bookings",
      };
    }

    return {
      progressItems,
      nextAction,
    };
  }, [
    activeStep,
    approvedSeatRequestCount,
    bookingPassengersCount,
    isMongolianLanguage,
    registerApprovedToursMissing,
    requestOnlyRegistrationMode,
    seatRequestCount,
    showSeatRequestsTab,
    strictEligibilityLoading,
    strictGateLoading,
    strictRegisterLocked,
    submittedPassengersCount,
    workspaceTab,
  ]);
}
