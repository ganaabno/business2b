import type { PriceConfig, CalculatorInput, PriceResult, PriceBreakdownItem } from '../types/chat';

export function getHotelPrice(config: PriceConfig, hotelType: '3star' | '4star' | '5star'): number {
  switch (hotelType) {
    case '3star': return config.hotel_3star_price_per_night;
    case '4star': return config.hotel_4star_price_per_night;
    case '5star': return config.hotel_5star_price_per_night;
  }
}

export function calculatePrice(config: PriceConfig, input: CalculatorInput): PriceResult {
  const breakdown: PriceBreakdownItem[] = [];
  
  // Flight cost
  const flightTotal = config.flight_price_per_person * input.people;
  breakdown.push({
    item: 'Нислэг',
    quantity: input.people,
    unitPrice: config.flight_price_per_person,
    total: flightTotal,
  });

  // Hotel cost
  const hotelPricePerNight = getHotelPrice(config, input.hotelType);
  const hotelTotal = hotelPricePerNight * input.days * input.people;
  const hotelLabel = input.hotelType === '3star' ? '3 одой' : input.hotelType === '4star' ? '4 одой' : '5 одой';
  breakdown.push({
    item: `Зочид буудал (${hotelLabel})`,
    quantity: input.days * input.people,
    unitPrice: hotelPricePerNight,
    total: hotelTotal,
  });

  // Guide cost (per day, flat rate)
  if (input.hasGuide) {
    const guideTotal = config.guide_price_per_day * input.days;
    breakdown.push({
      item: 'Гид',
      quantity: input.days,
      unitPrice: config.guide_price_per_day,
      total: guideTotal,
    });
  }

  // Insurance cost (per person)
  if (input.hasInsurance) {
    const insuranceTotal = config.insurance_price_per_person * input.people;
    breakdown.push({
      item: 'Даатгал',
      quantity: input.people,
      unitPrice: config.insurance_price_per_person,
      total: insuranceTotal,
    });
  }

  // Transport cost (per day)
  if (input.hasTransport) {
    const transportTotal = config.transport_price_per_day * input.days;
    breakdown.push({
      item: 'Тээвэр',
      quantity: input.days,
      unitPrice: config.transport_price_per_day,
      total: transportTotal,
    });
  }

  // Calculate total
  const total = breakdown.reduce((sum, item) => sum + item.total, 0);

  return { total, breakdown };
}

export function formatMnt(amount: number): string {
  return `${amount.toLocaleString()}₮`;
}
