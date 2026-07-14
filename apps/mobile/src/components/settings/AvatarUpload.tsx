import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Txt, radii, spacing, useTheme } from '@chrono/ui';

import { useT } from '@/lib/i18n';
import { InlineError } from '@/components/common/ErrorState';
import { PermissionDeniedError, pickAndUploadImage } from '@/lib/image-upload';

export interface AvatarUploadProps {
  /** Current image URL, or null/undefined to show the initials fallback. */
  imageUrl?: string | null;
  /** Name used to derive the fallback initials. */
  name?: string | null;
  /** Storage bucket to upload into (e.g. `avatars`, `company-logos`). */
  bucket: string;
  /** First path segment — the owner id (userId or companyId). */
  folder: string;
  /** Base file name (without extension). Default `avatar`. */
  fileName?: string;
  /** Button label. Default `Change photo`. */
  label?: string;
  /** Diameter / side length of the preview. Default 64. */
  size?: number;
  /** `circle` (people) or `rounded` (logos). Default `circle`. */
  shape?: 'circle' | 'rounded';
  /** Called with the uploaded image's public URL once the upload succeeds. */
  onUploaded: (publicUrl: string) => void | Promise<void>;
}

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const chars = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return chars.join('');
}

/**
 * Avatar/logo preview with a "Change photo" action. Picks an image, uploads it
 * to `{bucket}/{folder}/{fileName}.<ext>`, then hands the public URL back via
 * `onUploaded`. The picker works on web (hidden file input) and native.
 */
export function AvatarUpload({
  imageUrl,
  name,
  bucket,
  folder,
  fileName = 'avatar',
  label,
  size = 64,
  shape = 'circle',
  onUploaded,
}: AvatarUploadProps) {
  const t = useT();
  const { colors } = useTheme();
  const buttonLabel = label ?? t('compb.avatar.changePhoto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const radius = shape === 'circle' ? size / 2 : radii.md;

  const onPress = async () => {
    setError(null);
    setBusy(true);
    try {
      const url = await pickAndUploadImage(bucket, folder, fileName);
      if (url) await onUploaded(url);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View
          style={[
            styles.preview,
            { width: size, height: size, borderRadius: radius, backgroundColor: colors.fill },
          ]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: size, height: size, borderRadius: radius }}
              resizeMode="cover"
            />
          ) : (
            <Txt variant="title" tone="textMuted">
              {initialsOf(name)}
            </Txt>
          )}
        </View>
        <Button title={buttonLabel} variant="secondary" size="sm" onPress={onPress} loading={busy} />
      </View>
      {error ? (
        <InlineError
          error={error}
          message={error instanceof PermissionDeniedError ? error.message : undefined}
          describe={{ fallback: t('compb.avatar.uploadFail') }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  preview: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
