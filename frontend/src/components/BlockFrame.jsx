import { ArrowUp, ArrowDown, EyeOff } from 'lucide-react'

// Wraps a landing section on the editor canvas (/preview?edit=1). Hovering the
// block reveals its outline, a label chip, and a floating toolbar (move / hide).
// Text and images inside stay directly interactive so they can be edited in
// place — so this frame does NOT capture clicks or block pointer events.
export default function BlockFrame({ id, label, canUp, canDown, onAction, children }) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation() }
  return (
    <div data-block-id={id} className="hc-block" style={{ position: 'relative' }}>
      <span className="hc-block-label">{label}</span>
      <div className="hc-block-toolbar" onClick={stop}>
        <button type="button" title="Move up" disabled={!canUp} onClick={(e) => { stop(e); onAction(id, 'up') }}><ArrowUp size={15} /></button>
        <button type="button" title="Move down" disabled={!canDown} onClick={(e) => { stop(e); onAction(id, 'down') }}><ArrowDown size={15} /></button>
        <button type="button" title="Hide block" onClick={(e) => { stop(e); onAction(id, 'hide') }}><EyeOff size={15} /></button>
      </div>
      {children}
    </div>
  )
}
