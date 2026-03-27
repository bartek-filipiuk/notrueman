import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "24h";
const LOGIN_WINDOW_MS = 60_000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;

/** Per-IP login attempt tracking */
const loginAttempts = new Map<string, { count: number; windowStart: number }>();

export interface AdminAuthConfig {
  /** Hashed admin password (bcrypt) */
  passwordHash: string;
  /** JWT secret (min 32 chars) */
  jwtSecret: string;
}

/**
 * Hash a plaintext password with bcrypt.
 * Used during setup to generate the stored hash.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Create a JWT token for admin access.
 */
export function createToken(secret: string): string {
  return jwt.sign({ role: "admin" }, secret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify a JWT token. Returns true if valid, false otherwise.
 */
export function verifyToken(token: string, secret: string): boolean {
  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check and update login rate limit for an IP.
 * Returns true if the attempt is allowed, false if rate-limited.
 */
export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Validate JWT_SECRET on startup. Must be at least 32 characters.
 */
export function validateJWTSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters. Set it in .env file.",
    );
  }
  return secret;
}

/**
 * Initialize admin auth from environment variables.
 * - ADMIN_PASSWORD: plaintext password (hashed on first use)
 * - JWT_SECRET: secret for signing JWT tokens (min 32 chars)
 */
export async function initAdminAuth(): Promise<AdminAuthConfig> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set in .env file.");
  }

  const jwtSecret = validateJWTSecret(process.env.JWT_SECRET);
  const passwordHash = await hashPassword(password);

  return { passwordHash, jwtSecret };
}
