const FULL_EDGE = 1080
const FULL_QUALITY = 0.8
const THUMB_EDGE = 480
const THUMB_QUALITY = 0.75
const THUMB_MAX_BYTES = 60 * 1024
const THUMB_MIN_QUALITY = 0.5

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process photo'))), 'image/jpeg', quality),
  )
}

function draw(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process photo')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

// The full 1080px image plus a 480px card thumbnail, both JPEG. Re-encoding
// also strips EXIF metadata such as GPS location. The thumbnail steps its
// quality down until it is 60 KB or less (or hits the quality floor).
export async function processPhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("This photo format isn't supported. Please choose a JPEG or PNG.")
  }

  try {
    const full = await toJpeg(draw(bitmap, FULL_EDGE), FULL_QUALITY)
    const thumbCanvas = draw(bitmap, THUMB_EDGE)
    let quality = THUMB_QUALITY
    let thumb = await toJpeg(thumbCanvas, quality)
    while (thumb.size > THUMB_MAX_BYTES && quality > THUMB_MIN_QUALITY) {
      quality = Math.max(THUMB_MIN_QUALITY, Math.round((quality - 0.1) * 100) / 100)
      thumb = await toJpeg(thumbCanvas, quality)
    }
    return { full, thumb }
  } finally {
    bitmap.close()
  }
}
