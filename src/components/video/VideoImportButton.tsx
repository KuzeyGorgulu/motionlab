import { useRef } from 'react'

import { UploadIcon } from '../Icons'

interface VideoImportButtonProps {
  onSelect: (file: File) => void
  label?: string
  compact?: boolean
}

export function VideoImportButton({
  onSelect,
  label = 'Import video',
  compact = false,
}: VideoImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        accept="video/*"
        aria-label="Choose video file"
        className="file-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file !== undefined) {
            onSelect(file)
          }
          event.currentTarget.value = ''
        }}
        type="file"
      />
      <button
        className={compact ? 'button button--secondary' : 'button button--primary'}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <UploadIcon />
        {label}
      </button>
    </>
  )
}
