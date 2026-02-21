import { env } from '@env';
import { Logger } from '@lib/logger';
import { getSupabaseClient } from './supabaseClient';

const log = new Logger(__filename);

export interface StorageUploadResult {
  bucket: string;
  path: string;
  signedUrl: string;
}

export const uploadToSupabaseStorage = async (
  bucket: string,
  path: string,
  payload: Buffer,
  contentType: string
): Promise<StorageUploadResult> => {
  const client = getSupabaseClient();

  const { error } = await client.storage.from(bucket).upload(path, payload, {
    contentType,
    upsert: true
  });

  if (error) {
    throw error;
  }

  const { data: signed, error: signedError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, env.storage.supabase.signedUrlExpiry);

  if (signedError || !signed?.signedUrl) {
    throw signedError || new Error('Unable to create signed URL');
  }

  return {
    bucket,
    path,
    signedUrl: signed.signedUrl
  };
};

export const downloadFromSupabaseStorage = async (bucket: string, path: string): Promise<Buffer> => {
  const client = getSupabaseClient();

  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    throw error || new Error('Object not found in Supabase storage');
  }

  const bytes = await data.arrayBuffer();
  return Buffer.from(bytes);
};

export const deleteFromSupabaseStorage = async (bucket: string, path: string): Promise<void> => {
  const client = getSupabaseClient();

  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    log.warn('Failed to delete object from Supabase storage', { bucket, path, error: error.message });
    throw error;
  }
};

export const createSupabaseSignedUrl = async (bucket: string, path: string, expiresIn?: number): Promise<string> => {
  const client = getSupabaseClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn || env.storage.supabase.signedUrlExpiry);

  if (error || !data?.signedUrl) {
    throw error || new Error('Unable to create signed URL');
  }

  return data.signedUrl;
};
