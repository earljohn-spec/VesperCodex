import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { execute, newId, nowIso, queryOne, parseJson } from "./db";
import type { User } from "./types";

const SESSION_COOKIE = "vesper_session";
const SESSION_DAYS = 30;

const secretKey = new TextEncoder().encode(
  process.env.VESPER_AUTH_SECRET ??
    "vesper-dev-secret-please-override-in-production-0123456789abcdef",
);

/* ------------------------------ passwords ------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, digest] = stored.split(":");
    if (scheme !== "scrypt" || !salt || !digest) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(digest, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ------------------------------- sessions ------------------------------ */

interface DbUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  avatar_hue: number;
  timezone: string;
  focus_areas: string;
  onboarded: number;
  created_at: string;
  updated_at: string;
}

export function mapUser(row: DbUserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarHue: row.avatar_hue,
    timezone: row.timezone,
    focusAreas: parseJson<string[]>(row.focus_areas, []),
    onboarded: row.onboarded === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function signSessionToken(sessionId: string, userId: string) {
  return new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey);
}

export async function createSession(userId: string) {
  const id = newId("sess");
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400_000);
  execute(
    `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, created.toISOString(), expires.toISOString()],
  );
  const token = await signSessionToken(id, userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return id;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      if (payload.sid) execute(`DELETE FROM sessions WHERE id = ?`, [payload.sid as string]);
    } catch {
      /* token already invalid */
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    const sid = payload.sid as string | undefined;
    const uid = payload.sub as string | undefined;
    if (!sid || !uid) return null;

    const session = queryOne<{ id: string; expires_at: string }>(
      `SELECT id, expires_at FROM sessions WHERE id = ? AND user_id = ?`,
      [sid, uid],
    );
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      execute(`DELETE FROM sessions WHERE id = ?`, [sid]);
      return null;
    }

    const row = queryOne<DbUserRow>(`SELECT * FROM users WHERE id = ?`, [uid]);
    return row ? mapUser(row) : null;
  } catch {
    return null;
  }
}

/** Use inside route handlers / server actions that require a user. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated");
  return user;
}

export class AuthError extends Error {
  status = 401;
}

/* ------------------------------- accounts ------------------------------ */

export function findUserByEmail(email: string) {
  return queryOne<DbUserRow>(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
}

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  focusAreas?: string[];
  timezone?: string;
}) {
  const id = newId("usr");
  const ts = nowIso();
  const hue = 200 + Math.floor(Math.random() * 140);
  execute(
    `INSERT INTO users (id, email, name, password_hash, avatar_hue, timezone, focus_areas, onboarded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.email.toLowerCase().trim(),
      input.name.trim(),
      hashPassword(input.password),
      hue,
      input.timezone ?? "UTC",
      JSON.stringify(input.focusAreas ?? []),
      ts,
      ts,
    ],
  );
  return queryOne<DbUserRow>(`SELECT * FROM users WHERE id = ?`, [id])!;
}
