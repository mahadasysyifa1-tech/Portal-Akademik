import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  ensureDataSeeded,
  getDatabaseState,
  saveDatabaseState,
  resetDatabaseState,
  tursoClient,
  METADATA_SCHEMA_SQL,
  KALDIK_SCHEMA_SQL,
  UNIFIED_SCHEMA_SQL,
} from './server/db/index.ts';
import {
  getOrCreateDayMeetings,
  getMonthAttendanceSummary,
  getMonthMeetings,
  batchSaveAttendance,
  refreshAllMonthCache,
  getMeetingRollCall,
  saveMeetingRollCall,
  updateMeetingStatus,
  getEnrollmentOverview,
  quickAssignStudentToClass,
  quickUnassignStudentFromClass,
  upsertStudent,
  deleteStudentRecord,
  saveAllEnrollmentData,
  generateAllRuleMeetings,
} from './server/db/attendance.ts';

const app = express();
const PORT = 3000;
app.use(express.json({ limit: '10mb' }));

// Seed & verify database on startup
ensureDataSeeded().catch((err) => {
  console.error('Database initialization error:', err);
});

// Health Check
app.get('/api/health', (req, res) => {
  const isConfigured = Boolean(
    (process.env.TURSO_METADATA_URL || process.env.TURSO_DATABASE_URL) &&
    (process.env.TURSO_METADATA_TOKEN || process.env.TURSO_AUTH_TOKEN)
  );
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    engine: 'turso-libsql-unified',
    tursoConfigured: isConfigured,
    tursoMetadataConfigured: isConfigured,
    database: 'ijma-metadata (unified)',
  });
});

// Primary data endpoints for Portal Akademik (Turso Cloud SQL + SQLite fallback)
app.get('/api/database', async (req, res) => {
  try {
    const data = await getDatabaseState();
    res.json(data);
  } catch (err: any) {
    console.error('Database read error:', err);
    res.status(500).json({ error: 'Failed to read database', details: err?.message });
  }
});

app.post('/api/database/save', async (req, res) => {
  const newData = req.body;
  if (!newData || !newData.subjects) {
    return res.status(400).json({ error: 'Invalid database structure' });
  }
  try {
    await saveDatabaseState(newData);

    // Read back from Turso so the client can confirm what was actually stored
    const saved = await getDatabaseState();
    const counts = {
      subjects: saved.subjects.length,
      classes: saved.classes.length,
      teachers: saved.teachers.length,
      rooms: saved.rooms.length,
      sessions: saved.sessions.length,
      periods: saved.periods.length,
      rules: saved.rules.length,
      kaldikEvents: (saved.kaldikEvents || []).length,
      books: (saved.books || []).length,
      syllabusUnits: (saved.syllabusUnits || []).length,
      syllabusScopes: (saved.syllabusScopes || []).length,
    };
    res.json({ success: true, savedAt: new Date().toISOString(), counts });
  } catch (err: any) {
    console.error('Database write error:', err);
    res.status(500).json({ error: 'Failed to write to database', details: err?.message });
  }
});
app.post('/api/database/reset', async (req, res) => {
  try {
    await resetDatabaseState();
    const data = await getDatabaseState();
    res.json({ success: true, message: 'Databases reset to initial template', data });
  } catch (err: any) {
    console.error('Database reset error:', err);
    res.status(500).json({ error: 'Failed to reset database', details: err?.message });
  }
});

// ============================================================================
// Attendance (Presensi Terpadu) Endpoints
// ============================================================================
app.get('/api/attendance/month-summary', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const summary = await getMonthAttendanceSummary(tursoClient, year, month);
    res.json(summary);
  } catch (err: any) {
    console.error('Failed to get attendance month summary:', err);
    res.status(500).json({ error: 'Failed to get month summary', details: err?.message });
  }
});

app.get('/api/attendance/month-meetings', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const padMonth = String(month).padStart(2, '0');
    const startDate = `${year}-${padMonth}-01`;
    const endDate = `${year}-${padMonth}-31`;
    const meetings = await getMonthMeetings(tursoClient, startDate, endDate);
    res.json(meetings);
  } catch (err: any) {
    console.error('Failed to get month meetings:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to get month meetings', details: err?.message });
    }
  }
});

app.post('/api/attendance/batch-save', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { statusUpdates, rollCallLogs } = req.body || {};
  try {
    const result = await batchSaveAttendance(tursoClient, { statusUpdates, rollCallLogs });
    await refreshAllMonthCache(tursoClient);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to batch save attendance:', err);
    res.status(500).json({ error: 'Failed to batch save attendance', details: err?.message });
  }
});

app.get('/api/attendance/day-sessions', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  try {
    // Fast path: if day meetings already exist, skip loading metadata state completely
    const existingCheck = await tursoClient.execute({
      sql: 'SELECT 1 FROM attnd_meeting WHERE meeting_date = ? LIMIT 1',
      args: [dateStr],
    });
    const state = existingCheck.rows.length === 0 ? await getDatabaseState() : ({} as any);
    const meetings = await getOrCreateDayMeetings(tursoClient, dateStr, state);
    res.json(meetings);
  } catch (err: any) {
    console.error('Failed to get day meetings:', err);
    res.status(500).json({ error: 'Failed to get day meetings', details: err?.message });
  }
});

app.get('/api/attendance/meetings/:meetingId/logs', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { meetingId } = req.params;
  try {
    const rollCallData = await getMeetingRollCall(tursoClient, meetingId);
    await refreshAllMonthCache(tursoClient);
    if (!rollCallData) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(rollCallData);
  } catch (err: any) {
    console.error('Failed to get meeting roll-call:', err);
    res.status(500).json({ error: 'Failed to get meeting roll-call', details: err?.message });
  }
});

app.post('/api/attendance/meetings/:meetingId/logs', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { meetingId } = req.params;
  const { teacherLog, studentLogs, meetingNotes, materialProgress } = req.body;
  try {
    await saveMeetingRollCall(tursoClient, meetingId, teacherLog, studentLogs || [], meetingNotes, materialProgress);
    res.json({ success: true, savedAt: new Date().toISOString(), meetingId });
  } catch (err: any) {
    console.error('Failed to save meeting roll-call:', err);
    res.status(500).json({ error: 'Failed to save meeting roll-call', details: err?.message });
  }
});

app.post('/api/attendance/meetings/:meetingId/status', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { meetingId } = req.params;
  const { status } = req.body;
  if (!status || !['scheduled', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be scheduled, completed, or cancelled.' });
  }
  try {
    await updateMeetingStatus(tursoClient, meetingId, status);
    await refreshAllMonthCache(tursoClient);
    res.json({ success: true, meetingId, status, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Failed to update meeting status:', err);
    res.status(500).json({ error: 'Failed to update meeting status', details: err?.message });
  }
});

app.post('/api/attendance/generate-all-meetings', async (_req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  try {
    const state = await getDatabaseState();
    const result = await generateAllRuleMeetings(tursoClient, state);
    await refreshAllMonthCache(tursoClient);
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Failed to generate meetings:', err);
    res.status(500).json({ error: 'Failed to generate meetings', details: err?.message });
  }
});

// ----------------------------------------------------------------------------
// Enrollment & Roster APIs
// ----------------------------------------------------------------------------
app.get('/api/enrollment/overview', async (_req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  try {
    const state = await getDatabaseState();
    const data = await getEnrollmentOverview(tursoClient, state);
    res.json(data);
  } catch (err: any) {
    console.error('Failed to get enrollment overview:', err);
    res.status(500).json({ error: 'Failed to get enrollment overview', details: err?.message });
  }
});

app.post('/api/enrollment/quick-assign', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { studentId, classId } = req.body;
  if (!studentId || !classId) {
    return res.status(400).json({ error: 'studentId and classId are required' });
  }
  try {
    await quickAssignStudentToClass(tursoClient, studentId, classId);
    res.json({ success: true, studentId, classId });
  } catch (err: any) {
    console.error('Failed to assign student to class:', err);
    res.status(500).json({ error: 'Failed to assign student to class', details: err?.message });
  }
});

app.post('/api/enrollment/quick-unassign', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { studentId, classId } = req.body;
  if (!studentId || !classId) {
    return res.status(400).json({ error: 'studentId and classId are required' });
  }
  try {
    await quickUnassignStudentFromClass(tursoClient, studentId, classId);
    res.json({ success: true, studentId, classId });
  } catch (err: any) {
    console.error('Failed to unassign student from class:', err);
    res.status(500).json({ error: 'Failed to unassign student from class', details: err?.message });
  }
});

app.post('/api/enrollment/students', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { student, classId } = req.body;
  if (!student || !student.name) {
    return res.status(400).json({ error: 'Student name is required' });
  }
  try {
    await upsertStudent(tursoClient, student, classId);
    res.json({ success: true, student });
  } catch (err: any) {
    console.error('Failed to upsert student:', err);
    res.status(500).json({ error: 'Failed to upsert student', details: err?.message });
  }
});

app.delete('/api/enrollment/students/:id', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { id } = req.params;
  try {
    await deleteStudentRecord(tursoClient, id);
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Failed to delete student:', err);
    res.status(500).json({ error: 'Failed to delete student', details: err?.message });
  }
});

app.post('/api/enrollment/save-all', async (req, res) => {
  if (!tursoClient) {
    return res.status(503).json({ error: 'Turso database is offline' });
  }
  const { students, enrollments } = req.body;
  try {
    await saveAllEnrollmentData(tursoClient, students, enrollments);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to save enrollments:', err);
    res.status(500).json({ error: 'Failed to save enrollments', details: err?.message });
  }
});

// Endpoints for exporting/downloading the SQLite files directly
app.get('/api/database/download/metadata', (req, res) => {
  const filePath = path.join(process.cwd(), 'data', 'metadata.db');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'metadata.db');
  } else {
    res.status(404).send('metadata.db not found');
  }
});

app.get('/api/database/download/kaldik', (req, res) => {
  const filePath = path.join(process.cwd(), 'data', 'kaldik.db');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'kaldik.db');
  } else {
    res.status(404).send('kaldik.db not found');
  }
});

app.get('/api/database/schema', (req, res) => {
  res.type('text/plain').send(UNIFIED_SCHEMA_SQL);
});

app.get('/api/database/schema/unified', (req, res) => {
  res.type('text/plain').send(UNIFIED_SCHEMA_SQL);
});

app.get('/api/database/schema/metadata', (req, res) => {
  res.type('text/plain').send(METADATA_SCHEMA_SQL);
});

app.get('/api/database/schema/kaldik', (req, res) => {
  res.type('text/plain').send(KALDIK_SCHEMA_SQL);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`School Schedule Server (SQLite WAL) running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('HTTP Server error:', err);
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
