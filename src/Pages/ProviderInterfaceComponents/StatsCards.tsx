import { FileText, Users, MapPin, TrendingUp } from "lucide-react";
import type { Order, Tour } from "../../types/type";
import { useTranslation } from "react-i18next";

interface StatsCardsProps {
  orders: Order[];
  tours: Tour[];
}

export default function StatsCards({ orders, tours }: StatsCardsProps) {
  const { t } = useTranslation();

  const totalPassengers = orders.reduce(
    (sum, order) => sum + (order.passenger_count || 0),
    0
  );

  const stats = [
    {
      label: t("totalOrders") || "Total Orders",
      value: orders.length,
      icon: FileText,
    },
    {
      label: t("totalPassengers") || "Total Passengers",
      value: totalPassengers,
      icon: Users,
      badge: totalPassengers > 100 ? "hot" : null,
    },
    {
      label: t("availableTours") || "Available Tours",
      value: tours.length,
      icon: MapPin,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="mono-card p-6"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                {stat.label}
              </p>
              <p className="text-3xl font-semibold text-gray-900 flex items-baseline gap-2">
                {stat.value.toLocaleString()}
                {stat.badge === "hot" && (
                  <span className="inline-flex items-center text-gray-500">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                )}
              </p>
            </div>

            <div className="p-3 bg-gray-100 rounded-xl border border-gray-200">
              <stat.icon className="w-6 h-6 text-gray-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
