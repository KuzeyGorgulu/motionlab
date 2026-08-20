import { useRef } from 'react'

interface ProjectOpenButtonProps {
  className?: string
  label?: string
  onOpen: (file: File) => void
}

export function ProjectOpenButton({
  className = 'button button--secondary',
  label = 'Open project',
  onOpen,
}: ProjectOpenButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        accept=".motionlab,application/json"
        aria-label="Choose MotionLab project file"
        className="file-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file !== undefined) onOpen(file)
          event.currentTarget.value = ''
        }}
        ref={inputRef}
        type="file"
      />
      <button
        className={className}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {label}
      </button>
    </>
  )
}
