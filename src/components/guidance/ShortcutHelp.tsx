import { DisclosureSection } from './DisclosureSection'
import { SHORTCUT_GROUPS } from '../../product/content'

export function ShortcutHelp() {
  return (
    <section className="inspector__section inspector__section--disclosure">
      <DisclosureSection title="Keyboard shortcuts" summary="Fast controls">
        <dl className="shortcut-list">
          {SHORTCUT_GROUPS.flatMap((group) => group.items).map((item) => (
            <div key={item.keys}>
              <dt><kbd>{item.keys}</kbd></dt>
              <dd>{item.description}</dd>
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
