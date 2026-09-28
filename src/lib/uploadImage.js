// src/lib/uploadImage.js
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

async function optimizeImage(file) {
  if (!file || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const maxSide = 2560;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1024 * 1024) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

export async function uploadImage(file, path) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no puede superar los 5 MB.');
  }
  const optimized = await optimizeImage(file);
  const safePath = optimized.name !== file.name ? path.replace(/\.[^.\\/]+$/, '') + '.webp' : path;
  const storageRef = ref(storage, safePath);
  const snapshot = await uploadBytes(storageRef, optimized, { contentType: optimized.type });
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

export async function deleteImageByUrl(url) {
  if (!url) return;
  await deleteObject(ref(storage, url));
}
