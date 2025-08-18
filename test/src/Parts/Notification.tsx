import { CheckCircle, AlertTriangle, X } from "lucide-react";

interface NotificationProps {
  notification: { type: 'success' | 'error'; message: string } | null;
  setNotification: (value: null) => void;
}

export default function Notification({ notification, setNotification }: NotificationProps) {
  return (
    notification && (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
        <div className="flex items-center">
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertTriangle className="w-5 h-5 mr-2" />
          )}
          {notification.message}
          <button
            onClick={() => setNotification(null)}
            className="ml-4 text-white hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  );
}