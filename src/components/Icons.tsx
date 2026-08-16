import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
    >
      {children}
    </svg>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5 14.5v3A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5v-3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconFrame>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8.5 6.25v11.5L18 12 8.5 6.25z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </IconFrame>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8 6.5v11M16 6.5v11" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </IconFrame>
  )
}

export function StepBackIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6.5 6v12M17.5 7l-8 5 8 5V7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconFrame>
  )
}

export function StepForwardIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M17.5 6v12M6.5 7l8 5-8 5V7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconFrame>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 7h14M9 7V4.5h6V7m2 0-.7 12h-8.6L7 7m3 3.5v5m4-5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconFrame>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3.5l7 2.7v5.2c0 4.3-2.8 7.5-7 9.1-4.2-1.6-7-4.8-7-9.1V6.2l7-2.7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M8.8 11.8l2.1 2.1 4.5-4.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </IconFrame>
  )
}

export function FilmIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="15" rx="2" stroke="currentColor" strokeWidth="1.6" width="18" x="3" y="4.5" />
      <path d="M7 4.5v15m10-15v15M3 9h4m10 0h4M3 15h4m10 0h4" stroke="currentColor" strokeWidth="1.4" />
    </IconFrame>
  )
}
