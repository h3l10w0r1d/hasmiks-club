import { useState } from 'react'
import { ArrowUp, ArrowDown, EyeOff, Trash2, Palette } from 'lucide-react'

const BG_OPTIONS = [
  { value: 'default', label: 'Default', swatch: '#fff' },
  { value: 'cream', label: 'Cream', swatch: '#FAF7F2' },
  { value: 'sand', label: 'Sand', swatch: '#DDD0BA' },
  { value: 'dark', label: 'Dark', swatch: '#180C04' },
]
const SPACING_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'roomy', label: 'Roomy' },
]

// Wraps a landing section on the editor canvas (/preview?edit=1). Hovering the
// block reveals its outline, a label chip, and a floating toolbar (move / hide
// / style / delete). Text and images inside stay directly interactive so they
// can be edited in place — so this frame does NOT capture clicks or block
// pointer events. Style + delete are only offered for custom (addable) blocks;
// the fixed designed sections (Hero, Story, etc.) keep their own layout.
export default function BlockFrame({ id, label, canUp, canDown, onAction, isCustom, bg, spacing, children }) {
  const [styleOpen, setStyleOpen] = useState(false)
  const stop = (e) => { e.preventDefault(); e.stopPropagation() }
  const setStyle = (styleKey, value) => onAction(id, 'style', { styleKey, value })
  return (
    <div data-block-id={id} className="hc-block" style={{ position: 'relative' }}>
      <span className="hc-block-label">{label}</span>
      <div className="hc-block-toolbar" onClick={stop}>
        <button type="button" title="Move up" disabled={!canUp} onClick={(e) => { stop(e); onAction(id, 'up') }}><ArrowUp size={15} /></button>
        <button type="button" title="Move down" disabled={!canDown} onClick={(e) => { stop(e); onAction(id, 'down') }}><ArrowDown size={15} /></button>
        <button type="button" title="Hide block" onClick={(e) => { stop(e); onAction(id, 'hide') }}><EyeOff size={15} /></button>
        {isCustom && (
          <span style={{ position: 'relative' }}>
            <button type="button" title="Style" onClick={(e) => { stop(e); setStyleOpen((o) => !o) }}><Palette size={15} /></button>
            {styleOpen && (
              <div className="hc-style-pop" onClick={stop}>
                <div className="hc-style-pop-label">Background</div>
                <div className="hc-style-swatches">
                  {BG_OPTIONS.map((o) => (
                    <button key={o.value} type="button" title={o.label}
                      className={`hc-swatch${bg === o.value || (!bg && o.value === 'default') ? ' hc-swatch--active' : ''}`}
                      style={{ background: o.swatch }} onClick={() => setStyle('bg', o.value)} />
                  ))}
                </div>
                <div className="hc-style-pop-label">Spacing</div>
                <div className="hc-style-spacing">
                  {SPACING_OPTIONS.map((o) => (
                    <button key={o.value} type="button"
                      className={`hc-spacing-btn${spacing === o.value || (!spacing && o.value === 'default') ? ' hc-spacing-btn--active' : ''}`}
                      onClick={() => setStyle('spacing', o.value)}>{o.label}</button>
                  ))}
                </div>
              </div>
            )}
          </span>
        )}
        {isCustom && (
          <button type="button" title="Delete block" onClick={(e) => {
            stop(e)
            if (window.confirm('Delete this block? This removes it from the draft (you can still Undo).')) onAction(id, 'delete')
          }}><Trash2 size={15} /></button>
        )}
      </div>
      {children}
    </div>
  )
}
