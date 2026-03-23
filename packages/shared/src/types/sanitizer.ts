/** Sanitizer pipeline layers (security-spec.md S3) */
export type SanitizerLayer = "regex" | "ai_classifier" | "operator_review";

/** Sanitizer verdict */
export type SanitizerVerdict = "pass" | "reject" | "review";

/** Result of sanitizer pipeline (security-spec.md S3) */
export interface SanitizerResult {
  input: string;
  verdict: SanitizerVerdict;
  rejectedBy: SanitizerLayer | null;
  reason: string | null;
  confidence: number | null; // For AI layer, 0.0-1.0
  sanitizedOutput: string | null; // Cleaned version if passed
}
