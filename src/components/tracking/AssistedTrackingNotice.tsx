import { useEffect, useRef } from 'react'

interface AssistedTrackingNoticeProps {
  onCancel: () => void
  onContinue: () => void
}

export function AssistedTrackingNotice({
  onCancel,
  onContinue,
}: AssistedTrackingNoticeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      aria-describedby="assisted-tracking-notice-description"
      aria-labelledby="assisted-tracking-notice-title"
      className="assisted-tracking-notice"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      ref={dialogRef}
    >
      <div className="assisted-tracking-notice__heading">
        <span>Experimental</span>
        <h2 id="assisted-tracking-notice-title">
          Assisted Tracking is experimental.
        </h2>
      </div>
      <div id="assisted-tracking-notice-description">
        <p>
          It may lose the target or produce inaccurate suggestions, especially
          during fast motion, blur, occlusion, or visually ambiguous scenes.
        </p>
        <p>
          Review suggestions before accepting them and reseed manually when
          necessary.
        </p>
      </div>
      <div className="assisted-tracking-notice__actions">
        <button className="button button--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          autoFocus
          className="button button--primary"
          onClick={onContinue}
          type="button"
        >
          Continue
        </button>
      </div>
    </dialog>
  )
}
