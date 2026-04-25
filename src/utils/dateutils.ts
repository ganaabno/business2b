// utils/dateUtils.ts
// 🛡️ BULLETPROOF DATE CLEANER - DESTROYS ALL EMPTY STRINGS
export const cleanDateForDB = (dateValue: any): string | null => {
  console.log(`🧹 Cleaning date: "${dateValue}" (${typeof dateValue})`);
  
  // Handle ALL possible "empty" scenarios
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    dateValue === false ||
    dateValue === 0 ||
    (typeof dateValue === 'string' && dateValue.trim() === '') ||
    (typeof dateValue === 'object' && dateValue?.toString().trim() === '')
  ) {
    console.log("✅ Returning null for empty value");
    return null;
  }
  
  // Handle Date objects
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) {
      console.log("✅ Returning null for invalid Date object");
      return null;
    }
    // Convert Date to YYYY-MM-DD
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    const cleaned = `${year}-${month}-${day}`;
    console.log(`✅ Valid Date -> "${cleaned}"`);
    return cleaned;
  }
  
  // Handle string dates
  const cleanedString = String(dateValue).trim();
  if (!cleanedString) {
    console.log("✅ Returning null for empty string after trim");
    return null;
  }
  
  // Parse and validate the date
  const parsedDate = new Date(cleanedString);
  if (isNaN(parsedDate.getTime())) {
    console.log(`❌ Invalid date "${cleanedString}" -> null`);
    return null;
  }
  
  // Convert to YYYY-MM-DD format
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
  console.log(`✅ Valid string -> "${formattedDate}"`);
  return formattedDate;
};

// 🛡️ BATCH CLEANER - Clean an entire object
export const cleanDatesInObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const cleaned = { ...obj };
  
  // Recursively clean nested objects
  Object.keys(cleaned).forEach(key => {
    const value = cleaned[key];
    
    // Clean date fields (add more field names as needed)
    if ([
      'date_of_birth', 'passport_expire', 'departure_date', 
      'created_at', 'updated_at', 'booking_date'
    ].includes(key)) {
      cleaned[key] = cleanDateForDB(value);
    }
    
    // Recursively clean nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        cleaned[key] = value.map(item => cleanDatesInObject(item));
      } else {
        cleaned[key] = cleanDatesInObject(value);
      }
    }
  });
  
  return cleaned;
};