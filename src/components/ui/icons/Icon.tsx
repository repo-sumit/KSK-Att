import { createElement, type CSSProperties } from 'react';
import { ICON_PATHS, type IconName } from './paths';

export type { IconName };

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly strokeWidth?: number;
  /** Accessible name. Omit for decorative icons (the default). */
  readonly label?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Inline SVG icon; inherits colour through currentColor. */
export function Icon({ name, size = 20, strokeWidth = 2, label, className, style }: IconProps) {
  return createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      focusable: 'false',
      className,
      style: { flex: 'none', ...style },
      ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }),
    },
    ICON_PATHS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
  );
}
