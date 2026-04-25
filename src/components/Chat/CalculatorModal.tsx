import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import type { PriceConfig, CalculatorInput } from '../../types/chat';
import { calculatePrice, formatMnt } from '../../utils/priceCalculator';

interface CalculatorModalProps {
  configs: PriceConfig[];
  isOpen: boolean;
  onClose: () => void;
  onSendQuote: (quoteText: string) => void;
}

export default function CalculatorModal({
  configs,
  isOpen,
  onClose,
  onSendQuote,
}: CalculatorModalProps) {
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

  useEffect(() => {
    if (configs.length > 0 && !selectedConfig) {
      setSelectedConfig(configs[0]);
      setInput(prev => ({ ...prev, destination: configs[0].destination }));
    }
  }, [configs, selectedConfig]);

  if (!isOpen) return null;

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

  const handleSendQuote = () => {
    if (!result || !selectedConfig) return;

    const quoteText = `📊 ${input.destination} аялал
👥 ${input.people} хүн
📅 ${input.days} өдөр
🏨 Зочид буудал: ${input.hotelType === '3star' ? '3 одой' : input.hotelType === '4star' ? '4 одой' : '5 одой'}
${input.hasGuide ? '✅ Гид\n' : ''}${input.hasInsurance ? '✅ Даатгал\n' : ''}${input.hasTransport ? '✅ Тээвэр\n' : ''}
💰 Нийт: ${formatMnt(result.total)}

📋 Задаргаа:
${result.breakdown.map(item => `- ${item.item}: ${formatMnt(item.total)}`).join('\n')}`;

    onSendQuote(quoteText);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Тооцоо</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    input.hotelType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.hasGuide}
                  onChange={(e) => setInput(prev => ({ ...prev, hasGuide: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Гид {selectedConfig && `(${formatMnt(selectedConfig.guide_price_per_day)}/өдөр)`}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.hasInsurance}
                  onChange={(e) => setInput(prev => ({ ...prev, hasInsurance: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Даатгал {selectedConfig && `(${formatMnt(selectedConfig.insurance_price_per_person)}/хүн)`}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.hasTransport}
                  onChange={(e) => setInput(prev => ({ ...prev, hasTransport: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Тээвэр {selectedConfig && `(${formatMnt(selectedConfig.transport_price_per_day)}/өдөр)`}
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Тооцоолох
          </button>

          {result && (
            <div className="mt-4">
              <div className="text-center py-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-600">Нийт үнэ</div>
                <div className="text-xl font-bold text-green-700">{formatMnt(result.total)}</div>
              </div>

              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Зүйл</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Тоо</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Нийт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 text-gray-800">{item.item}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{formatMnt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSendQuote}
                className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Чатод илгээх
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
