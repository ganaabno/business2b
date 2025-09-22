/**
 * Booking Utilities
 * Common utility functions for booking operations
 */

import type { Passenger } from "../types/type";

/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date of birth in YYYY-MM-DD format
 * @returns Calculated age in years
 */
export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth || isNaN(new Date(dateOfBirth).getTime())) return 0;
  
  const dob = new Date(dateOfBirth);
  const today = new Date();
  
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  // Adjust age if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return Math.max(0, age);
};

/**
 * Format currency for display
 * @param amount - Amount in dollars
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Validate email address
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number
 * @param phone - Phone number string
 * @returns True if valid phone format (8+ digits)
 */
export const isValidPhone = (phone: string): boolean => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 8;
};

/**
 * Clean and format passenger name
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Full name string
 */
export const formatPassengerName = (firstName: string, lastName: string): string => {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();
  return `${first} ${last}`.trim();
};

/**
 * Get passenger status badge class
 * @param status - Passenger status
 * @returns Tailwind CSS classes for status badge
 */
export const getStatusBadgeClass = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};
/**
 * Check if passenger form is complete
 * @param passenger - Passenger object
 * @returns Boolean indicating if required fields are filled
 */
export const isPassengerComplete = (passenger: Partial<Passenger>): boolean => {
  const requiredFields = [
    'first_name',
    'last_name', 
    'email',
    'phone',
    'gender',
    'passport_number',
    'passport_expiry',
    'nationality',
    'hotel'
  ];

  return requiredFields.every(field => {
    const value = passenger[field as keyof Passenger];
    return value && String(value).trim().length > 0;
  });
};

/**
 * Get completion percentage for passenger
 * @param passenger - Passenger object
 * @returns Percentage of completed required fields (0-100)
 */
export const getPassengerCompletion = (passenger: Partial<Passenger>): number => {
  const requiredFields = [
    'first_name',
    'last_name', 
    'email',
    'phone',
    'gender',
    'passport_number',
    'passport_expiry',
    'nationality',
    'hotel'
  ];

  const completed = requiredFields.filter(field => {
    const value = passenger[field as keyof Passenger];
    return value && String(value).trim().length > 0;
  }).length;

  return Math.round((completed / requiredFields.length) * 100);
};

/**
 * Generate room allocation display text
 * @param allocation - Room allocation code
 * @param roomType - Room type
 * @returns User-friendly room allocation text
 */
export const formatRoomAllocation = (allocation: string, roomType: string): string => {
  if (!allocation) return 'Not assigned';
  
  switch (roomType) {
    case 'Single':
    case 'King':
      return `Single Room ${allocation}`;
    case 'Double':
      return `Double Room ${allocation}`;
    case 'Twin':
      return `Twin Room ${allocation}`;
    case 'Family':
      return `Family Room ${allocation}`;
    default:
      return allocation;
  }
};

/**
 * Check if passport is expiring soon
 * @param expiryDate - Passport expiry date string
 * @param departureDate - Departure date string
 * @returns Object with expiry status and months remaining
 */
export const checkPassportExpiry = (expiryDate: string, departureDate?: string): {
  isValid: boolean;
  monthsRemaining: number;
  warningLevel: 'none' | 'warning' | 'urgent' | 'expired';
} => {
  if (!expiryDate) {
    return { isValid: false, monthsRemaining: 0, warningLevel: 'expired' };
  }

  const expiry = new Date(expiryDate);
  const today = new Date();
  const monthsRemaining = (expiry.getFullYear() - today.getFullYear()) * 12 + 
                         (expiry.getMonth() - today.getMonth());

  if (monthsRemaining <= 0) {
    return { isValid: false, monthsRemaining, warningLevel: 'expired' };
  }

  if (departureDate) {
    const minDate = new Date(departureDate);
    minDate.setMonth(minDate.getMonth() + 6);
    if (expiry < minDate) {
      return { isValid: false, monthsRemaining, warningLevel: 'urgent' };
    }
  }

  if (monthsRemaining <= 1) {
    return { isValid: true, monthsRemaining, warningLevel: 'urgent' };
  }
  
  if (monthsRemaining <= 3) {
    return { isValid: true, monthsRemaining, warningLevel: 'warning' };
  }

  return { isValid: true, monthsRemaining, warningLevel: 'none' };
};

/**
 * Get passport expiry color class
 * @param expiryDate - Passport expiry date string
 * @returns Tailwind CSS border and background classes
 */
export const getPassportExpiryColor = (expiryDate: string): string => {
  if (!expiryDate) return "border-gray-300 bg-white";
  
  const { warningLevel } = checkPassportExpiry(expiryDate);
  
  switch (warningLevel) {
    case 'expired':
      return "border-red-500 bg-red-50";
    case 'urgent':
      return "border-red-400 bg-red-50";
    case 'warning':
      return "border-orange-400 bg-orange-50";
    default:
      return "border-green-400 bg-green-50";
  }
};

/**
 * Format date for display
 * @param dateString - Date string
 * @param format - Display format ('short', 'medium', 'long')
 * @returns Formatted date string
 */
export const formatDateForDisplay = (dateString: string, format: 'short' | 'medium' | 'long' = 'medium'): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  if (format === 'short') {
    options.month = 'short';
    options.day = 'numeric';
  } else if (format === 'long') {
    options.weekday = 'long';
    options.month = 'long';
    options.day = 'numeric';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
};

/**
 * Get room type badge color
 * @param roomType - Room type string
 * @returns Tailwind CSS classes for room type badge
 */
export const getRoomTypeBadgeClass = (roomType: string): string => {
  switch (roomType) {
    case 'Single':
    case 'King':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'Double':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'Twin':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    case 'Family':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
};