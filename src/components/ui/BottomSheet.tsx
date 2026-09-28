'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { IconButton } from './IconButton';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  /** Primary + secondary buttons, stacked (confirmations). */
  readonly actions?: ReactNode;
  /**
   * A reading sheet (a list, e.g. announcements): the title row stays pinned with a
   * visible close button, however long the content scrolls. No grabber: there is no swipe.
   */
  readonly closeLabel?: string;
}

/**
 * Sheet on the native <dialog>: focus trap, Esc to close, inert background and
 * scrim come from the platform. Tapping the scrim closes it. Confirmations end
 * with their actions; reading sheets (closeLabel) keep a close button in view.
 */
export function BottomSheet({ open, onClose, title, description, children, actions, closeLabel }: BottomSheetProps) {
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
      <div className={cx(styles.panel, closeLabel && styles.reading)}>
        {!closeLabel && <span className={styles.grabber} aria-hidden="true" />}
        <div className={cx(styles.text, closeLabel && styles.titleRow)}>
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
            {title}
          </h2>
          {closeLabel && <IconButton icon="x" label={closeLabel} onClick={onClose} />}
          {description && (
            <p id={descId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </dialog>
  );
}
