'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

interface ToastApi {
  show(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastMessageContext = createContext<string | null>(null);

/** Holds the single current toast (a new message replaces the old one). */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), next.length > 60 ? 4000 : 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      <ToastMessageContext.Provider value={message}>{children}</ToastMessageContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast outside ToastProvider');
  return api;
}

/** Rendered by the screen layout just above its footer / bottom nav, so it never covers a CTA. */
export function ToastViewport() {
  const message = useContext(ToastMessageContext);
  return (
    <div className={styles.anchor}>
      <div className={styles.region} role="status" aria-live="polite">
        {message && (
          <div key={message} className={styles.toast}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
