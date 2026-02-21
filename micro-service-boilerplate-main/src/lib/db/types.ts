export type DBWriteMode = 'mongo' | 'dual' | 'supabase';
export type DBReadMode = 'mongo' | 'supabase';

export interface DualWriteResult<T> {
  primary: T;
  secondary?: T;
  parityMatched?: boolean;
}
