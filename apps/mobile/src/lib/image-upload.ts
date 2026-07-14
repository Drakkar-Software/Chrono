import * as ImagePicker from 'expo-image-picker';

import { globalSupabaseClient } from '@/lib/supabase';

/** A picked image, normalized to what the uploader needs. */
export interface PickedImage {
  /** Local (native `file://`) or blob/data (web) URI usable by `fetch`. */
  uri: string;
  /** File extension without a dot, e.g. `jpg`, `png`. */
  ext: string;
  /** MIME type to persist on the stored object. */
  contentType: string;
}

/** Thrown when the user declines media-library access. */
export class PermissionDeniedError extends Error {
  constructor() {
    super('Photo access was denied. Enable it in settings to change your photo.');
    this.name = 'PermissionDeniedError';
  }
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

function resolveExtAndType(asset: ImagePicker.ImagePickerAsset): { ext: string; contentType: string } {
  const mime = asset.mimeType?.toLowerCase();
  if (mime && EXT_BY_MIME[mime]) return { ext: EXT_BY_MIME[mime], contentType: mime };

  const fromName = asset.fileName?.split('.').pop()?.toLowerCase();
  if (fromName) {
    const ext = fromName === 'jpeg' ? 'jpg' : fromName;
    return { ext, contentType: mime ?? `image/${ext === 'jpg' ? 'jpeg' : ext}` };
  }
  return { ext: 'jpg', contentType: mime ?? 'image/jpeg' };
}

/**
 * Prompt for media-library access, then open the picker. Returns the chosen
 * image (normalized) or `null` if the user cancelled. Works on native and on
 * web, where `expo-image-picker` uses a hidden `<input type="file">`.
 *
 * @throws {PermissionDeniedError} when access is refused.
 */
export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PermissionDeniedError();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const { ext, contentType } = resolveExtAndType(asset);
  return { uri: asset.uri, ext, contentType };
}

/**
 * Upload a local/blob image URI to a public Supabase storage bucket and return
 * its cache-busted public URL. `fetch(uri) -> blob` works for both native
 * `file://` URIs and web blob/data URIs the picker produces.
 */
export async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();

  const { error } = await globalSupabaseClient.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType });
  if (error) throw error;

  const { data } = globalSupabaseClient.storage.from(bucket).getPublicUrl(path);
  // Bust the CDN/browser cache — the path is stable (avatar.<ext>) so the URL
  // is otherwise identical across re-uploads and would render the old image.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Pick, then upload to `{bucket}/{folder}/{name}.<ext>`; returns the public URL or `null` if cancelled. */
export async function pickAndUploadImage(
  bucket: string,
  folder: string,
  name: string,
): Promise<string | null> {
  const picked = await pickImage();
  if (!picked) return null;
  const path = `${folder}/${name}.${picked.ext}`;
  return uploadImage(bucket, path, picked.uri, picked.contentType);
}
