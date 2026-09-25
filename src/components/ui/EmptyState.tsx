import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons/Icon';
import styles from './EmptyState.module.css';

export function EmptyState({ icon, title, body, action }: { readonly icon: IconName; readonly title: string; readonly body?: string; readonly action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.well} aria-hidden="true">
        <Icon name={icon} size={36} />
      </span>
      <p className={styles.title}>{title}</p>
      {body && <p className={styles.body}>{body}</p>}
      {action}
    </div>
  );
}
