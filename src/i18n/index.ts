import { de } from './de';
import { en, type Messages } from './en';

export type Lang = 'en' | 'de';
export const LANGS: Record<Lang, { name: string; messages: Messages }> = {
  en: { name: 'English', messages: en },
  de: { name: 'Deutsch', messages: de },
};

let lang: Lang = 'en';

export const getLang = () => lang;
export const setLang = (l: Lang) => {
  lang = l;
};

/** Messages of the current language. */
export const t = (): Messages => LANGS[lang].messages;

/**
 * Formats a number for the current language: fixed `digits` if given,
 * otherwise as short as possible.
 */
export function num(n: number, digits?: number): string {
  const s = digits === undefined ? String(n) : n.toFixed(digits);
  return lang === 'de' ? s.replace('.', ',') : s;
}
