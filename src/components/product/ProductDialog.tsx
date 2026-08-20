import { useEffect, useRef, type ReactNode } from 'react'

interface ProductDialogProps {
  title: string
  descriptionId?: string
  className?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export function ProductDialog({
  title,
  descriptionId,
  className = '',
  children,
  footer,
  onClose,
}: ProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    if (dialog === null) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus()

    return () => {
      if (dialog.open) dialog.close()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby="product-dialog-title"
      className={`product-dialog${className === '' ? '' : ` ${className}`}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      ref={dialogRef}
    >
      <div className="product-dialog__surface">
        <header className="product-dialog__header">
          <div>
            <p className="eyebrow">MotionLab</p>
            <h1 id="product-dialog-title">{title}</h1>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="product-dialog__close"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="product-dialog__body">{children}</div>
        {footer !== undefined && <footer className="product-dialog__footer">{footer}</footer>}
      </div>
    </dialog>
  )
}
