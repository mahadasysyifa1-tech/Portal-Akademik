import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
}

export interface FirebaseAuthError extends Error {
  status: number;
}

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: VerifiedFirebaseUser;
    }
  }
}

function createAuthError(message: string, status: number): FirebaseAuthError {
  const err = new Error(message) as FirebaseAuthError;
  err.status = status;
  return err;
}

function resolveFirebaseProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed?.projectId && typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // Fall back to FIREBASE_PROJECT_ID environment variable
  }

  return (process.env.FIREBASE_PROJECT_ID || '').trim();
}

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw createAuthError('Konfigurasi Firebase projectId tidak tersedia.', 500);
  }

  return initializeApp({ projectId });
}

export async function verifyFirebaseRequest(req: Request): Promise<VerifiedFirebaseUser> {
  const rawAuthHeader = Array.isArray(req.headers?.authorization)
    ? req.headers.authorization[0]
    : req.headers?.authorization;

  if (!rawAuthHeader || typeof rawAuthHeader !== 'string') {
    throw createAuthError('Token otorisasi Bearer tidak ditemukan.', 401);
  }

  const match = rawAuthHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim();
  if (!idToken) {
    throw createAuthError('Format header Authorization harus Bearer <token>.', 401);
  }

  const app = getFirebaseAdminApp();
  let decoded;
  try {
    decoded = await getAuth(app).verifyIdToken(idToken);
  } catch {
    throw createAuthError('Token Firebase tidak valid atau sudah kedaluwarsa.', 401);
  }

  const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
  if (!email || decoded.email_verified !== true) {
    throw createAuthError('Email akun Google belum terverifikasi.', 403);
  }

  return {
    uid: decoded.uid,
    email,
  };
}

export async function requireFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.firebaseUser = await verifyFirebaseRequest(req);
    next();
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 401;
    res.status(status).json({
      error: err?.message || 'Autentikasi Firebase gagal.',
    });
  }
}
