import { useState } from "react";
import { toast } from "react-toastify";

interface Notification {
  type: "success" | "error" | null;
  message: string;
}

export const useNotifications = () => {
  const [notification, setNotification] = useState<Notification>({
    type: null,
    message: "",
  });

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });

    // Show toast notification using react-toastify
    if (type === "success") {
      toast.success(message, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    } else if (type === "error") {
      toast.error(message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }

    // Clear notification state after a delay to allow UI to update
    setTimeout(() => {
      setNotification({ type: null, message: "" });
    }, 5000);
  };

  return {
    notification,
    setNotification,
    showNotification,
  };
};
