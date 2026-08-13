/** Shared content model types. All user-facing text is bilingual ({ vi, en }). */

export type Lang = 'vi' | 'en';
export type Theme = 'light' | 'dark';

/** A bilingual string. Fill both languages in the content files. */
export interface L {
  vi: string;
  en: string;
}

export type CalloutTone = 'info' | 'tip' | 'success' | 'warning' | 'danger';
export type Tone = 'brand' | 'teal' | 'violet' | 'coral';

export interface FieldRow {
  label: L;
  /** Plain value (same in both languages), e.g. an SSID, extension or email. */
  value: string;
  /** Show a copy-to-clipboard button. */
  copy?: boolean;
}

export interface Contact {
  name: string;
  role?: L;
  dept?: L;
  phone?: string;
  ext?: string;
  email?: string;
  /** Optional 1–2 letter avatar override; otherwise derived from name. */
  initials?: string;
}

export interface PortalLink {
  label: L;
  desc?: L;
  url: string;
  icon: string;
  tone?: Tone;
  /** Opens in a new tab when true. */
  external?: boolean;
}

/** A rich content block used to render guide sections declaratively. */
export type Block =
  | { kind: 'p'; text: L }
  | { kind: 'steps'; items: L[] }
  | { kind: 'bullets'; items: L[] }
  | { kind: 'callout'; tone: CalloutTone; title?: L; text: L }
  | { kind: 'fields'; title?: L; items: FieldRow[] }
  | { kind: 'table'; head: L[]; rows: L[][] }
  | { kind: 'links'; items: PortalLink[] }
  | { kind: 'image'; src: string; alt?: L; caption?: L };

export interface GuideSection {
  id: string;
  icon: string;
  eyebrow?: L;
  title: L;
  intro?: L;
  readMin?: number;
  blocks: Block[];
}

export interface ChecklistItem {
  id: string;
  text: L;
  hint?: L;
}

export interface FaqItem {
  q: L;
  a: L;
  tag?: L;
}

export interface PolicyItem {
  icon: string;
  title: L;
  summary: L;
  points?: L[];
}

export interface NavItem {
  id: string;
  label: L;
  path: string;
  icon: string;
}

export interface ValueItem {
  icon: string;
  title: L;
  text: L;
}

export interface StatItem {
  num: string;
  label: L;
}
