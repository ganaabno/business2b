import React, { useState } from 'react';
import { Download, FileSpreadsheet, Check, Copy } from 'lucide-react';
import type { PriceBreakdownItem } from '../../types/chat';
import { formatMnt } from '../../utils/priceCalculator';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface PriceBreakdownProps {
  breakdown: PriceBreakdownItem[];
  tourName?: string;
  date?: string;
  travelers?: number;
}

export default function PriceBreakdown({ breakdown, tourName, date, travelers }: PriceBreakdownProps) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = breakdown.reduce((sum, item) => sum + item.total, 0);

  const exportToExcel = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Үнэ тооцоо');

      // Title
      worksheet.mergeCells('A1:D1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'Аялалын үнэ тооцоо';
      titleCell.font = { bold: true, size: 14 };

      // Info rows
      if (tourName) {
        worksheet.getCell('A2').value = 'Аялал:';
        worksheet.getCell('B2').value = tourName;
      }
      if (date) {
        worksheet.getCell('A3').value = 'Огноо:';
        worksheet.getCell('B3').value = date;
      }
      if (travelers) {
        worksheet.getCell('A4').value = 'Хүний тоо:';
        worksheet.getCell('B4').value = travelers;
      }

      // Table header
      const headerRow = worksheet.addRow(['Зүйл', 'Тоо', 'Нэгжийн үнэ', 'Нийт']);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });

      // Data rows
      breakdown.forEach((item) => {
        worksheet.addRow([item.item, item.quantity, item.unitPrice, item.total]);
      });

      // Total row
      const totalRow = worksheet.addRow(['', '', 'НИЙТ:', total]);
      totalRow.eachCell((cell, colNum) => {
        if (colNum <= 3) {
          cell.font = { bold: true };
        }
      });

      // Column widths
      worksheet.getColumn(1).width = 30;
      worksheet.getColumn(2).width = 10;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(4).width = 15;

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const fileName = `price_quote_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = async () => {
    const text =
      '📋 Үнэ тооцоо\n\n' +
      breakdown
        .map((item) => `${item.item}: ${formatMnt(item.total)}`)
        .join('\n') +
      '\n\nНийт: ' +
      formatMnt(total);

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Зүйл</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Тоо</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Нэгжийн үнэ</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Нийт</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((item, index) => (
            <tr key={index} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 text-gray-800">{item.item}</td>
              <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatMnt(item.unitPrice)}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-800">{formatMnt(item.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-bold text-gray-800">
              НИЙТ:
            </td>
            <td className="px-3 py-2 text-right font-bold text-green-700">{formatMnt(total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Download buttons */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={exportToExcel}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {downloading ? (
            <span className="animate-pulse">Татаж байна...</span>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              Excel татах
            </>
          )}
        </button>
        <button
          onClick={copyToClipboard}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              Хуулсан
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Хуулах
            </>
          )}
        </button>
      </div>
    </div>
  );
}
