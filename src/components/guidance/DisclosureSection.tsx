import type { ReactNode } from 'react'

interface DisclosureSectionProps {
  title: string
  summary?: string
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}

export function DisclosureSection({
  title,
  summary,
  children,
  className = '',
  defaultOpen = false,
}: DisclosureSectionProps) {
  return (
    <details
      className={`inspector-disclosure${className === '' ? '' : ` ${className}`}`}
      open={defaultOpen ? true : undefined}
    >
      <summary>
        <strong>{title}</strong>
        {summary !== undefined && <span>{summary}</span>}
      </summary>
      <div className="inspector-disclosure__body">{children}</div>
    </details>
  )
}
