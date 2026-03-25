/**
 * 3-layer chat input sanitizer:
 * Layer 1: Profanity filter (basic word list + patterns)
 * Layer 2: Context check (length, spam, repeated chars)
 * Layer 3: Injection detection (code injection, prompt injection)
 */

/** Result of sanitization */
export interface SanitizeResult {
  safe: boolean;
  cleaned: string;
  reason?: string;
}

// --- Layer 1: Profanity Filter ---

/**
 * Common profanity patterns (kept minimal — extend via config).
 * Uses regex boundaries to avoid false positives on substrings.
 */
const PROFANITY_PATTERNS: RegExp[] = [
  /\bf+u+c+k+\w*/gi,
  /\bs+h+i+t+\w*/gi,
  /\ba+s+s+h+o+l+e+/gi,
  /\bb+i+t+c+h+\w*/gi,
  /\bn+i+g+g+\w*/gi,
  /\bf+a+g+g*o*t*/gi,
  /\bc+u+n+t+/gi,
  /\br+e+t+a+r+d+\w*/gi,
  /\bk+y+s+\b/gi,
  /\bk+i+l+l\s*y+o+u+r+s+e+l+f+/gi,
];

function containsProfanity(text: string): boolean {
  return PROFANITY_PATTERNS.some((p) => p.test(text));
}

function censorProfanity(text: string): string {
  let cleaned = text;
  for (const pattern of PROFANITY_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match) => "*".repeat(match.length));
  }
  return cleaned;
}

// --- Layer 2: Context Check ---

const MAX_MESSAGE_LENGTH = 300;
const MAX_REPEAT_CHAR = 8;
const MAX_CAPS_RATIO = 0.8;
const MIN_MESSAGE_LENGTH = 1;

interface ContextIssue {
  type: "too_long" | "too_short" | "spam_chars" | "all_caps" | "repeated_message";
  reason: string;
}

function checkContext(text: string): ContextIssue | null {
  if (text.length < MIN_MESSAGE_LENGTH) {
    return { type: "too_short", reason: "Message too short" };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { type: "too_long", reason: "Message too long (max 300 chars)" };
  }

  // Repeated character spam (e.g., "aaaaaaaaa")
  const repeatRegex = new RegExp(`(.)\\1{${MAX_REPEAT_CHAR},}`, "g");
  if (repeatRegex.test(text)) {
    return { type: "spam_chars", reason: "Excessive repeated characters" };
  }

  // All caps check (for messages with at least 10 alphabetic chars)
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 10) {
    const upperCount = alphaChars.replace(/[^A-Z]/g, "").length;
    if (upperCount / alphaChars.length > MAX_CAPS_RATIO) {
      return { type: "all_caps", reason: "Excessive caps" };
    }
  }

  return null;
}

// --- Layer 3: Injection Detection ---

const INJECTION_PATTERNS: RegExp[] = [
  // Script/HTML injection
  /<\s*script/gi,
  /<\s*img[^>]+onerror/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,

  // SQL injection
  /('\s*(OR|AND)\s+')/gi,
  /(UNION\s+SELECT|DROP\s+TABLE|DELETE\s+FROM)/gi,

  // Prompt injection (LLM manipulation)
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /\bact\s+as\b.*\b(admin|root|system)\b/gi,
];

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

// --- Main Sanitize Function ---

/**
 * 3-layer sanitizer pipeline.
 * Returns { safe, cleaned, reason }.
 * - Layer 1 censors profanity but still allows the message (safe=true, cleaned text).
 * - Layer 2 rejects messages with structural issues (safe=false).
 * - Layer 3 rejects injection attempts (safe=false).
 */
export function sanitize(raw: string): SanitizeResult {
  const trimmed = raw.trim();

  // Layer 2: Context check first (cheapest)
  const contextIssue = checkContext(trimmed);
  if (contextIssue) {
    return { safe: false, cleaned: trimmed, reason: contextIssue.reason };
  }

  // Layer 3: Injection detection
  if (detectInjection(trimmed)) {
    return { safe: false, cleaned: trimmed, reason: "Potential injection detected" };
  }

  // Layer 1: Profanity — censor but allow
  if (containsProfanity(trimmed)) {
    return { safe: true, cleaned: censorProfanity(trimmed) };
  }

  return { safe: true, cleaned: trimmed };
}
