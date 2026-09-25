import type { ReactNode } from 'react';

/**
 * Wraps master data (student, staff, institute and trade names, IDs) that is
 * never translated, so it keeps Latin font metrics inside Marathi screens.
 */
export function Latin({ children }: { readonly children: ReactNode }) {
  return (
    <span lang="en" dir="ltr">
      {children}
    </span>
  );
}
