export const MAX_MANUAL_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface ManualUploadMetadata {
  fileName: string;
  contentType: string | undefined;
  sizeBytes: number;
}

export function isApprovedManualUpload(metadata: ManualUploadMetadata): boolean {
  return metadata.contentType === 'application/pdf'
    && /\.pdf$|\.PDF$/.test(metadata.fileName)
    && Number.isFinite(metadata.sizeBytes)
    && metadata.sizeBytes >= 0
    && metadata.sizeBytes <= MAX_MANUAL_UPLOAD_BYTES;
}
