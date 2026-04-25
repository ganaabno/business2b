import React, { useState } from 'react';
import type { PriceConfig, CalculatorInput } from '../../types/chat';
import { calculatePrice, formatMnt } from '../../utils/priceCalculator';
import PriceBreakdown from './PriceBreakdown';

interface PriceCalculatorProps {
  configs: PriceConfig[];
  onSendQuote: (quoteText: string) => Promise<void>;
}

export default function PriceCalculator({ configs, onSendQuote }: PriceCalculatorProps) {
  const [input, setInput] = useState<CalculatorInput>({
    destination: configs[0]?.destination || '',
    people: 1,
    days: 1,
    hotelType: '3star',
    hasGuide: false,
    hasInsurance: false,
    hasTransport: false,
  });

  const [result, setResult] = useState<ReturnType<typeof calculatePrice> | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<PriceConfig | null>(configs[0] || null);

  const handleDestinationChange = (destination: string) => {
    const config = configs.find(c => c.destination === destination) || null;
    setSelectedConfig(config);
    setInput(prev => ({ ...prev, destination }));
    setResult(null);
  };

  const handleCalculate = () => {
    if (!selectedConfig) return;
    
    const priceResult = calculatePrice(selectedConfig, input);
    setResult(priceResult);
  };

  const handleSendQuote = async () => {
    if (!result || !selectedConfig) return;

    const quoteText = `📊 ${input.destination} аялал\n` +
      `👥 ${input.people} хүн\n` +
      `📅 ${input.days} өдөр\n` +
      `🏨 Зочид буудал: ${input.hotelType === '3star' ? '3 одой' : input.hotelType === '4star' ? '4 одой' : '5 одой'}\n` +
      `${input.hasGuide ? '✅ Гид\n' : ''}` +
      `${input.hasInsurance ? '✅ Даатгал\n' : ''}` +
      `${input.hasTransport ? '✅ Тээвэр\n' : ''}\n` +
      `💰 Нийт: ${formatMnt(result.total)}\n\n` +
      `📋 Задаргаа:\n` +
      result.breakdown.map(item => 
        `- ${item.item}: ${formatMnt(item.total)}`
      ).join('\n');

    await onSendQuote(quoteText);
  };

  if (configs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-gray-500 text-center">
          <p>Тооцооны мэдээлэл олдсонгүй</p>
          <p className="text-sm mt-1">Админ хэсгээс тохируулана уу</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Зорилго
          </label>
          <select
            value={input.destination}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {configs.map(config => (
              <option key={config.id} value={config.destination}>
                {config.destination}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Хүний тоо
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={input.people}
              onChange={(e) => setInput(prev => ({ ...prev, people: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Өдрийн тоо
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={input.days}
              onChange={(e) => setInput(prev => ({ ...prev, days: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Зочид буудал
          </label>
          <div className="flex gap-2">
            {(['3star', '4star', '5star'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setInput(prev => ({ ...prev, hotelType: type }))}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  input.hotelType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                {type === '3star' ? '3★' : type === '4star' ? '4★' : '5★'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Нэмэлт үйлчилгээ
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={input.hasGuide}
                onChange={(e) => setInput(prev => ({ ...prev, hasGuide: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Гид ({selectedConfig && formatMnt(selectedConfig.guide_price_per_day)}/өдөр)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={input.hasInsurance}
                onChange={(e) => setInput(prev => ({ ...prev, hasInsurance: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Даатгал ({selectedConfig && formatMnt(selectedConfig.insurance_price_per_person)}/хүн)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={input.hasTransport}
                onChange={(e) => setInput(prev => ({ ...prev, hasTransport: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Тээвэр ({selectedConfig && formatMnt(selectedConfig.transport_price_per_day)}/өдөр)</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-200 active:scale-95 font-medium"
        >
          Тооцоолох
        </button>

        {result && (
          <div className="mt-4">
            <div className="text-center py-3 bg-green-50 border border-green-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="text-sm text-green-600">Нийт үнэ</div>
              <div className="text-2xl font-bold text-green-700">{formatMnt(result.total)}</div>
            </div>
            
            <PriceBreakdown breakdown={result.breakdown} />
            
            <button
              onClick={handleSendQuote}
              className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-200 active:scale-95 font-medium flex items-center justify-center gap-2"
            >
              Чатод илгээх
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
