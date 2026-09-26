const MAX_EDGE = 1080
const QUALITY = 0.8

// Resize to fit within 1080px and re-encode as JPEG (~80%) before upload.
// Re-encoding also strips EXIF metadata such as GPS location.
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("This photo format isn't supported. Please choose a JPEG or PNG.")
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process photo')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process photo'))), 'image/jpeg', QUALITY),
  )
}
