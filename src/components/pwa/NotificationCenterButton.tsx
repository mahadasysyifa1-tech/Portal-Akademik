import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, BellOff, CheckCircle2, AlertCircle, Send, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PushPreferences {
  classReminders: boolean;
  attendanceReminders: boolean;
  leadMinutes: number;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Service Worker belum siap dalam batas waktu (timeout).'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export const NotificationCenterButton: React.FC = () => {
  const auth = useAuth();
  const { isIOS, isInstalled } = usePWAInstall();

  const [isOpen, setIsOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string>('');
  const [prefs, setPrefs] = useState<PushPreferences>({
    classReminders: true,
    attendanceReminders: true,
    leadMinutes: 10,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!auth.user) {
      throw new Error('Masuk dengan akun Google untuk mengaktifkan notifikasi.');
    }
    return {
      Authorization: 'Bearer ' + (await auth.user.getIdToken()),
    };
  }, [auth.user]);

  const syncBrowserSubscriptionState = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);
    if (!auth.user) {
      setCurrentEndpoint('');
      setIsSubscribed(false);
      return;
    }

    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setCurrentEndpoint(existing.endpoint);
        const authHeaders = await getAuthHeaders();
        const res = await fetch(
          `/api/push/status?endpoint=${encodeURIComponent(existing.endpoint)}`,
          { headers: authHeaders }
        );
        if (res.ok) {
          const data = await res.json();
          setIsSubscribed(Boolean(data.subscribed));
          if (data.prefs) setPrefs(data.prefs);
        }
      } else {
        setCurrentEndpoint('');
        setIsSubscribed(false);
      }
    } catch {
      // SW not ready yet
    }
  }, [auth.user, getAuthHeaders]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      syncBrowserSubscriptionState();
    } else {
      setCurrentEndpoint('');
      setIsSubscribed(false);
    }
  }, [auth.isAuthenticated, auth.user, syncBrowserSubscriptionState]);

  const registerOrUpdateSubscription = async (nextPrefs: PushPreferences) => {
    if (!auth.user) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error('Izin notifikasi belum diberikan di browser/perangkat ini.');
      }

      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.publicKey) {
        throw new Error(keyData.error || 'Kunci Web Push server belum tersedia.');
      }

      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }

      const authHeaders = await getAuthHeaders();
      const subJson = sub.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          subscription: {
            endpoint: sub.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
            },
          },
          prefs: nextPrefs,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Gagal menyimpan langganan notifikasi.');
      }

      setCurrentEndpoint(sub.endpoint);
      setIsSubscribed(true);
      setPrefs(saveData.prefs || nextPrefs);
      setFeedback({ type: 'success', text: 'Notifikasi Web Push aktif di perangkat ini.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Gagal mengaktifkan notifikasi.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!auth.user) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint || currentEndpoint;
      if (endpoint) {
        const authHeaders = await getAuthHeaders();
        const unsubRes = await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ endpoint }),
        });
        const unsubData = await unsubRes.json().catch(() => ({}));
        if (!unsubRes.ok || !unsubData.success) {
          throw new Error(unsubData.error || 'Gagal menonaktifkan langganan notifikasi.');
        }
      }
      if (sub) {
        await sub.unsubscribe();
      }
      setCurrentEndpoint('');
      setIsSubscribed(false);
      setFeedback({ type: 'success', text: 'Notifikasi perangkat dinonaktifkan.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Gagal menonaktifkan notifikasi.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendTest = async () => {
    if (!auth.user || !currentEndpoint) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ endpoint: currentEndpoint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Tes notifikasi gagal dikirim.');
      }
      setFeedback({ type: 'success', text: 'Notifikasi percobaan dikirim ke perangkat ini.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Gagal mengirim tes notifikasi.' });
    } finally {
      setIsBusy(false);
    }
  };

  const updatePrefAndSync = (patch: Partial<PushPreferences>) => {
    if (!auth.user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (isSubscribed) {
      registerOrUpdateSubscription(next);
    }
  };

  return (
    <>
      <button
        type="button"
        id="btn-push-notifications"
        onClick={() => {
          setFeedback(null);
          syncBrowserSubscriptionState();
          setIsOpen(true);
        }}
        title={isSubscribed ? 'Notifikasi Perangkat Aktif' : 'Atur Notifikasi Kelas & Presensi'}
        aria-label="Pengaturan Notifikasi Perangkat"
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          isSubscribed
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        {isSubscribed ? (
          <BellRing className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <Bell className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        )}
        <span className="hidden lg:inline">{isSubscribed ? 'Notif Aktif' : 'Notifikasi'}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Notifikasi Web Push</h3>
                  <p className="text-[11px] text-slate-500">Pengingat kelas &amp; pencatatan presensi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup pengaturan notifikasi"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isIOS && !isInstalled && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
                  Pada iPhone / iPad, pasang aplikasi ke <strong>Layar Utama (Add to Home Screen)</strong> terlebih dahulu agar Web Push diizinkan oleh iOS Safari.
                </div>
              )}

              {!auth.user && (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 leading-relaxed">
                  Masuk dengan akun Google untuk mengaktifkan notifikasi.
                </div>
              )}

              {!isSupported ? (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-start gap-2">
                  <BellOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>Browser atau konteks preview ini belum mendukung Service Worker PushManager. Buka di tab browser penuh (HTTPS) untuk mengaktifkan.</span>
                </div>
              ) : (
                <>
                  {/* Subscription Status Card */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">
                        {isSubscribed ? 'Perangkat Terhubung' : 'Notifikasi Belum Aktif'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {permission === 'denied'
                          ? 'Izin diblokir browser — buka pengaturan situs untuk mengizinkan.'
                          : isSubscribed
                          ? 'Berjalan melalui Web Push VAPID meski tab ditutup.'
                          : 'Aktifkan untuk menerima alert saat jam pelajaran & presensi.'}
                      </p>
                    </div>
                    {isSubscribed ? (
                      <button
                        type="button"
                        disabled={isBusy || !auth.user}
                        onClick={handleUnsubscribe}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Matikan
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy || permission === 'denied' || !auth.user}
                        onClick={() => registerOrUpdateSubscription(prefs)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {isBusy ? 'Mengaktifkan...' : 'Aktifkan'}
                      </button>
                    )}
                  </div>

                  {/* Preferences */}
                  <div className="space-y-3">
                    <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50/60">
                      <div>
                        <span className="font-bold text-slate-800 block">Pengingat Jam Masuk Kelas</span>
                        <span className="text-[11px] text-slate-500">
                          Mengingatkan ustadz/santri menjelang jadwal sesi dimulai.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.classReminders}
                        onChange={(e) => updatePrefAndSync({ classReminders: e.target.checked })}
                        disabled={isBusy || !auth.user}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>

                    {prefs.classReminders && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="font-semibold text-slate-700">Waktu Pengingat Sebelum Kelas</span>
                        <select
                          value={prefs.leadMinutes}
                          onChange={(e) => updatePrefAndSync({ leadMinutes: Number(e.target.value) })}
                          disabled={isBusy || !auth.user}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs font-semibold text-slate-800 cursor-pointer"
                        >
                          <option value={5}>5 menit</option>
                          <option value={10}>10 menit</option>
                          <option value={15}>15 menit</option>
                          <option value={30}>30 menit</option>
                        </select>
                      </div>
                    )}

                    <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50/60">
                      <div>
                        <span className="font-bold text-slate-800 block">Notifikasi &amp; Pengingat Presensi</span>
                        <span className="text-[11px] text-slate-500">
                          Mengingatkan presensi sesi yang belum dicatat serta info saat roll-call disimpan.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.attendanceReminders}
                        onChange={(e) => updatePrefAndSync({ attendanceReminders: e.target.checked })}
                        disabled={isBusy || !auth.user}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </>
              )}

              {feedback && (
                <div
                  className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {isSubscribed ? (
                  <button
                    type="button"
                    disabled={isBusy || !auth.user}
                    onClick={handleSendTest}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Kirim Tes Push</span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
