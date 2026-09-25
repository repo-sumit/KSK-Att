'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  /** Primary + secondary buttons, stacked. */
  readonly actions: ReactNode;
}

/**
 * Confirmation sheet on the native <dialog>: focus trap, Esc to close, inert
 * background and scrim come from the platform. Tapping the scrim closes it.
 */
export function BottomSheet({ open, onClose, title, description, children, actions }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the question, not on an action: these sheets confirm irreversible steps
      // (submit, save, log out), so one stray activation must not commit them.
      titleRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.panel}>
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.text}>
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
            {title}
          </h2>
          {description && (
            <p id={descId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {children}
        <div className={styles.actions}>{actions}</div>
      </div>
    </dialog>
  );
}
