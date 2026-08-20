export function downloadTextFile(
  contents: string,
  filename: string,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportFilenameForVideo(
  videoName: string,
  suffix: string,
  extension: string,
): string {
  const base = videoName.replace(/\.[^.]+$/, '').trim() || 'motionlab-data'
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-')
  return `${safe}-${suffix}.${extension}`
}
