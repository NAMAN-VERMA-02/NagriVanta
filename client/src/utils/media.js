import exifr from 'exifr';

// Vercel rejects request bodies over ~4.5 MB, so photos are resized on the device before upload.
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function compressImage(file, { maxSide = 1600, quality = 0.8 } = {}) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg', lastModified: file.lastModified });
}

// GPS + capture time from the ORIGINAL photo (compression drops EXIF). The server re-reads it too.
export async function readPhotoMeta(file) {
  try {
    const e = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal', 'latitude', 'longitude'] });
    return { lat: e?.latitude, lng: e?.longitude, takenAt: e?.DateTimeOriginal };
  } catch {
    return {};
  }
}

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

export async function dataUrlToFile(url, name) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type });
}
