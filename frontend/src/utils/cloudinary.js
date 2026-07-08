// Injects Cloudinary's automatic format/quality transforms into a delivery
// URL — serves WebP/AVIF where the browser supports it and compresses
// intelligently, typically cutting payload size by more than half with no
// visible quality loss. Works retroactively on already-uploaded images
// (nothing to re-upload) since it only rewrites the URL at render time.
// Non-Cloudinary URLs (static assets, placeholders, null) pass through unchanged.
export function cldOptimize(url, { width } = {}) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  const transforms = ['f_auto', 'q_auto']
  if (width) transforms.push(`w_${width}`)
  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}
