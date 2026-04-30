/**
 * Input Classifier for Hybrid Chatbot
 *
 * This module determines whether user input is structured (FSM-compatible)
 * or conversational (AI-compatible), and detects user intent.
 */

import { BotState } from "./fsm.service.js";

export type InputType = "STRUCTURED" | "CONVERSATIONAL" | "MIXED";

export type Intent =
  | "booking"
  | "question"
  | "greeting"
  | "selection"
  | "date"
  | "confirmation"
  | "cancellation"
  | "help"
  | "unknown";

export type ExpectedFormat =
  | "NUMBER"
  | "DATE"
  | "YES_NO"
  | "SELECTION"
  | "ANY";

export interface InputClassification {
  type: InputType;
  intent: Intent;
  confidence: number; // 0-1
  extractedData?: {
    number?: number;
    date?: string;
    boolean?: boolean;
    text?: string;
  };
  isFSMTrigger: boolean;
  shouldUseFSM: boolean;
  shouldUseAI: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  extractedValue?: any;
}

/**
 * Main classification function that analyzes user input
 */
export function classifyInput(
  message: string,
  currentState: BotState,
  expectedFormat?: ExpectedFormat
): InputClassification {
  const trimmed = message.trim().toLowerCase();

  // Check for FSM trigger keywords
  const isFSMTrigger = detectFSMTrigger(trimmed);

  // Determine input type based on expected format and content
  const type = determineInputType(trimmed, expectedFormat);

  // Detect user intent
  const intent = detectIntent(trimmed, currentState);

  // Extract structured data if present
  const extractedData = extractStructuredData(trimmed, expectedFormat);

  // Calculate confidence
  const confidence = calculateConfidence(type, intent, extractedData);

  // Decide routing strategy
  const routingDecision = decideRouting(
    type,
    intent,
    isFSMTrigger,
    currentState,
    extractedData
  );

  return {
    type,
    intent,
    confidence,
    extractedData,
    isFSMTrigger,
    shouldUseFSM: routingDecision.useFSM,
    shouldUseAI: routingDecision.useAI,
  };
}

/**
 * Detect if input contains FSM trigger keywords
 */
function detectFSMTrigger(message: string): boolean {
  const triggerKeywords = [
    "захиалах",
    "номлох",
    "аялал сонгох",
    "booking",
    "reserve",
    "захиалга",
    "сонгох",
    "эхлэх",
    "start",
    "begin",
  ];

  return triggerKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Determine if input is structured or conversational
 */
function determineInputType(
  message: string,
  expectedFormat?: ExpectedFormat
): InputType {
  // If we expect a specific format, check if input matches
  if (expectedFormat) {
    if (expectedFormat === "NUMBER" && isNumber(message)) {
      return "STRUCTURED";
    }
    if (expectedFormat === "DATE" && isDate(message)) {
      return "STRUCTURED";
    }
    if (expectedFormat === "YES_NO" && isYesNo(message)) {
      return "STRUCTURED";
    }
    if (expectedFormat === "SELECTION" && isSelection(message)) {
      return "STRUCTURED";
    }
  }

  // Check if it's purely structured
  if (isNumber(message) || isDate(message) || isYesNo(message)) {
    return "STRUCTURED";
  }

  // Check if it's purely conversational
  if (isQuestion(message) || isGreeting(message) || isConversational(message)) {
    return "CONVERSATIONAL";
  }

  // Mixed content
  return "MIXED";
}

/**
 * Detect user intent from message
 */
function detectIntent(message: string, currentState: BotState): Intent {
  // Booking intent
  if (
    message.includes("захиалах") ||
    message.includes("booking") ||
    message.includes("reserve") ||
    message.includes("захиалга")
  ) {
    return "booking";
  }

  // Question intent
  if (
    message.includes("?") ||
    message.includes("юу") ||
    message.includes("ямар") ||
    message.includes("хэрхэн") ||
    message.includes("what") ||
    message.includes("how") ||
    message.includes("why") ||
    message.includes("which") ||
    message.includes("where") ||
    message.includes("when") ||
    message.endsWith("вэ") ||
    message.endsWith("уу")
  ) {
    return "question";
  }

  // Greeting intent
  if (
    message.includes("сайн") ||
    message.includes("hello") ||
    message.includes("hi") ||
    message.includes("hey") ||
    message.includes("байна уу") ||
    message.includes("мэнд") ||
    message.startsWith("сайн")
  ) {
    return "greeting";
  }

  // Selection intent (number in selection context)
  if (currentState !== BotState.IDLE && isNumber(message)) {
    return "selection";
  }

  // Date intent
  if (isDate(message)) {
    return "date";
  }

  // Confirmation intent
  if (
    message.includes("тийм") ||
    message.includes("yes") ||
    message.includes("үгүй") ||
    message.includes("no") ||
    message.includes("зөв") ||
    message.includes("correct") ||
    message.includes("confirm")
  ) {
    return "confirmation";
  }

  // Cancellation intent
  if (
    message.includes("болих") ||
    message.includes("cancel") ||
    message.includes("цуцлах") ||
    message.includes("stop") ||
    message.includes("back")
  ) {
    return "cancellation";
  }

  // Help intent
  if (
    message.includes("тусламж") ||
    message.includes("help") ||
    message.includes("заавар") ||
    message.includes("how to")
  ) {
    return "help";
  }

  return "unknown";
}

/**
 * Extract structured data from message
 */
function extractStructuredData(
  message: string,
  expectedFormat?: ExpectedFormat
): InputClassification["extractedData"] {
  const data: InputClassification["extractedData"] = {};

  // Extract number
  const numberMatch = message.match(/\d+/);
  if (numberMatch) {
    data.number = parseInt(numberMatch[0], 10);
  }

  // Extract date
  const dateMatch = message.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (dateMatch) {
    data.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // Extract boolean
  if (message.includes("тийм") || message.toLowerCase().includes("yes")) {
    data.boolean = true;
  } else if (
    message.includes("үгүй") ||
    message.toLowerCase().includes("no")
  ) {
    data.boolean = false;
  }

  // Extract text (for conversational parts)
  const textMatch = message.match(/[а-яөүёА-ЯӨҮЁa-zA-Z\s]+/);
  if (textMatch) {
    data.text = textMatch[0].trim();
  }

  return data;
}

/**
 * Calculate confidence score for classification
 */
function calculateConfidence(
  type: InputType,
  intent: Intent,
  extractedData?: InputClassification["extractedData"]
): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence for clear types
  if (type === "STRUCTURED") {
    confidence += 0.3;
  } else if (type === "CONVERSATIONAL") {
    confidence += 0.2;
  }

  // Increase confidence for clear intents
  if (
    intent === "greeting" ||
    intent === "question" ||
    intent === "confirmation"
  ) {
    confidence += 0.2;
  }

  // Increase confidence if we extracted useful data
  if (extractedData && (extractedData.number || extractedData.date)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Decide whether to use FSM or AI for processing
 */
function decideRouting(
  type: InputType,
  intent: Intent,
  isFSMTrigger: boolean,
  currentState: BotState,
  extractedData?: InputClassification["extractedData"]
): { useFSM: boolean; useAI: boolean } {
  // Explicit FSM trigger always uses FSM
  if (isFSMTrigger) {
    return { useFSM: true, useAI: false };
  }

  // Structured input with clear data uses FSM
  if (type === "STRUCTURED" && extractedData) {
    return { useFSM: true, useAI: false };
  }

  // Conversational input uses AI
  if (type === "CONVERSATIONAL") {
    return { useFSM: false, useAI: true };
  }

  // Mixed input uses both
  if (type === "MIXED") {
    return { useFSM: true, useAI: true };
  }

  // Questions always use AI
  if (intent === "question") {
    return { useFSM: false, useAI: true };
  }

  // Greetings use AI
  if (intent === "greeting") {
    return { useFSM: false, useAI: true };
  }

  // Help requests use AI
  if (intent === "help") {
    return { useFSM: false, useAI: true };
  }

  // Default: use AI for better UX
  return { useFSM: false, useAI: true };
}

/**
 * Validate structured input against expected format
 */
export function validateStructuredInput(
  message: string,
  expectedFormat: ExpectedFormat
): ValidationResult {
  switch (expectedFormat) {
    case "NUMBER":
      return validateNumber(message);
    case "DATE":
      return validateDate(message);
    case "YES_NO":
      return validateYesNo(message);
    case "SELECTION":
      return validateSelection(message);
    case "ANY":
      return { isValid: true };
    default:
      return { isValid: false, error: "Unknown format" };
  }
}

/**
 * Validate number input
 */
function validateNumber(message: string): ValidationResult {
  const trimmed = message.trim();
  const number = parseInt(trimmed, 10);

  if (isNaN(number)) {
    return { isValid: false, error: "Тоо оруулна уу" };
  }

  if (number < 1) {
    return { isValid: false, error: "1-ээс их тоо оруулна уу" };
  }

  return { isValid: true, extractedValue: number };
}

/**
 * Validate date input
 */
function validateDate(message: string): ValidationResult {
  const trimmed = message.trim();
  const dateRegex = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;

  if (!dateRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Огноог YYYY-MM-DD форматаар оруулна уу",
    };
  }

  const [, year, month, day] = trimmed.match(dateRegex) || [];
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: "Буруу огноо байна",
    };
  }

  // Check if date is in the future
  const now = new Date();
  if (date < now) {
    return {
      isValid: false,
      error: "Өнгөрсөн огноо оруулсан байна",
    };
  }

  return { isValid: true, extractedValue: trimmed };
}

/**
 * Validate yes/no input
 */
function validateYesNo(message: string): ValidationResult {
  const trimmed = message.trim().toLowerCase();

  if (trimmed.includes("тийм") || trimmed.includes("yes")) {
    return { isValid: true, extractedValue: true };
  }

  if (trimmed.includes("үгүй") || trimmed.includes("no")) {
    return { isValid: true, extractedValue: false };
  }

  return {
    isValid: false,
    error: "Тийм/Үгүй эсвэл Yes/No сонгоно уу",
  };
}

/**
 * Validate selection input
 */
function validateSelection(message: string): ValidationResult {
  const trimmed = message.trim();
  const number = parseInt(trimmed, 10);

  if (isNaN(number)) {
    return { isValid: false, error: "Сонголтын дугаар оруулна уу" };
  }

  if (number < 1) {
    return { isValid: false, error: "1-ээс их дугаар оруулна уу" };
  }

  return { isValid: true, extractedValue: number };
}

// Helper functions
function isNumber(message: string): boolean {
  return /^\d+$/.test(message.trim());
}

function isDate(message: string): boolean {
  return /^(\d{4})[-/](\d{2})[-/](\d{2})$/.test(message.trim());
}

function isYesNo(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return (
    trimmed.includes("тийм") ||
    trimmed.includes("үгүй") ||
    trimmed.includes("yes") ||
    trimmed.includes("no")
  );
}

function isSelection(message: string): boolean {
  return isNumber(message);
}

function isQuestion(message: string): boolean {
  return (
    message.includes("?") ||
    message.endsWith("вэ") ||
    message.endsWith("уу") ||
    message.includes("юу") ||
    message.includes("ямар") ||
    message.includes("хэрхэн") ||
    message.includes("what") ||
    message.includes("how") ||
    message.includes("why") ||
    message.includes("which")
  );
}

function isGreeting(message: string): boolean {
  return (
    message.includes("сайн") ||
    message.includes("hello") ||
    message.includes("hi") ||
    message.includes("байна уу") ||
    message.includes("мэнд")
  );
}

function isConversational(message: string): boolean {
  // Check if it contains natural language elements
  const hasLetters = /[а-яөүёА-ЯӨҮЁa-zA-Z]/.test(message);
  const hasMultipleWords = message.split(/\s+/).length > 1;

  return hasLetters && (hasMultipleWords || isQuestion(message));
}