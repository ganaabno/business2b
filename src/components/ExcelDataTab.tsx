import DataTable from "../Parts/DataTable.";

type Props = {
  data?: any[];
};

export default function ExcelDataTab({ data = [] }: Props) {
  const fallbackData = data.length > 0 ? data : [];

  if (fallbackData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg
          className="w-16 h-16 mb-4 text-gray-300"
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
        <p className="text-lg font-medium">Нислэгийн мэдээлэл байхгүй</p>
        <p className="text-sm">өгөгдөл алга.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable data={fallbackData} />
    </div>
  );
}
