import type { Client } from '@libsql/client';

export type UserRole = 'admin' | 'teacher' | 'student' | 'guest';

export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  teacherId?: string;
  studentId?: string;
  classId?: string;
  teacherName?: string;
  studentName?: string;
  // Role Request Metadata
  requestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  requestedRole?: 'teacher' | 'student';
  requestedPersonId?: string;
  requestedPersonName?: string;
  requestedAt?: string;
}

export interface RoleRequestItem {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  requestedRole: 'teacher' | 'student';
  requestedPersonId: string;
  requestedPersonName: string;
  requestedPersonCode?: string;
  existingTursoEmail?: string;
  requestedAt: string;
  isConflicted: boolean;
  conflictingEmails: string[];
}

const SUPER_ADMIN_EMAIL = 'mahadasysyifa1@gmail.com'.toLowerCase();

export async function syncUserWithTurso(
  client: Client,
  payload: { uid: string; email: string; displayName?: string; photoURL?: string }
): Promise<AppUserProfile> {
  const email = (payload.email || '').trim().toLowerCase();
  const uid = payload.uid;
  const displayName = payload.displayName || email.split('@')[0] || 'Pengguna';
  const photoURL = payload.photoURL || '';

  if (!email || !uid) {
    throw new Error('Email and UID are required for authentication synchronization.');
  }

  let role: UserRole = 'guest';
  let teacherId: string | undefined = undefined;
  let studentId: string | undefined = undefined;
  let classId: string | undefined = undefined;
  let teacherName: string | undefined = undefined;
  let studentName: string | undefined = undefined;

  // 1. Super Admin Check
  if (email === SUPER_ADMIN_EMAIL) {
    role = 'admin';
  }

  // 2. Teacher Match in Turso
  try {
    const teacherRes = await client.execute({
      sql: 'SELECT id, name, display_code, email FROM teachers WHERE LOWER(email) = ? LIMIT 1',
      args: [email],
    });
    if (teacherRes.rows.length > 0) {
      const row = teacherRes.rows[0];
      teacherId = String(row.id);
      teacherName = String(row.name);
      if (role !== 'admin') {
        role = 'teacher';
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [Turso Auth] Teacher lookup note:', err?.message);
  }

  // 3. Student Match in Turso (if not admin or teacher)
  if (role === 'guest') {
    try {
      const studentRes = await client.execute({
        sql: 'SELECT id, name, email FROM students WHERE LOWER(email) = ? LIMIT 1',
        args: [email],
      });
      if (studentRes.rows.length > 0) {
        const row = studentRes.rows[0];
        studentId = String(row.id);
        studentName = String(row.name);
        role = 'student';

        // Find student's active enrolled class
        const enrollRes = await client.execute({
          sql: 'SELECT class_id FROM attnd_enroll WHERE student_id = ? AND active = 1 LIMIT 1',
          args: [studentId],
        });
        if (enrollRes.rows.length > 0) {
          classId = String(enrollRes.rows[0].class_id);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Turso Auth] Student lookup note:', err?.message);
    }
  }

  // Read existing request state if any
  let requestStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';
  let requestedRole: 'teacher' | 'student' | undefined = undefined;
  let requestedPersonId: string | undefined = undefined;
  let requestedPersonName: string | undefined = undefined;
  let requestedAt: string | undefined = undefined;

  try {
    const existingRes = await client.execute({
      sql: `SELECT requested_role, requested_person_id, request_status, requested_at
            FROM app_users WHERE email = ? OR uid = ? LIMIT 1`,
      args: [email, uid],
    });
    if (existingRes.rows.length > 0) {
      const ex = existingRes.rows[0];
      requestStatus = (ex.request_status as any) || 'none';
      requestedRole = ex.requested_role ? (String(ex.requested_role) as 'teacher' | 'student') : undefined;
      requestedPersonId = ex.requested_person_id ? String(ex.requested_person_id) : undefined;
      requestedAt = ex.requested_at ? String(ex.requested_at) : undefined;
    }
  } catch (err: any) {
    console.warn('⚠️ [Turso Auth] Existing user request lookup note:', err?.message);
  }

  // If user is matched to teacher/student in Turso and previously had a pending request, mark it approved
  if (role === 'teacher' || role === 'student') {
    if (requestStatus === 'pending') {
      requestStatus = 'approved';
    }
  }

  // 4. Upsert into Turso app_users table (authoritative mirror)
  try {
    await client.execute({
      sql: `INSERT INTO app_users (uid, email, display_name, photo_url, role, teacher_id, student_id, class_id, request_status, last_login_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(email) DO UPDATE SET
              uid = excluded.uid,
              display_name = excluded.display_name,
              photo_url = excluded.photo_url,
              role = excluded.role,
              teacher_id = excluded.teacher_id,
              student_id = excluded.student_id,
              class_id = excluded.class_id,
              request_status = CASE WHEN app_users.request_status IS NOT NULL THEN app_users.request_status ELSE excluded.request_status END,
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        uid,
        email,
        displayName,
        photoURL || null,
        role,
        teacherId || null,
        studentId || null,
        classId || null,
        requestStatus,
      ],
    });
  } catch (err: any) {
    console.error('❌ [Turso Auth] Failed to upsert app_users:', err?.message);
  }

  // Resolve requested person name if present
  if (requestedPersonId && requestedRole) {
    try {
      if (requestedRole === 'teacher') {
        const t = await client.execute({ sql: 'SELECT name FROM teachers WHERE id = ? LIMIT 1', args: [requestedPersonId] });
        if (t.rows.length > 0) requestedPersonName = String(t.rows[0].name);
      } else if (requestedRole === 'student') {
        const s = await client.execute({ sql: 'SELECT name FROM students WHERE id = ? LIMIT 1', args: [requestedPersonId] });
        if (s.rows.length > 0) requestedPersonName = String(s.rows[0].name);
      }
    } catch {}
  }

  return {
    uid,
    email,
    displayName,
    photoURL,
    role,
    teacherId,
    studentId,
    classId,
    teacherName,
    studentName,
    requestStatus,
    requestedRole,
    requestedPersonId,
    requestedPersonName,
    requestedAt,
  };
}

export async function getUserProfileByUid(
  client: Client,
  uid: string
): Promise<AppUserProfile | null> {
  if (!uid) return null;
  try {
    const res = await client.execute({
      sql: `SELECT u.uid, u.email, u.display_name, u.photo_url, u.role, u.teacher_id, u.student_id, u.class_id,
                   u.requested_role, u.requested_person_id, u.request_status, u.requested_at,
                   t.name as teacher_name, s.name as student_name
            FROM app_users u
            LEFT JOIN teachers t ON t.id = u.teacher_id
            LEFT JOIN students s ON s.id = u.student_id
            WHERE u.uid = ? LIMIT 1`,
      args: [uid],
    });

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const email = String(row.email || '').toLowerCase();
    let role = (row.role as UserRole) || 'guest';
    if (email === SUPER_ADMIN_EMAIL) {
      role = 'admin';
    }

    const requestedRole = row.requested_role ? (String(row.requested_role) as 'teacher' | 'student') : undefined;
    const requestedPersonId = row.requested_person_id ? String(row.requested_person_id) : undefined;
    let requestedPersonName: string | undefined = undefined;

    if (requestedRole && requestedPersonId) {
      try {
        if (requestedRole === 'teacher') {
          const t = await client.execute({ sql: 'SELECT name FROM teachers WHERE id = ? LIMIT 1', args: [requestedPersonId] });
          if (t.rows.length > 0) requestedPersonName = String(t.rows[0].name);
        } else {
          const s = await client.execute({ sql: 'SELECT name FROM students WHERE id = ? LIMIT 1', args: [requestedPersonId] });
          if (s.rows.length > 0) requestedPersonName = String(s.rows[0].name);
        }
      } catch {}
    }

    return {
      uid: String(row.uid),
      email: String(row.email),
      displayName: String(row.display_name || row.email),
      photoURL: row.photo_url ? String(row.photo_url) : undefined,
      role,
      teacherId: row.teacher_id ? String(row.teacher_id) : undefined,
      studentId: row.student_id ? String(row.student_id) : undefined,
      classId: row.class_id ? String(row.class_id) : undefined,
      teacherName: row.teacher_name ? String(row.teacher_name) : undefined,
      studentName: row.student_name ? String(row.student_name) : undefined,
      requestStatus: (row.request_status as any) || 'none',
      requestedRole,
      requestedPersonId,
      requestedPersonName,
      requestedAt: row.requested_at ? String(row.requested_at) : undefined,
    };
  } catch (err: any) {
    console.error('❌ [Turso Auth] Error retrieving user profile by UID:', err?.message);
    return null;
  }
}

/**
 * Guest user submits a role request (Guru or Santri)
 */
export async function requestUserRole(
  client: Client,
  uid: string,
  requestedRole: 'teacher' | 'student',
  requestedPersonId: string
): Promise<AppUserProfile> {
  if (!uid || !requestedRole || !requestedPersonId) {
    throw new Error('Data pengajuan tidak lengkap.');
  }

  // Verify target person exists in Turso
  let targetName = '';
  if (requestedRole === 'teacher') {
    const res = await client.execute({ sql: 'SELECT id, name FROM teachers WHERE id = ? LIMIT 1', args: [requestedPersonId] });
    if (res.rows.length === 0) throw new Error('Guru yang dipilih tidak ditemukan.');
    targetName = String(res.rows[0].name);
  } else {
    const res = await client.execute({ sql: 'SELECT id, name FROM students WHERE id = ? LIMIT 1', args: [requestedPersonId] });
    if (res.rows.length === 0) throw new Error('Santri yang dipilih tidak ditemukan.');
    targetName = String(res.rows[0].name);
  }

  // Update app_users
  await client.execute({
    sql: `UPDATE app_users
          SET requested_role = ?, requested_person_id = ?, request_status = 'pending', requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE uid = ?`,
    args: [requestedRole, requestedPersonId, uid],
  });

  const updatedProfile = await getUserProfileByUid(client, uid);
  if (!updatedProfile) {
    throw new Error('Gagal memperbarui profil pengguna.');
  }
  return updatedProfile;
}

/**
 * Fetch all pending role requests with conflict detection
 */
export async function getPendingRoleRequests(client: Client): Promise<{ requests: RoleRequestItem[]; count: number }> {
  try {
    const res = await client.execute(`
      SELECT u.uid, u.email, u.display_name, u.photo_url, u.requested_role, u.requested_person_id, u.requested_at,
             t.name as teacher_name, t.display_code as teacher_code, t.email as teacher_email,
             s.name as student_name, s.nisn as student_code, s.email as student_email
      FROM app_users u
      LEFT JOIN teachers t ON (u.requested_role = 'teacher' AND t.id = u.requested_person_id)
      LEFT JOIN students s ON (u.requested_role = 'student' AND s.id = u.requested_person_id)
      WHERE u.request_status = 'pending'
      ORDER BY u.requested_at ASC
    `);

    // Group by target figure (role + person_id) to identify disputing/conflicting requests
    const grouped = new Map<string, Array<{ uid: string; email: string }>>();
    for (const row of res.rows) {
      const key = `${String(row.requested_role)}:${String(row.requested_person_id)}`;
      const list = grouped.get(key) || [];
      list.push({ uid: String(row.uid), email: String(row.email) });
      grouped.set(key, list);
    }

    const items: RoleRequestItem[] = res.rows.map((row) => {
      const key = `${String(row.requested_role)}:${String(row.requested_person_id)}`;
      const sameTarget = grouped.get(key) || [];
      const isConflicted = sameTarget.length > 1;
      const conflictingEmails = sameTarget
        .filter((x) => x.uid !== String(row.uid))
        .map((x) => x.email);

      const isTeacher = String(row.requested_role) === 'teacher';
      const personName = isTeacher ? String(row.teacher_name || 'Guru') : String(row.student_name || 'Santri');
      const personCode = isTeacher ? (row.teacher_code ? String(row.teacher_code) : undefined) : (row.student_code ? String(row.student_code) : undefined);
      const existingTursoEmail = isTeacher ? (row.teacher_email ? String(row.teacher_email) : undefined) : (row.student_email ? String(row.student_email) : undefined);

      return {
        uid: String(row.uid),
        email: String(row.email),
        displayName: String(row.display_name || row.email),
        photoURL: row.photo_url ? String(row.photo_url) : undefined,
        requestedRole: isTeacher ? 'teacher' : 'student',
        requestedPersonId: String(row.requested_person_id),
        requestedPersonName: personName,
        requestedPersonCode: personCode,
        existingTursoEmail,
        requestedAt: String(row.requested_at || new Date().toISOString()),
        isConflicted,
        conflictingEmails,
      };
    });

    return {
      requests: items,
      count: items.length,
    };
  } catch (err: any) {
    console.error('❌ [Turso Auth] Error getting pending requests:', err?.message);
    return { requests: [], count: 0 };
  }
}

/**
 * Approve role request with Safety Guard against conflicting requests:
 * If 2 or more users requested the same role and person, admin MUST manually reject
 * conflicting requests until only 1 remains before approval is permitted.
 */
export async function approveRoleRequest(
  client: Client,
  targetUid: string
): Promise<{
  success: boolean;
  message: string;
  role: 'teacher' | 'student';
  personId: string;
  personName: string;
  email: string;
}> {
  if (!targetUid) throw new Error('Target UID is required.');

  // Find target request
  const userRes = await client.execute({
    sql: `SELECT uid, email, display_name, requested_role, requested_person_id, request_status
          FROM app_users
          WHERE uid = ? AND request_status = 'pending' LIMIT 1`,
    args: [targetUid],
  });

  if (userRes.rows.length === 0) {
    throw new Error('Pengajuan tidak ditemukan atau sudah tidak berstatus pending.');
  }

  const reqRow = userRes.rows[0];
  const email = String(reqRow.email).trim().toLowerCase();
  const requestedRole = String(reqRow.requested_role) as 'teacher' | 'student';
  const personId = String(reqRow.requested_person_id);

  // Safety Guard: Check if there are other pending requests for the same target person
  const conflictRes = await client.execute({
    sql: `SELECT uid, email FROM app_users
          WHERE request_status = 'pending'
            AND requested_role = ?
            AND requested_person_id = ?`,
    args: [requestedRole, personId],
  });

  if (conflictRes.rows.length > 1) {
    const disputingEmails = conflictRes.rows
      .map((r) => String(r.email))
      .filter((e) => e !== email);

    throw new Error(
      `Sengketa Akun: Figur ini juga sedang diajukan oleh (${disputingEmails.join(', ')}). ` +
      `Admin wajib menolak pengajuan yang tidak sesuai terlebih dahulu hingga hanya tersisa 1 pengajuan untuk figur ini.`
    );
  }

  let personName = '';

  // 1. Tautkan email langsung ke tabel Turso
  if (requestedRole === 'teacher') {
    const tCheck = await client.execute({
      sql: 'SELECT id, name FROM teachers WHERE id = ? LIMIT 1',
      args: [personId],
    });
    if (tCheck.rows.length === 0) throw new Error('Data guru tidak ditemukan di Turso.');
    personName = String(tCheck.rows[0].name);

    await client.execute({
      sql: 'UPDATE teachers SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [email, personId],
    });

    await client.execute({
      sql: `UPDATE app_users
            SET role = 'teacher', teacher_id = ?, request_status = 'approved', updated_at = CURRENT_TIMESTAMP
            WHERE uid = ?`,
      args: [personId, targetUid],
    });
  } else if (requestedRole === 'student') {
    const sCheck = await client.execute({
      sql: 'SELECT id, name FROM students WHERE id = ? LIMIT 1',
      args: [personId],
    });
    if (sCheck.rows.length === 0) throw new Error('Data santri tidak ditemukan di Turso.');
    personName = String(sCheck.rows[0].name);

    await client.execute({
      sql: 'UPDATE students SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [email, personId],
    });

    // Check class enrollment
    let classId: string | null = null;
    const enrollRes = await client.execute({
      sql: 'SELECT class_id FROM attnd_enroll WHERE student_id = ? AND active = 1 LIMIT 1',
      args: [personId],
    });
    if (enrollRes.rows.length > 0) {
      classId = String(enrollRes.rows[0].class_id);
    }

    await client.execute({
      sql: `UPDATE app_users
            SET role = 'student', student_id = ?, class_id = ?, request_status = 'approved', updated_at = CURRENT_TIMESTAMP
            WHERE uid = ?`,
      args: [personId, classId, targetUid],
    });
  }

  return {
    success: true,
    message: `Berhasil menyetujui pengajuan akun untuk ${email} sebagai ${personName}.`,
    role: requestedRole,
    personId,
    personName,
    email,
  };
}

/**
 * Update display_code for teachers or students, enforcing ownership or admin permission.
 */
export async function updatePeopleDisplayCodes(
  client: Client,
  actorUid: string,
  updates: Array<{ personType: 'teacher' | 'student'; personId: string; displayCode: string }>
): Promise<{ success: boolean; updatedCount: number }> {
  if (!actorUid) {
    throw new Error('Autentikasi diperlukan.');
  }
  const actorRes = await client.execute({
    sql: 'SELECT uid, role, teacher_id, student_id FROM app_users WHERE uid = ? LIMIT 1',
    args: [actorUid],
  });
  if (actorRes.rows.length === 0) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }
  const actor = actorRes.rows[0];
  const actorRole = String(actor.role || 'guest');
  const actorTeacherId = actor.teacher_id ? String(actor.teacher_id) : '';
  const actorStudentId = actor.student_id ? String(actor.student_id) : '';

  const statements: Array<{ sql: string; args: any[] }> = [];
  for (const item of updates) {
    if (!item || !item.personId || (item.personType !== 'teacher' && item.personType !== 'student')) {
      continue;
    }
    const isAllowed =
      actorRole === 'admin' ||
      (item.personType === 'teacher' && actorRole === 'teacher' && actorTeacherId === item.personId) ||
      (item.personType === 'student' && actorRole === 'student' && actorStudentId === item.personId);

    if (!isAllowed) {
      throw new Error('Anda tidak memiliki izin untuk mengubah kode tampilan entitas ini.');
    }

    const trimmed = String(item.displayCode ?? '').trim();
    const table = item.personType === 'teacher' ? 'teachers' : 'students';
    statements.push({
      sql: `UPDATE ${table} SET display_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [trimmed === '' ? '' : trimmed, item.personId],
    });
  }

  if (statements.length > 0) {
    await client.batch(statements as any, 'write');
  }

  return { success: true, updatedCount: statements.length };
}

/**
 * Reject role request
 */
export async function rejectRoleRequest(
  client: Client,
  targetUid: string
): Promise<{ success: boolean; message: string }> {
  if (!targetUid) throw new Error('Target UID is required.');

  const res = await client.execute({
    sql: `UPDATE app_users
          SET request_status = 'rejected', updated_at = CURRENT_TIMESTAMP
          WHERE uid = ?`,
    args: [targetUid],
  });

  return {
    success: true,
    message: 'Pengajuan akun telah ditolak.',
  };
}
