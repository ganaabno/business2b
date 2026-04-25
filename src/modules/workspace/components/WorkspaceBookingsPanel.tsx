import type { Dispatch, SetStateAction } from "react";
import type {
  LeadPassenger,
  Order,
  Passenger,
  Tour,
  User as UserType,
} from "../../../types/type";
import type { FlightRow } from "../../../Parts/flightDataStore";
import BookingsList from "../../../Pages/userInterface/BookingsList";
import ManageLead from "../../../components/ManageLead";
import ExcelDataTab from "../../../components/ExcelDataTab";

type Translator = (key: string, options?: Record<string, unknown>) => string;

export type WorkspaceBookingsTab = "bookings" | "leads" | "excel";

type LeadPassengerFormData = {
  seat_count: number;
  tour_id: string;
  departure_date: string;
} | null;

type WorkspaceBookingsPanelProps = {
  t: Translator;
  activeTab: WorkspaceBookingsTab;
  onTabChange: (tab: WorkspaceBookingsTab) => void;
  submittedPassengers: Passenger[];
  orders: Order[];
  tours: Tour[];
  currentUser: UserType;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  showNotification: (type: "success" | "error", message: string) => void;
  setActiveStep: Dispatch<SetStateAction<number>>;
  setLeadPassengerData: Dispatch<SetStateAction<LeadPassenger | null>>;
  setLeadPassengerFormData: Dispatch<SetStateAction<LeadPassengerFormData>>;
  flightData: FlightRow[];
};

export default function WorkspaceBookingsPanel({
  t,
  activeTab,
  onTabChange,
  submittedPassengers,
  orders,
  tours,
  currentUser,
  currentPage,
  setCurrentPage,
  showNotification,
  setActiveStep,
  setLeadPassengerData,
  setLeadPassengerFormData,
  flightData,
}: WorkspaceBookingsPanelProps) {
  const registeredCount = submittedPassengers.length;
  const activeTabGuide =
    activeTab === "bookings"
      ? {
          title: t("registeredPassengers"),
          description: t("bookingsWorkspaceSubtitle"),
        }
      : activeTab === "leads"
        ? {
            title: t("yourLeadPassengers"),
            description: t("workspaceSubtitleBookings"),
          }
        : {
            title: t("flightData"),
            description: t("flightDataPersists"),
          };

  return (
    <div id="workspace-bookings-section" className="mono-card">
      <div className="border-b border-gray-200 p-5">
        <h2 className="mono-title text-xl">{t("workspaceYourBookings")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("bookingsWorkspaceSubtitle")}</p>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mono-panel mb-4 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {t("workspaceSections")}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{activeTabGuide.title}</p>
          <p className="mt-1 text-xs text-gray-600">{activeTabGuide.description}</p>
        </div>

        <div className="mono-tablist">
          <button
            onClick={() => onTabChange("bookings")}
            className={`mono-tab ${activeTab === "bookings" ? "mono-tab--active" : ""}`}
          >
            {t("registeredPassengers")} ({registeredCount})
          </button>
          <button
            onClick={() => onTabChange("leads")}
            className={`mono-tab ${activeTab === "leads" ? "mono-tab--active" : ""}`}
          >
            {t("yourLeadPassengers")}
          </button>
          <button
            onClick={() => onTabChange("excel")}
            className={`mono-tab ${activeTab === "excel" ? "mono-tab--active" : ""}`}
          >
            <span className="flex items-center justify-center">
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t("flightData")}
              {flightData.length > 0 ? ` (${flightData.length})` : ""}
            </span>
          </button>
        </div>

        <div className="mt-6">
          {activeTab === "bookings" && (
            <BookingsList
              passengers={submittedPassengers}
              orders={orders}
              tours={tours}
              currentUser={currentUser}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          )}

          {activeTab === "leads" && (
            <ManageLead
              currentUser={currentUser}
              showNotification={showNotification}
              setActiveStep={setActiveStep}
              setLeadPassengerData={setLeadPassengerData}
              setPassengerFormData={setLeadPassengerFormData}
            />
          )}

          {activeTab === "excel" && (
            <div className="space-y-6">
              {flightData.length > 0 ? (
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">{t("flightData")}</h3>
                    <div className="flex items-center gap-3" />
                  </div>
                  <ExcelDataTab data={flightData} />
                  <p className="mt-3 text-xs text-gray-500">{t("flightDataPersists")}</p>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <svg
                    className="mx-auto mb-4 h-16 w-16 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium">{t("noFileUploaded")}</p>
                  <p className="text-sm">{t("managerUploadExcelPrompt")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
