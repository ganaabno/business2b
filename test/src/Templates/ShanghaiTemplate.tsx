import React from "react";

interface ShanghaiTemplateProps {
  onSelect: (templateData: {
    title: string;
    name: string;
    hotels: string;
    services: string;
    description: string;
  }) => void;
}

export default function ShanghaiTemplate({ onSelect }: ShanghaiTemplateProps) {
  const templateData = {
    title: "Shanghai",
    name: "Shanghai Tour",
    hotels: "Golden, Apart",
    services: "",
    description: "Shanghai Yvah 7 honogiin aylal",
  };

  return (
    <button
      onClick={() => onSelect(templateData)}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Apply Shanghai Template
    </button>
  );
}