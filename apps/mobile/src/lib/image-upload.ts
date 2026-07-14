import { Platform } from 'react-native';
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

// Only the raster types the storage buckets accept (see the storage migration's
// `allowed_mime_types`). HEIC is intentionally omitted — the buckets reject it,
// and the picker re-encodes edited images to JPEG anyway.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const EXT_BY_NAME: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

/**
 * Resolve a bucket-allowed `{ ext, contentType }` for a picked asset. Anything
 * outside the accepted raster set (e.g. HEIC) falls back to JPEG so the upload
 * matches the picker's default re-encode and the bucket's `allowed_mime_types`.
 */
function resolveExtAndType(asset: ImagePicker.ImagePickerAsset): { ext: string; contentType: string } {
  const mime = asset.mimeType?.toLowerCase();
  if (mime && EXT_BY_MIME[mime]) return { ext: EXT_BY_MIME[mime], contentType: mime };

  const fromName = asset.fileName?.split('.').pop()?.toLowerCase();
  if (fromName && EXT_BY_NAME[fromName]) {
    const ext = EXT_BY_NAME[fromName];
    return { ext, contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
  }
  return { ext: 'jpg', contentType: 'image/jpeg' };
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
 * Read a picked image URI into an upload body Supabase accepts.
 *
 * Native `file://` URIs can't go through `fetch().blob()` reliably — on some
 * engines it yields a zero-byte blob — so read the file into an `ArrayBuffer`
 * via `expo-file-system`'s `File`. On web the picker produces `blob:`/`data:`
 * URIs, where `fetch().blob()` is the correct path.
 */
async function readUploadBody(uri: string): Promise<Blob | ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.blob();
  }
  // Lazy-load: `expo-file-system`'s `File` is native-only.
  const { File } = await import('expo-file-system');
  return new File(uri).arrayBuffer();
}

/**
 * Upload a local/blob image URI to a public Supabase storage bucket and return
 * its cache-busted public URL. Reads the body per-platform (see `readUploadBody`).
 */
export async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string> {
  const body = await readUploadBody(uri);

  const { error } = await globalSupabaseClient.storage
    .from(bucket)
    .upload(path, body, { upsert: true, contentType });
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
