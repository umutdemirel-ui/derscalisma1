import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/database";
import { randomUUID } from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-secret-change-in-production-min-32-chars"
);

const SESSION_COOKIE_NAME = "session";
const SESSION_DAYS = 30;

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  email_verified: number;
  role: string;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionPayload {
  userId: string;
  sessionId: string;
  exp: number;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateSessionToken(): string {
  return randomUUID();
}

export async function createSession(userId: string, request?: Request): Promise<string> {
  const sessionId = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  let userAgent = "";
  let ip = "";
  if (request) {
    userAgent = request.headers.get("user-agent") || "";
    ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  }

  const db = await getDb();
  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, expiresAt.toISOString(), userAgent, ip);

  const token = await new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET);

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  const db = await getDb();

  // Login/register are disabled for this version. If a visitor has no session,
  // create a lightweight guest account automatically and persist a normal
  // session cookie so all existing user-scoped features keep working.
  if (!session) {
    const guestId = randomUUID();
    const suffix = guestId.replace(/-/g, "").slice(0, 12);
    const username = `Misafir_${suffix}`;
    const email = `guest-${suffix}@local.invalid`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, role, is_active, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(guestId, username, email, "guest-account", "Misafir Kullanıcı", "guest", now, now, now);

    const token = await createSession(guestId);
    setSessionCookie(token);

    return {
      id: guestId,
      username,
      email,
      display_name: "Misafir Kullanıcı",
      avatar: null,
      email_verified: 0,
      role: "guest",
      is_active: 1,
      created_at: now,
      last_login_at: now,
    };
  }

  const sessionRow = db.prepare(`
    SELECT s.*, u.id, u.username, u.email, u.display_name, u.avatar, u.email_verified, u.role, u.is_active, u.created_at, u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).get(session.sessionId) as (SessionPayload & User) | undefined;

  if (!sessionRow) return null;

  return {
    id: sessionRow.id,
    username: sessionRow.username,
    email: sessionRow.email,
    display_name: sessionRow.display_name,
    avatar: sessionRow.avatar,
    email_verified: sessionRow.email_verified,
    role: sessionRow.role,
    is_active: sessionRow.is_active,
    created_at: sessionRow.created_at,
    last_login_at: sessionRow.last_login_at,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function registerUser(username: string, email: string, password: string): Promise<User> {
  const db = await getDb();
  const existingUser = db.prepare("SELECT id FROM users WHERE email = ? OR username = ?").get(email, username);
  if (existingUser) {
    throw new Error("E-posta veya kullanıcı adı zaten kayıtlı");
  }

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, username, email, passwordHash, now, now);

  return {
    id: userId,
    username,
    email,
    display_name: null,
    avatar: null,
    email_verified: 0,
    role: "user",
    is_active: 1,
    created_at: now,
    last_login_at: null,
  };
}

export async function loginUser(email: string, password: string, request?: Request): Promise<{ user: User; token: string }> {
  const db = await getDb();
  const userRow = db.prepare(`
    SELECT id, username, email, password_hash, display_name, avatar, email_verified, role, is_active, created_at, last_login_at
    FROM users WHERE email = ?
  `).get(email) as User & { password_hash: string } | undefined;

  if (!userRow) {
    throw new Error("Geçersiz e-posta veya şifre");
  }

  if (!userRow.is_active) {
    throw new Error("Hesap devre dışı");
  }

  const valid = await verifyPassword(password, userRow.password_hash);
  if (!valid) {
    throw new Error("Geçersiz e-posta veya şifre");
  }

  const token = await createSession(userRow.id, request);

  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), userRow.id);

  const { password_hash, ...user } = userRow;
  return { user, token };
}

export async function logoutUser(): Promise<void> {
  const session = await getSession();
  if (session) {
    await deleteSession(session.sessionId);
  }
  await clearSessionCookie();
}

export function setSessionCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Şifre en az 8 karakter olmalı" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Şifre en az 1 büyük harf içermeli" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Şifre en az 1 küçük harf içermeli" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Şifre en az 1 rakam içermeli" };
  }
  return { valid: true };
}

export function validateUsername(username: string): { valid: boolean; message?: string } {
  if (username.length < 3) {
    return { valid: false, message: "Kullanıcı adı en az 3 karakter olmalı" };
  }
  if (username.length > 30) {
    return { valid: false, message: "Kullanıcı adı en fazla 30 karakter olmalı" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, message: "Kullanıcı adı sadece harf, rakam, _ ve - içerebilir" };
  }
  return { valid: true };
}