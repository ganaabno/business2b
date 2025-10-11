import { FileText } from 'lucide-react';

export default function DashboardHeader() {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your tour orders</p>
          </div>
        </div>
      </div>
    </div>
  );
}