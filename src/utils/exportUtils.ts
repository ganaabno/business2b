import { format } from 'date-fns';
import type { PriceQuote } from '../types/chat';
import { formatMnt } from './priceCalculator';

export function exportQuoteToCSV(quotes: PriceQuote[], filename: string = 'quotes.csv') {
  const headers = ['ID', 'Destination', 'Start Date', 'End Date', 'Days', 'People', 'Hotel', 'Flight', 'Total Price', 'Status', 'Created'];
  
  const rows = quotes.map(q => [
    q.id,
    q.destination || '',
    q.start_date || '',
    q.end_date || '',
    q.days || 0,
    q.people || 0,
    q.hotel_type || '',
    q.flight_class || '',
    q.total_price || 0,
    q.status,
    q.created_at || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => 
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function exportQuoteToText(quote: PriceQuote): string {
  const lines = [
    `=== ${quote.destination || 'Түүх тодорхойгүй'} ===`,
    `📅: ${quote.start_date || '-'} - ${quote.end_date || '-'}`,
    `👥: ${quote.people} хүн`,
    `🏨: ${quote.hotel_type || '-'} зочид буудал`,
    `✈️: ${quote.flight_class || '-'}`,
    `🚗: ${quote.car_type || '-'}`,
    ``,
    `💰 Нийт: ${formatMnt(quote.total_price)}`,
    ``,
    `Задаргаа:`,
    ...(quote.breakdown?.map(item => 
      `  - ${item.item}: ${formatMnt(item.total)}`
    ) || []),
    ``,
    `Төлөв: ${quote.status}`,
    `Огноо: ${quote.created_at}`,
  ];

  return lines.join('\n');
}

export function generateCalendarEvent(quote: PriceQuote): void {
  const summary = `${quote.destination} аялал`;
  const description = exportQuoteToText(quote);
  
  const startDate = quote.start_date 
    ? new Date(quote.start_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : '';
  const endDate = quote.end_date 
    ? new Date(quote.end_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GTrip//Quote Calendar//EN',
    'BEGIN:VEVENT',
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `trip-${quote.destination}-${quote.start_date}.ics`;
  link.click();
}