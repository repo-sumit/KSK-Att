import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import styles from './InlineNote.module.css';

interface InlineNoteProps {
  readonly children: ReactNode;
  readonly icon?: IconName;
  readonly className?: string;
  readonly id?: string;
}

/**
 * A quiet line of guidance on the surface it sits on: icon + secondary text,
 * no fill and no border ("Everyone starts as Present…", a record's correction
 * rule). For states that need attention use Banner or StatusLine instead.
 */
export function InlineNote({ children, icon = 'info', className, id }: InlineNoteProps) {
  return (
    <p className={cx(styles.note, className)} id={id}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </p>
  );
}
