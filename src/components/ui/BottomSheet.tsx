'use client';
import { useEffect, useId, useRef, type ReactNode, type Ref } from 'react';
import { cx } from '@/lib/cx';
import { IconButton } from './IconButton';
import styles from './BottomSheet.module.css';

/** Where an overlay goes from 600px (phones: always a bottom sheet). */
export type SheetPlacement = 'bottom' | 'anchored' | 'drawer';

/**
 * The shared overlay surface for a native <dialog>: the bottom sheet on phones,
 * then `placement` from 600px. anchored/drawer owners set --overlay-top (and
 * anchored --overlay-right) on the dialog. Compose it; never re-declare it.
 */
export const sheetSurface = (placement: SheetPlacement = 'bottom') => cx(styles.surface, styles[placement]);

/** The 40×4 drag cue of a phone sheet (hidden from 600px). */
export function SheetGrabber() {
  return <span className={styles.grabber} aria-hidden="true" />;
}

interface SheetTitleBarProps {
  readonly id: string;
  readonly title: ReactNode;
  /** One or more short lines under the title (spans or plain text). */
  readonly subtitle?: ReactNode;
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** The dialog starts on its title (focusable, not in the tab order). */
  readonly titleRef?: Ref<HTMLHeadingElement>;
}

/** The pinned title row of a reading sheet or panel: title (and subtitle), a 44px close button, one divider. */
export function SheetTitleBar({ id, title, subtitle, closeLabel, onClose, titleRef }: SheetTitleBarProps) {
  return (
    <div className={styles.titleBar}>
      <div className={styles.titleText}>
        <h2 id={id} ref={titleRef} tabIndex={-1} className={styles.barTitle}>
          {title}
        </h2>
        {subtitle && <div className={styles.barSubtitle}>{subtitle}</div>}
      </div>
      <IconButton icon="x" label={closeLabel} onClick={onClose} />
    </div>
  );
}

interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  /** Primary + secondary buttons: stacked on phones, side by side from 600px (confirmations). */
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

  const descriptionText = description && (
    <p id={descId} className={styles.description}>
      {description}
    </p>
  );

  return (
    <dialog
      ref={ref}
      className={sheetSurface('bottom')}
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
      {closeLabel && <SheetTitleBar id={titleId} titleRef={titleRef} title={title} closeLabel={closeLabel} onClose={onClose} />}
      <div className={cx(styles.panel, closeLabel && styles.reading)}>
        {closeLabel ? (
          descriptionText
        ) : (
          <>
            <SheetGrabber />
            <div className={styles.text}>
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
                {title}
              </h2>
              {descriptionText}
            </div>
          </>
        )}
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </dialog>
  );
}
