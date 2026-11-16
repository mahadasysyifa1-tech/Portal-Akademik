import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { DatabaseState } from '../types';
import {
  DirectoryEntityType,
  DirectoryMediaItem,
  OperationType,
  fetchStudentMediaById,
  getDirectoryMediaKey,
  handleFirestoreError,
  syncFirebaseDirectoryAccessForAdmin,
} from '../utils/directoryMedia';

export function useDirectoryMedia(dbState: DatabaseState) {
  const auth = useAuth();
  const [publicMediaMap, setPublicMediaMap] = useState<Record<string, DirectoryMediaItem>>({});
  const [studentMediaMap, setStudentMediaMap] = useState<Record<string, DirectoryMediaItem>>({});

  // Sync admin / teacher / student ownership bindings when admin logs in with Firebase
  useEffect(() => {
    if (!auth.isAdmin || !auth.user || !auth.user.emailVerified || !auth.user.email) return;
    if ((dbState.teachers?.length || 0) === 0 && (dbState.students?.length || 0) === 0) return;

    syncFirebaseDirectoryAccessForAdmin(dbState, auth.user.uid, auth.user.email).catch(() => {});
  }, [auth.isAdmin, auth.user, dbState.teachers, dbState.students]);

  // Listen to public academic directory media (subjects, books, classes, teachers)
  useEffect(() => {
    if (!auth.user) {
      setPublicMediaMap({});
      return;
    }

    const q = query(collection(db, 'directory_media'), where('visibility', '==', 'public'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Record<string, DirectoryMediaItem> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DirectoryMediaItem;
          if (data?.entityType && data?.entityId && data?.imageUrl) {
            next[getDirectoryMediaKey(data.entityType, data.entityId)] = data;
          }
        });
        setPublicMediaMap(next);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'directory_media');
      }
    );

    return () => unsubscribe();
  }, [auth.user]);

  const loadStudentMedia = useCallback(async () => {
    // Only authenticated non-guest Firebase users (admin, teacher, student) can read student portraits
    if (!auth.user || !auth.user.emailVerified || auth.role === 'guest') {
      setStudentMediaMap({});
      return;
    }

    const idsToLoad =
      auth.role === 'student' && auth.studentId
        ? Array.from(new Set([auth.studentId, ...(dbState.students || []).map((s) => s.id)]))
        : (dbState.students || []).map((s) => s.id);

    if (idsToLoad.length === 0) return;

    const results = await Promise.all(
      idsToLoad.map(async (studentId) => {
        try {
          const item = await fetchStudentMediaById(studentId);
          return [studentId, item] as const;
        } catch {
          return [studentId, null] as const;
        }
      })
    );

    const next: Record<string, DirectoryMediaItem> = {};
    for (const [studentId, item] of results) {
      if (item?.imageUrl) {
        next[getDirectoryMediaKey('student', studentId)] = item;
      }
    }
    setStudentMediaMap(next);
  }, [auth.user, auth.role, auth.studentId, dbState.students]);

  useEffect(() => {
    loadStudentMedia();
  }, [loadStudentMedia]);

  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { entityType?: DirectoryEntityType; entityId?: string; removed?: boolean }
        | undefined;
      if (detail?.entityType === 'student') {
        loadStudentMedia();
      }
    };
    window.addEventListener('directory-media:updated', handleUpdated);
    return () => window.removeEventListener('directory-media:updated', handleUpdated);
  }, [loadStudentMedia]);

  const mediaMap = {
    ...publicMediaMap,
    ...studentMediaMap,
  };

  const getMedia = useCallback(
    (entityType: DirectoryEntityType, entityId?: string): DirectoryMediaItem | undefined => {
      if (!entityId) return undefined;
      return mediaMap[getDirectoryMediaKey(entityType, entityId)];
    },
    [mediaMap]
  );

  return {
    mediaMap,
    getMedia,
    refreshStudentMedia: loadStudentMedia,
  };
}
