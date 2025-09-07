// src/Pages/Pending.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Pending() {
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(async () => {
    }, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Your Request Is Pending</h1>
        <p className="text-gray-600">
          An admin will review your request and assign your role. You will be notified once approved.
        </p>
      </div>
    </div>
  );
}
