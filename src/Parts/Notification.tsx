import type { Notification as NotificationType } from "../types/type";

interface NotificationProps {
  notification: NotificationType | null;
  setNotification: React.Dispatch<React.SetStateAction<NotificationType | null>>;
}

export default function Notification({ notification, setNotification }: NotificationProps) {
  if (!notification || !notification.message) {
    return null;
  }

  const isSuccess = notification.type === "success";
  const bgColor = isSuccess ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400";
  const textColor = isSuccess ? "text-green-800" : "text-red-800";
  const iconPath = isSuccess
    ? "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
    : "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10 7.293 11.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z";

  return (
    <div className={`fixed top-4 right-4 max-w-sm w-full p-4 border-l-4 ${bgColor} rounded-lg shadow-lg flex items-start space-x-3 z-50`}>
      <svg className={`w-5 h-5 ${textColor}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d={iconPath} clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        <p className={`text-sm font-medium ${textColor}`}>{notification.message}</p>
      </div>
      <button
        onClick={() => setNotification(null)}
        className={`p-1 rounded-full hover:bg-gray-200 ${textColor}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}