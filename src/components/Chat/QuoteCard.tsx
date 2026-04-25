import React, { useState } from 'react';
import { Copy, Send, Check, Clock, X, Calendar, Users, Hotel, Plane, Car } from 'lucide-react';
import type { PriceQuote } from '../../types/chat';
import { formatMnt } from '../../utils/priceCalculator';

interface QuoteCardProps {
  quote: PriceQuote;
  onSend?: () => void;
  onConvert?: () => void;
  onDelete?: () => void;
  isOwn?: boolean;
}

export default function QuoteCard({ quote, onSend, onConvert, onDelete, isOwn = false }: QuoteCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('mn-MN');
  };

  const getStatusBadge = () => {
    switch (quote.status) {
      case 'converted':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Баталгаассан</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Хугацаа дууссан</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Хүлээж байна</span>;
    }
  };

  const copyToClipboard = async () => {
    const text = generateQuoteText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQuoteText = () => {
    const lines = [
      `📊 ${quote.destination || 'Зорилго тодорхойгүй'} аялал`,
      `📅 ${formatDate(quote.start_date)} - ${formatDate(quote.end_date)}`,
      `👥 ${quote.people} хүн`,
      quote.hotel_type ? `🏨 Зочид буудал: ${quote.hotel_type}★` : null,
      quote.flight_class ? `✈️ Нислэг: ${quote.flight_class}` : null,
      quote.car_type ? `🚗 Машин: ${quote.car_type}` : null,
      quote.activities?.length ? `📋 Үйлчилгээ: ${quote.activities.map((a: any) => a.name).join(', ')}` : null,
      `\n💰 Нийт: ${formatMnt(quote.total_price)}`,
    ].filter(Boolean).join('\n');

    if (quote.breakdown?.length) {
      return lines + '\n\n📋 Задаргаа:\n' + quote.breakdown.map((item: any) => 
        `- ${item.item}: ${formatMnt(item.total)}`
      ).join('\n');
    }

    return lines;
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{quote.destination}</span>
          {getStatusBadge()}
        </div>
        <span className="text-sm text-gray-500">
          {formatDate(quote.created_at)}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(quote.start_date)} - {formatDate(quote.end_date)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span>{quote.people} хүн</span>
          </div>
          {quote.hotel_type && (
            <div className="flex items-center gap-2 text-gray-600">
              <Hotel className="w-4 h-4" />
              <span>{quote.hotel_type}★</span>
            </div>
          )}
          {quote.flight_class && (
            <div className="flex items-center gap-2 text-gray-600">
              <Plane className="w-4 h-4" />
              <span>{quote.flight_class}</span>
            </div>
          )}
          {quote.car_type && (
            <div className="flex items-center gap-2 text-gray-600">
              <Car className="w-4 h-4" />
              <span>{quote.car_type}</span>
            </div>
          )}
        </div>

        {expanded && quote.breakdown?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Задаргаа</h4>
            <div className="space-y-1">
              {quote.breakdown.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.item}</span>
                  <span className="text-gray-900 font-medium">{formatMnt(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {expanded ? 'Хураах' : 'Дэлгэх'}
          </button>
          <span className="text-lg font-bold text-green-700">
            {formatMnt(quote.total_price)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={copyToClipboard}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:scale-[1.02] hover:shadow-md transition-all duration-200"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span className="text-sm">{copied ? 'Хуулсан' : 'Хуулах'}</span>
          </button>

          {isOwn && onSend && (
            <button
              onClick={onSend}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm">Илгээх</span>
            </button>
          )}

          {isOwn && quote.status === 'pending' && onConvert && (
            <button
              onClick={onConvert}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm">Захиалах</span>
            </button>
          )}

          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 hover:scale-110 rounded-lg transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}