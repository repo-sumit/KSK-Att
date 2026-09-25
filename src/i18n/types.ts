/**
 * Message catalogue typing. English is the source of truth; every other
 * language mirrors its shape (a missing string falls back to English, never a
 * blank or a key — PRD §21.3).
 */
export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

export type MessageLeaf = string | PluralForms;

export interface MessageTree {
  readonly [key: string]: MessageLeaf | MessageTree;
}

type Join<K extends string, P extends string> = P extends '' ? K : `${K}.${P}`;

/** Dot paths to every leaf, e.g. "roster.hint.present". */
export type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends MessageLeaf ? K : T[K] extends MessageTree ? Join<K, LeafPaths<T[K]>> : never;
}[keyof T & string];

/** Same shape, every leaf optional, strings loosened (for translations). */
export type Translation<T> = {
  readonly [K in keyof T]?: T[K] extends PluralForms ? PluralForms : T[K] extends string ? string : Translation<T[K]>;
};

export type MessageParams = Readonly<Record<string, string | number>>;
