import { DisclosureSection } from './DisclosureSection'

const SHORTCUT_GROUPS = [
  ['Space', 'Play or pause'],
  ['← / →', 'Step approximately one frame'],
  ['V / P / L / A', 'Select, Point, Line, or Angle'],
  ['T', 'Start or stop Track Mark'],
  ['Esc', 'Cancel the active interaction'],
  ['Delete', 'Delete the current point or selected annotation'],
  ['Ctrl/Cmd + Z', 'Undo the active editing domain'],
] as const

export function ShortcutHelp() {
  return (
    <section className="inspector__section inspector__section--disclosure">
      <DisclosureSection title="Keyboard shortcuts" summary="Fast controls">
        <dl className="shortcut-list">
          {SHORTCUT_GROUPS.map(([shortcut, description]) => (
            <div key={shortcut}>
              <dt><kbd>{shortcut}</kbd></dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <p className="inspector__note">
          Shortcuts pause while focus is inside a button, field, menu, or link.
        </p>
      </DisclosureSection>
    </section>
  )
}
