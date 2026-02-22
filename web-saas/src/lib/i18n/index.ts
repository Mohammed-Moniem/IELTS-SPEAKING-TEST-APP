import { en } from './en';

export const dictionaries = {
  en
} as const;

export type SupportedLocale = keyof typeof dictionaries;
