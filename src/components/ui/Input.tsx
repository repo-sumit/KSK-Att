'use client';
import { useId, type InputHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './Input.module.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly helper?: string;
  /** Renders the value in Latin script metrics (codes, IDs). */
  readonly latin?: boolean;
}

/** DS pill input with a linked label, and errors announced to screen readers. */
export function Input({ label, value, onChange, error, helper, latin, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? helper;
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={cx(styles.control, error && styles.invalid)}>
        <input
          {...rest}
          id={inputId}
          lang={latin ? 'en' : undefined}
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
        />
      </div>
      {message && (
        <p id={messageId} className={cx(styles.message, error && styles.error)} role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}
