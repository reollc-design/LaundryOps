export const MAX_REPAIR_ASSIST_PHOTOS = 3;
export const MAX_REPAIR_ASSIST_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_SELECTED_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_NORMALIZED_PHOTO_EDGE = 1_600;

const SUPPORTED_SELECTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const SUPPORTED_REPAIR_ASSIST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface RepairAssistImageInput {
  contentType: string;
  dataUrl: string;
}

function normalizedImageType(file: Pick<File, 'name' | 'type'>): string {
  const contentType = file.type.trim().toLowerCase();
  if (contentType === 'image/jpg') {
    return 'image/jpeg';
  }
  if (contentType) {
    return contentType;
  }

  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }
  if (extension === 'png') {
    return 'image/png';
  }
  if (extension === 'webp') {
    return 'image/webp';
  }
  if (extension === 'heic') {
    return 'image/heic';
  }
  if (extension === 'heif') {
    return 'image/heif';
  }
  return '';
}

function validateSelectedPhoto(file: File): void {
  const contentType = normalizedImageType(file);
  if (!SUPPORTED_SELECTED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Use a JPG, PNG, WebP, HEIC, or HEIF photo.');
  }
  if (file.size <= 0) {
    throw new Error('One selected photo is empty. Choose a different image.');
  }
  if (file.size > MAX_SELECTED_PHOTO_BYTES) {
    throw new Error('The selected photo is too large. Choose an image under 15 MB.');
  }
}

async function imageElementFromFile(file: File): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This device could not open this photo. Take a new photo or use a JPG.'));
      image.src = imageUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function normalizeRepairAssistPhoto(file: File): Promise<File> {
  validateSelectedPhoto(file);
  const image = await imageElementFromFile(file);
  const scale = Math.min(1, MAX_NORMALIZED_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This device could not prepare the selected photo.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This device could not prepare the selected photo.')),
      'image/jpeg',
      0.86,
    );
  });
  if (normalizedBlob.size > MAX_REPAIR_ASSIST_PHOTO_BYTES) {
    throw new Error('The prepared photo is still over 5 MB. Crop it or take a closer photo.');
  }

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'machine-photo';
  return new File([normalizedBlob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

export async function mergeRepairAssistPhotoFiles(current: File[], incoming: File[]): Promise<File[]> {
  if (incoming.length === 0) {
    return current;
  }

  const availableSlots = MAX_REPAIR_ASSIST_PHOTOS - current.length;
  if (availableSlots <= 0 || incoming.length > availableSlots) {
    throw new Error(`Add up to ${MAX_REPAIR_ASSIST_PHOTOS} photos per diagnosis.`);
  }

  const existingKeys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const uniqueIncoming = incoming.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  const normalizedIncoming: File[] = [];
  for (const file of uniqueIncoming) {
    normalizedIncoming.push(await normalizeRepairAssistPhoto(file));
  }
  return [...current, ...normalizedIncoming];
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read a selected photo.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not prepare a selected photo.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function prepareRepairAssistImages(files: File[]): Promise<RepairAssistImageInput[]> {
  if (files.length > MAX_REPAIR_ASSIST_PHOTOS) {
    throw new Error(`Add up to ${MAX_REPAIR_ASSIST_PHOTOS} photos per diagnosis.`);
  }
  for (const file of files) {
    if (!SUPPORTED_REPAIR_ASSIST_IMAGE_TYPES.has(normalizedImageType(file)) || file.size > MAX_REPAIR_ASSIST_PHOTO_BYTES) {
      throw new Error('One selected photo is not ready for analysis. Remove it and add it again.');
    }
  }
  return Promise.all(files.map(async (file) => ({
    contentType: normalizedImageType(file),
    dataUrl: await blobToDataUrl(file),
  })));
}
