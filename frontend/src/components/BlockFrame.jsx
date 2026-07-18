import { Settings2, ArrowUp, ArrowDown, EyeOff } from 'lucide-react'

// Wraps a landing section when the page is rendered inside the Site Editor's
// on-canvas preview (/preview?edit=1). Gives it a hover outline, click-to-select,
// and a floating toolbar (settings / move / hide) — the "select a block on the
// page" experience. Actions are handled by the parent editor via postMessage.
export default function BlockFrame({ id, label, selected, canUp, canDown, onSelect, onAction, children }) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation() }

  return (
    <div
      data-block-id={id}
      onClick={(e) => { stop(e); onSelect(id) }}
      style={{ position: 'relative', cursor: 'pointer' }}
      className={`hc-block ${selected ? 'hc-block--selected' : ''}`}
    >
      {/* label chip (top-left) */}
      <span className="hc-block-label">{label}</span>

      {/* floating toolbar (top-right) — only on the selected block */}
      {selected && (
        <div className="hc-block-toolbar" onClick={stop}>
          <button type="button" title="Settings" onClick={(e) => { stop(e); onAction(id, 'settings') }}><Settings2 size={15} /></button>
          <button type="button" title="Move up" disabled={!canUp} onClick={(e) => { stop(e); onAction(id, 'up') }}><ArrowUp size={15} /></button>
          <button type="button" title="Move down" disabled={!canDown} onClick={(e) => { stop(e); onAction(id, 'down') }}><ArrowDown size={15} /></button>
          <button type="button" title="Hide block" onClick={(e) => { stop(e); onAction(id, 'hide') }}><EyeOff size={15} /></button>
        </div>
      )}

      {/* the actual section — pointer events pass through to the frame */}
      <div style={{ pointerEvents: 'none' }}>{children}</div>
    </div>
  )
}
