export const MAX_MANUAL_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isApprovedManualUpload(fileName: string, contentType: string, sizeBytes: number): boolean {
  return contentType === 'application/pdf'
    && /\.pdf$|\.PDF$/.test(fileName)
    && Number.isFinite(sizeBytes)
    && sizeBytes >= 0
    && sizeBytes <= MAX_MANUAL_UPLOAD_BYTES;
}
