// The HTML-mode spotlight: one DOM element, alone, at a real width.
//
// The preview is an iframe built by utils/elementSpotlight.js, which is what
// makes it trustworthy rather than approximate — the page's own stylesheets,
// fonts and responsive rule come along, and the editor's chrome does not.

import { useState } from 'react'
import SpotlightShell from './SpotlightShell.jsx'
import HtmlElementPanel from './HtmlElementPanel.jsx'
import { elementSpotlightDocument } from '../../utils/elementSpotlight.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { useEditorStore } from '../../store/editorStore.js'

export default function ElementSpotlight({
  open,
  element,
  info,
  pages = [],
  onChange,
  onClose,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onSelectParent,
  onResetMobile,
}) {
  const { t } = useLanguage()
  const viewport = useEditorStore((state) => state.viewport)
  // Bumped on every edit so the preview is rebuilt from the element as it now
  // is. The element is mutated in place, so nothing else would tell React.
  const [revision, setRevision] = useState(0)

  if (!open || !element || !info) return null

  const handleChange = (patch) => {
    onChange?.(patch)
    setRevision((value) => value + 1)
  }

  return (
    <SpotlightShell
      open={open}
      onClose={onClose}
      initialWidth={viewport === 'mobile' ? 'phone' : 'desktop'}
      title={`<${info.tag}>`}
      subtitle={info.classes ? `.${info.classes.split(' ').join(' .')}` : ''}
      caption={(width) => t('Rendered with the page’s own styles at {width}px.', { width })}
      renderPreview={(width) => (
        <iframe
          key={`${revision}-${width}`}
          title={t('Open large')}
          srcDoc={elementSpotlightDocument(element.ownerDocument, element, { width })}
          sandbox=""
          className="block w-full rounded-xl border-0"
          style={{ height: 'min(70vh, 720px)' }}
        />
      )}
      panel={(
        <HtmlElementPanel
          info={info}
          viewport={viewport}
          pages={pages}
          onChange={handleChange}
          onSelectParent={onSelectParent}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={() => { onDelete?.(); onClose?.() }}
          onResetMobile={onResetMobile}
          onClose={onClose}
        />
      )}
    />
  )
}
