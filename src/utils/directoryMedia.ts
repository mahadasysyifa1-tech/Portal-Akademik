import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { DatabaseState } from '../types';

export type DirectoryEntityType = 'subject' | 'book' | 'class' | 'teacher' | 'student';

export interface DirectoryMediaItem {
  entityType: DirectoryEntityType;
  entityId: string;
  imageUrl: string;
  storagePath?: string;
  sourceType: 'upload' | 'url';
  visibility: 'public' | 'academic';
  updatedByUid: string;
  updatedAt?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getDirectoryMediaKey(entityType: DirectoryEntityType, entityId: string): string {
  return `${entityType}__${entityId}`;
}

export function getFirestoreMediaPath(entityType: DirectoryEntityType, entityId: string): {
  collectionName: 'directory_media' | 'directory_media_students';
  docId: string;
} {
  if (entityType === 'student') {
    return {
      collectionName: 'directory_media_students',
      docId: entityId,
    };
  }
  return {
    collectionName: 'directory_media',
    docId: getDirectoryMediaKey(entityType, entityId),
  };
}

/**
 * Resize and compress an uploaded image client-side using HTML5 Canvas.
 * Keeps uploads snappy and well within both Storage bandwidth and Firestore fallback limits.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 640,
  targetMaxBytes = 140_000
): Promise<{ blob: Blob; dataUrl: string; extension: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File gambar tidak dapat dibaca oleh browser.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || maxDimension) * scale));
    const height = Math.max(1, Math.round((img.height || maxDimension) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D tidak tersedia.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    const qualities = [0.84, 0.72, 0.58, 0.45];
    const mimeType = 'image/webp';
    let bestBlob: Blob | null = null;
    let bestDataUrl = '';

    for (const q of qualities) {
      const dataUrl = canvas.toDataURL(mimeType, q);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, q));
      if (blob) {
        bestBlob = blob;
        bestDataUrl = dataUrl;
        if (dataUrl.length <= targetMaxBytes) {
          break;
        }
      }
    }

    if (!bestBlob || !bestDataUrl.startsWith('data:image/')) {
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.72);
      const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
      if (!jpegBlob) {
        throw new Error('Gagal mengonversi gambar.');
      }
      return { blob: jpegBlob, dataUrl: jpegDataUrl, extension: 'jpg' };
    }

    return {
      blob: bestBlob,
      dataUrl: bestDataUrl,
      extension: bestDataUrl.startsWith('data:image/webp') ? 'webp' : 'jpg',
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isValidImageUrlInput(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function saveDirectoryPicture(params: {
  entityType: DirectoryEntityType;
  entityId: string;
  file?: File;
  url?: string;
  previousStoragePath?: string;
}): Promise<DirectoryMediaItem> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error(
      'Silakan masuk menggunakan Google Sign-In terlebih dahulu agar gambar dapat disimpan ke Firebase Cloud.'
    );
  }

  const { entityType, entityId, file, url, previousStoragePath } = params;
  const { collectionName, docId } = getFirestoreMediaPath(entityType, entityId);
  const fullPath = `${collectionName}/${docId}`;

  let imageUrl = '';
  let storagePath = '';
  let sourceType: 'upload' | 'url' = 'url';

  if (file) {
    sourceType = 'upload';
    const compressed = await compressImageFile(file);
    const nextStoragePath = `directory-pictures/${entityType}/${entityId}/${Date.now()}.${compressed.extension}`;
    try {
      const storageRef = ref(storage, nextStoragePath);
      await uploadBytes(storageRef, compressed.blob, {
        contentType: compressed.extension === 'webp' ? 'image/webp' : 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
      });
      imageUrl = await getDownloadURL(storageRef);
      storagePath = nextStoragePath;
    } catch (storageErr) {
      // Graceful cloud fallback: if Firebase Storage bucket rules aren't configured yet,
      // store the compressed <=140KB thumbnail directly in the isolated per-item Firestore document.
      console.warn('Firebase Storage upload unavailable, falling back to compressed Firestore thumbnail:', storageErr);
      if (compressed.dataUrl.length > 340_000) {
        throw new Error('Ukuran gambar terlalu besar untuk disimpan. Gunakan gambar lain yang lebih ringkas.');
      }
      imageUrl = compressed.dataUrl;
      storagePath = '';
    }
  } else if (url) {
    if (!isValidImageUrlInput(url)) {
      throw new Error('URL gambar harus menggunakan tautan http:// atau https:// yang valid.');
    }
    imageUrl = url.trim();
    sourceType = 'url';
    storagePath = '';
  } else {
    throw new Error('Pilih file gambar atau masukkan URL gambar.');
  }

  const visibility = entityType === 'student' ? 'academic' : 'public';
  const payload = {
    entityType,
    entityId,
    imageUrl,
    storagePath,
    sourceType,
    visibility,
    updatedByUid: currentUser.uid,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, collectionName, docId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, fullPath);
  }

  if (previousStoragePath && previousStoragePath !== storagePath) {
    try {
      await deleteObject(ref(storage, previousStoragePath));
    } catch {
      // Ignore missing or external storage blobs on cleanup
    }
  }

  window.dispatchEvent(
    new CustomEvent('directory-media:updated', {
      detail: { entityType, entityId },
    })
  );

  return {
    entityType,
    entityId,
    imageUrl,
    storagePath,
    sourceType,
    visibility,
    updatedByUid: currentUser.uid,
  };
}

export async function removeDirectoryPicture(params: {
  entityType: DirectoryEntityType;
  entityId: string;
  storagePath?: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error(
      'Silakan masuk menggunakan Google Sign-In terlebih dahulu untuk menghapus foto di Firebase Cloud.'
    );
  }

  const { entityType, entityId, storagePath } = params;
  const { collectionName, docId } = getFirestoreMediaPath(entityType, entityId);
  const fullPath = `${collectionName}/${docId}`;

  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, fullPath);
  }

  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Ignore cleanup errors for absent blobs
    }
  }

  window.dispatchEvent(
    new CustomEvent('directory-media:updated', {
      detail: { entityType, entityId, removed: true },
    })
  );
}

export async function fetchStudentMediaById(studentId: string): Promise<DirectoryMediaItem | null> {
  const path = `directory_media_students/${studentId}`;
  try {
    const snap = await getDoc(doc(db, 'directory_media_students', studentId));
    if (!snap.exists()) return null;
    return snap.data() as DirectoryMediaItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Keeps trusted Firestore RBAC documents (`admins`, `academic_members`, and `directory_identities`)
 * synchronized when an authenticated admin uses the app, enabling owner teacher/student self-edits
 * and zero-trust student media reads without storing PII in client-readable lists.
 */
export async function syncFirebaseDirectoryAccessForAdmin(
  dbState: DatabaseState,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;

  try {
    await setDoc(doc(db, 'admins', adminUid), {
      uid: adminUid,
      email: adminEmail.toLowerCase(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Note syncing admin marker doc:', err);
  }

  const bindings: Array<{ entityType: 'teacher' | 'student'; entityId: string; ownerEmail: string }> = [];
  for (const t of dbState.teachers || []) {
    if (t.id && t.email && t.email.trim()) {
      bindings.push({
        entityType: 'teacher',
        entityId: t.id,
        ownerEmail: t.email.trim().toLowerCase(),
      });
    }
  }
  for (const s of dbState.students || []) {
    if (s.id && s.email && s.email.trim()) {
      bindings.push({
        entityType: 'student',
        entityId: s.id,
        ownerEmail: s.email.trim().toLowerCase(),
      });
    }
  }

  // Write in chunks of 400 to respect Firestore 500-write batch limit
  for (let i = 0; i < bindings.length; i += 400) {
    const chunk = bindings.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const identityKey = `${item.entityType}__${item.entityId}`;
      batch.set(doc(db, 'directory_identities', identityKey), {
        entityType: item.entityType,
        entityId: item.entityId,
        ownerEmail: item.ownerEmail,
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (err) {
      console.warn('Directory identity sync batch skipped:', err);
    }
  }
}

export async function syncAcademicMemberToFirestore(
  targetUid: string,
  role: 'admin' | 'teacher' | 'student',
  email: string
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  if (!targetUid || targetUid.startsWith('turso-')) return;
  const path = `academic_members/${targetUid}`;
  try {
    await setDoc(doc(db, 'academic_members', targetUid), {
      uid: targetUid,
      role,
      email: email.trim().toLowerCase(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
