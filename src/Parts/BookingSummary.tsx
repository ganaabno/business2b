import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  CreditCard,
  Eye,
  AlertTriangle,
  Download,
  Save,
  User,
  EyeIcon,
  CheckCircle,
} from "lucide-react";
import type {
  Passenger,
  ValidationError,
  User as UserType,
} from "../types/type";
import React, { useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

interface BookingSummaryProps {
  selectedTour?: string;
  departureDate: string;
  passengers: Passenger[];
  paymentMethod: string[];
  setPaymentMethod: (value: string[]) => void;
  errors: ValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  downloadCSV?: () => void;
  saveOrder: () => Promise<void>;
  setActiveStep: (value: number) => void;
  loading: boolean;
  showInProvider?: boolean;
  setShowInProvider?: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser: UserType;
  onBack: () => void;
}

const cleanDateForDB = (dateValue: any): string | null => {
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    dateValue === false ||
    (typeof dateValue === "string" && dateValue.trim() === "") ||
    (typeof dateValue === "string" &&
      !isNaN(Date.parse(dateValue)) &&
      new Date(dateValue).toString() === "Invalid Date")
  ) {
    return null;
  }

  const cleaned = String(dateValue).trim();
  const parsedDate = new Date(cleaned);

  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
};

const calculateAge = (
  dateOfBirth: string | undefined | null,
): number | string => {
  const cleanBirthDate = cleanDateForDB(dateOfBirth);
  if (!cleanBirthDate) return "N/A";

  const today = new Date();
  const birthDate = new Date(cleanBirthDate);

  if (isNaN(birthDate.getTime())) return "N/A";

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

const validatePassenger = (
  passenger: Passenger,
  departureDate: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const { serial_no = "-" } = passenger;

  if (!passenger.first_name?.trim())
    errors.push({
      field: `passenger_${serial_no}_first_name`,
      message: t("bookingSummaryValidationFirstName", { serial: serial_no }),
    });
  if (!passenger.last_name?.trim())
    errors.push({
      field: `passenger_${serial_no}_last_name`,
      message: t("bookingSummaryValidationLastName", { serial: serial_no }),
    });
  if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
    errors.push({
      field: `passenger_${serial_no}_email`,
      message: t("bookingSummaryValidationEmail", { serial: serial_no }),
    });
  if (!passenger.phone?.trim())
    errors.push({
      field: `passenger_${serial_no}_phone`,
      message: t("bookingSummaryValidationPhone", { serial: serial_no }),
    });
  if (!passenger.nationality?.trim())
    errors.push({
      field: `passenger_${serial_no}_nationality`,
      message: t("bookingSummaryValidationNationality", { serial: serial_no }),
    });
  if (!passenger.date_of_birth)
    errors.push({
      field: `passenger_${serial_no}_date_of_birth`,
      message: t("bookingSummaryValidationDob", { serial: serial_no }),
    });
  if (!passenger.passport_number?.trim())
    errors.push({
      field: `passenger_${serial_no}_passport_number`,
      message: t("bookingSummaryValidationPassport", { serial: serial_no }),
    });
  if (!passenger.roomType?.trim())
    errors.push({
      field: `passenger_${serial_no}_roomType`,
      message: t("bookingSummaryValidationRoomType", { serial: serial_no }),
    });
  if (!passenger.hotel?.trim())
    errors.push({
      field: `passenger_${serial_no}_hotel`,
      message: t("bookingSummaryValidationHotel", { serial: serial_no }),
    });
  return errors;
};

export default function BookingSummary({
  selectedTour,
  departureDate,
  passengers,
  paymentMethod,
  setPaymentMethod,
  errors,
  setErrors,
  downloadCSV,
  saveOrder,
  setActiveStep,
  showInProvider,
  setShowInProvider,
  loading,
  currentUser,
  onBack,
}: BookingSummaryProps) {
  const { t, i18n } = useTranslation();

  const cleanedPassengers = useMemo(() => {
    return passengers.map((passenger) => ({
      ...passenger,
      date_of_birth: cleanDateForDB(passenger.date_of_birth),
      passport_expire: cleanDateForDB(passenger.passport_expire),
    }));
  }, [passengers]);

  const totalPrice = cleanedPassengers.reduce(
    (sum, p) => sum + (p.price || 0),
    0,
  );

  const hasValidationErrors = useMemo(() => {
    const passengerErrors = cleanedPassengers.flatMap((p) =>
      validatePassenger(p, departureDate, t),
    );
    return errors.length > 0 || passengerErrors.length > 0;
  }, [cleanedPassengers, errors, departureDate, t]);

  const cleanDepartureDate = cleanDateForDB(departureDate);

  const paymentMethods = [
    { value: "Cash", label: t("bookingSummaryPaymentCash") },
    { value: "Bank Transfer", label: t("bookingSummaryPaymentBankTransfer") },
    { value: "StorePay", label: t("bookingSummaryPaymentStorePay") },
    { value: "Pocket", label: t("bookingSummaryPaymentPocket") },
    { value: "DariFinance", label: t("bookingSummaryPaymentDariFinance") },
    { value: "Hutul Nomuun", label: t("bookingSummaryPaymentHutulNomuun") },
    { value: "MonPay", label: t("bookingSummaryPaymentMonPay") },
    { value: "Barter", label: t("bookingSummaryPaymentBarter") },
    { value: "Loan", label: t("bookingSummaryPaymentLoan") },
    { value: "Credit Card", label: t("bookingSummaryPaymentCreditCard") },
  ];

  const handlePaymentMethodChange = (method: string) => {
    const newPaymentMethods = paymentMethod.includes(method)
      ? paymentMethod.filter((m) => m !== method)
      : [...paymentMethod, method];
    setPaymentMethod(newPaymentMethods);
    if (newPaymentMethods.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  };

  const handleSaveOrder = async () => {
    // Clear previous errors
    setErrors([]);

    // Validate passengers
    const passengerErrors = cleanedPassengers.flatMap((p) =>
      validatePassenger(p, departureDate, t),
    );
    if (passengerErrors.length > 0) {
      setErrors(passengerErrors);
      return;
    }

    // Validate payment method
    if (paymentMethod.length === 0) {
      setErrors([
        {
          field: "payment",
          message: t("bookingSummaryPaymentRequired"),
        },
      ]);
      return;
    }

    try {
      await saveOrder();

      const leadId = (window as any).__currentLeadId;
      if (leadId) {
        window.dispatchEvent(
          new CustomEvent("booking-completed-from-lead", {
            detail: { leadId },
          }),
        );
        delete (window as any).__currentLeadId;

        toast.success(t("bookingSummaryToastLeadCompleted"), {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        });
      } else {
        toast.success(t("bookingSummaryToastConfirmed"), {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        });
      }

      setActiveStep(1);
    } catch (error) {
      console.error("BookingSummary: Save error:", error);
      setErrors([
        {
          field: "general",
          message: t("bookingSummarySaveFailed"),
        },
      ]);
    }
  };

  return (
    <div className="mono-stack">
      {/* Error panel — high priority, prominent */}
      {errors.length > 0 && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1.5px solid rgba(239,68,68,0.3)',
          }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: '#dc2626' }}>
              {t("bookingSummaryFixValidationErrors")}
            </p>
            <ul className="space-y-1">
              {errors
                .filter((error) => error.field !== "show_in_provider")
                .map((error, index) => (
                  <li key={index} className="text-xs flex items-start gap-1.5" style={{ color: '#b91c1c' }}>
                    <span className="shrink-0 mt-0.5">·</span>
                    <span>{error.message}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* Section 1: Booking Overview */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>
              <Eye size={14} />
            </div>
            <h3 className="section-card-title">{t("bookingSummaryTitle")}</h3>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(20,184,166,0.1)', color: '#0f766e', border: '1px solid rgba(20,184,166,0.2)' }}
          >
            Step 4 of 4
          </span>
        </div>
        <div className="section-card-body">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tour */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--mono-surface-muted)', border: '1px solid var(--mono-border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} style={{ color: '#1d4ed8' }} />
                <p className="label-low">{t("bookingSummaryTourPackage")}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--mono-text)' }}>
                {selectedTour || <span style={{ color: 'var(--mono-text-soft)' }}>{t("notSet")}</span>}
              </p>
            </div>
            {/* Date */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--mono-surface-muted)', border: '1px solid var(--mono-border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} style={{ color: '#0f766e' }} />
                <p className="label-low">{t("departureDate")}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--mono-text)' }}>
                {cleanDepartureDate
                  ? new Date(cleanDepartureDate).toLocaleDateString(
                      i18n.resolvedLanguage || "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )
                  : <span style={{ color: 'var(--mono-text-soft)' }}>{t("notSet")}</span>}
              </p>
            </div>
            {/* Passengers */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--mono-surface-muted)', border: '1px solid var(--mono-border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} style={{ color: '#7c3aed' }} />
                <p className="label-low">{t("bookingSummaryTotalPassengers")}</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--mono-text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
                {cleanedPassengers.length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-soft)' }}>{t("passengerPlural")}</p>
            </div>
            {/* Price */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(20,184,166,0.06)', border: '1.5px solid rgba(20,184,166,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} style={{ color: '#0f766e' }} />
                <p className="label-low" style={{ color: '#0f766e' }}>{t("bookingSummaryTotalPrice")}</p>
              </div>
              <p
                className="text-2xl font-bold"
                style={{ color: '#0f766e', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
              >
                ${totalPrice.toLocaleString()}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#0f766e', opacity: 0.7 }}>
                +${(totalPrice * 0.05).toFixed(0)} commission
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Payment Method */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
              <CreditCard size={14} />
            </div>
            <h4 className="section-card-title">{t("bookingSummaryPaymentMethods")}</h4>
          </div>
          {paymentMethod.length > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,184,166,0.1)', color: '#0f766e' }}
            >
              {paymentMethod.length} selected
            </span>
          )}
        </div>
        <div className="section-card-body">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {paymentMethods.map((method) => (
              <label
                key={method.value}
                className="flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all"
                style={
                  paymentMethod.includes(method.value)
                    ? {
                        background: 'rgba(29,78,216,0.08)',
                        border: '1.5px solid rgba(29,78,216,0.3)',
                        color: '#1d4ed8',
                      }
                    : {
                        background: 'var(--mono-surface-muted)',
                        border: '1px solid var(--mono-border)',
                        color: 'var(--mono-text-muted)',
                      }
                }
              >
                <input
                  type="checkbox"
                  name="paymentMethod"
                  value={method.value}
                  checked={paymentMethod.includes(method.value)}
                  onChange={() => handlePaymentMethodChange(method.value)}
                  className="sr-only"
                />
                <CreditCard size={13} className="shrink-0" />
                <span className="text-xs font-semibold">{method.label}</span>
              </label>
            ))}
          </div>
          {errors.some((e) => e.field === "payment") && (
            <p className="mt-2 text-xs font-semibold" style={{ color: '#dc2626' }}>
              {t("bookingSummaryPaymentRequired")}
            </p>
          )}
        </div>
      </div>

      {/* Section 3: Provider Option */}
      {currentUser.role !== "user" && setShowInProvider && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>
                <EyeIcon size={14} />
              </div>
              <h4 className="section-card-title">{t("bookingSummaryOptions")}</h4>
            </div>
          </div>
          <div className="section-card-body">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showInProvider ?? false}
                onChange={(e) => setShowInProvider(e.target.checked)}
                className="h-4 w-4 rounded"
                aria-label={t("bookingSummaryShowInProvider")}
              />
              <span className="text-sm" style={{ color: 'var(--mono-text)' }}>
                {t("bookingSummaryShowInProvider")}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Section 4: Passenger List */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}>
              <Users size={14} />
            </div>
            <h4 className="section-card-title">{t("bookingSummaryPassengerDetails")}</h4>
          </div>
          <span className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>
            {cleanedPassengers.length} passenger{cleanedPassengers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="section-card-body">
          <div className="space-y-2.5">
            {cleanedPassengers.map((passenger, idx) => (
              <div
                key={passenger.id}
                className="flex items-center justify-between p-4 rounded-xl transition-all"
                style={{
                  background: 'var(--mono-surface-muted)',
                  border: '1px solid var(--mono-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff' }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--mono-text)' }}>
                      {passenger.first_name?.trim() || t("notSet")}{" "}
                      {passenger.last_name?.trim() || ""}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-muted)' }}>
                      {passenger.nationality?.trim() || t("notSet")} · {passenger.gender?.trim() || t("notSet")} · Age: {calculateAge(passenger.date_of_birth)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>
                      {passenger.roomType?.trim() || t("notSet")} · {passenger.hotel?.trim() || t("notSet")}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="text-base font-bold"
                    style={{ color: '#0f766e', fontFamily: 'var(--font-display)' }}
                  >
                    ${(passenger.price || 0).toLocaleString()}
                  </p>
                  {passenger.additional_services?.length > 0 && (
                    <p className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>
                      +{passenger.additional_services.length} service{passenger.additional_services.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 5: Actions + Important Notes */}
      <div className="section-card">
        <div className="section-card-body">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <button
              onClick={onBack}
              className="mono-button mono-button--ghost"
            >
              {t("bookingSummaryBackToPassengers")}
            </button>
            <button
              onClick={downloadCSV}
              disabled={cleanedPassengers.length === 0}
              className="mono-button mono-button--ghost"
            >
              <Download className="w-4 h-4 mr-1" />
              {t("managerExportCsv")}
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={
                loading ||
                paymentMethod.length === 0 ||
                cleanedPassengers.length === 0 ||
                hasValidationErrors
              }
              className="mono-button flex-1"
              style={
                loading || paymentMethod.length === 0 || cleanedPassengers.length === 0 || hasValidationErrors
                  ? {}
                  : { background: 'linear-gradient(135deg, #0f766e, #0d9488)', borderColor: 'transparent', boxShadow: '0 4px 14px rgba(20,184,166,0.35)' }
              }
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {t("bookingSummaryProcessing")}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {t("bookingSummaryConfirmBooking")}
                </>
              )}
            </button>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: '#92400e' }}>
                  {t("bookingSummaryImportantNotes")}
                </p>
                <ul className="space-y-1">
                  {[
                    t("bookingSummaryNote1"),
                    t("bookingSummaryNote2"),
                    t("bookingSummaryNote3"),
                    t("bookingSummaryNote4"),
                    t("bookingSummaryNote5"),
                  ].map((note, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: '#78350f' }}>
                      <span className="shrink-0">·</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
