// components/DeleteFlightDataButton.tsx
import { useState } from "react";
import { Trash2, AlertCircle, Check, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useNotifications } from "../hooks/useNotifications";

type Props = {
  onSuccess: () => void;
};

export default function DeleteFlightDataButton({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const { showNotification } = useNotifications();

  const handleDelete = async () => {
    setLoading(true);
    try {
      // ЯГ ЭНДЭЭ Л ХАМГИЙН ЧУХАЛ ХЭСЭГ
      const { error } = await supabase
        .from("flight_data")
        .delete()
        .neq("id", null); // ← Энэ мөр л хангалттай!

      if (error) throw error;

      showNotification(
        "success",
        "Бүх нислэгийн мэдээлэл амжилттай устгагдлаа!",
      );
      setStatus("success");
      onSuccess();
    } catch (err: any) {
      console.error("Delete error:", err);
      showNotification("error", "Устгахад алдаа: " + err.message);
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-medium transition-all
            ${
              loading
                ? "bg-red-400 text-white"
                : "bg-red-600 text-white hover:bg-red-700"
            }
            disabled:opacity-50
          `}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Устгаж байна...</span>
            </>
          ) : status === "success" ? (
            <>
              <Check className="w-5 h-5" />
              <span>Устгагдлаа!</span>
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              <span>Бүх өгөгдлийг устгах</span>
            </>
          )}
        </button>
        <p className="text-xs text-red-600 mt-2 text-center">
          Анхаар: Буцаах боломжгүй!
        </p>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-8 h-8" />
              <h3 className="text-lg font-bold">Бүгдийг устгах уу?</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Та <strong>бүх нислэгийн мэдээлэл</strong>-ийг устгах гэж байна.
              Энэ үйлдлийг <strong>буцаах боломжгүй</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Болих
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Тийм, устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
