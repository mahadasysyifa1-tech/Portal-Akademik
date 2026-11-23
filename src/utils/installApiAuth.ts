import { auth } from '../firebase.ts';

const WRAPPED_SYMBOL = Symbol.for('ijma.apiAuth.fetchWrapped');
const AUTH_READY_TIMEOUT_MS = 3000;

let isInstalled = false;

type TaggedFetch = typeof window.fetch & {
  [WRAPPED_SYMBOL]?: boolean;
};

type AuthWithReady = typeof auth & {
  authStateReady?: () => Promise<void>;
};

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') {
      return new URL(input, window.location.origin);
    }
    if (input instanceof URL) {
      return new URL(input.href, window.location.origin);
    }
    if (input instanceof Request) {
      return new URL(input.url, window.location.origin);
    }
  } catch {
    return null;
  }
  return null;
}

async function waitForAuthReady(): Promise<void> {
  const authInstance = auth as AuthWithReady;
  if (typeof authInstance.authStateReady !== 'function') {
    return;
  }

  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      authInstance.authStateReady().catch(() => undefined),
      new Promise<void>((resolve) => {
        timerId = setTimeout(resolve, AUTH_READY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

export function installApiAuth(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  const currentFetch = window.fetch as TaggedFetch;
  if (isInstalled || currentFetch[WRAPPED_SYMBOL]) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  isInstalled = true;

  const wrappedFetch: TaggedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const resolvedUrl = resolveRequestUrl(input);
    if (
      !resolvedUrl ||
      resolvedUrl.origin !== window.location.origin ||
      !resolvedUrl.pathname.startsWith('/api/')
    ) {
      return originalFetch(input, init);
    }

    const effectiveHeaders = new Headers(
      init?.headers !== undefined
        ? init.headers
        : input instanceof Request
          ? input.headers
          : undefined
    );

    if (effectiveHeaders.has('Authorization')) {
      return originalFetch(input, init);
    }

    await waitForAuthReady();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return originalFetch(input, init);
    }

    let token: string | null = null;
    try {
      token = await currentUser.getIdToken();
    } catch {
      token = null;
    }

    if (!token) {
      return originalFetch(input, init);
    }

    effectiveHeaders.set('Authorization', `Bearer ${token}`);

    if (input instanceof Request) {
      const clonedRequest = new Request(input, {
        ...init,
        headers: effectiveHeaders,
      });
      return originalFetch(clonedRequest);
    }

    return originalFetch(input, {
      ...init,
      headers: effectiveHeaders,
    });
  };

  wrappedFetch[WRAPPED_SYMBOL] = true;
  window.fetch = wrappedFetch;
}
