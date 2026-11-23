import type { NextFunction, Request, Response } from 'express';
import { tursoClient } from '../db/index.ts';
import { requireFirebaseAuth, verifyFirebaseRequest } from './firebaseAuth.ts';

export interface AppUserIdentity {
  uid: string;
  email: string;
  role: string;
  teacherId: string | null;
  studentId: string | null;
  classId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUserIdentity;
    }
  }
}

export function isAuthEnforced(): boolean {
  if (process.env.ENFORCE_AUTH === 'true') {
    return true;
  }
  if (process.env.ENFORCE_AUTH === 'false') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (isAuthEnforced()) {
    await requireFirebaseAuth(req, res, next);
    return;
  }

  try {
    req.firebaseUser = await verifyFirebaseRequest(req);
  } catch {
    // When auth enforcement is disabled, allow unauthenticated or invalid-token requests through
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isAuthEnforced()) {
      next();
      return;
    }

    let userVerified = false;
    await requireUser(req, res, (err?: unknown) => {
      if (!err) {
        userVerified = true;
      } else {
        next(err);
      }
    });

    if (!userVerified || !req.firebaseUser) {
      return;
    }

    if (!tursoClient) {
      res.status(503).json({ error: 'Turso database is offline' });
      return;
    }

    try {
      const verifiedEmail = req.firebaseUser.email;
      const result = await tursoClient.execute({
        sql: 'SELECT uid, email, role, teacher_id, student_id, class_id FROM app_users WHERE LOWER(email) = ? LIMIT 1',
        args: [verifiedEmail],
      });

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Akun belum terdaftar.' });
        return;
      }

      const row = result.rows[0];
      const role = String(row.role || 'guest');

      if (!roles.includes(role)) {
        res.status(403).json({ error: 'Akses ditolak untuk peran ini.' });
        return;
      }

      req.appUser = {
        uid: String(row.uid || ''),
        email: String(row.email || verifiedEmail).trim().toLowerCase(),
        role,
        teacherId: row.teacher_id ? String(row.teacher_id) : null,
        studentId: row.student_id ? String(row.student_id) : null,
        classId: row.class_id ? String(row.class_id) : null,
      };

      next();
    } catch (err) {
      console.error('Failed to verify user role:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gagal memverifikasi peran akun.' });
      }
    }
  };
}
