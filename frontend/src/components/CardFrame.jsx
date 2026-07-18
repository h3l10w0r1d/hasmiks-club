import { ArrowLeft, ArrowRight, EyeOff } from 'lucide-react'
import { EDIT_ACTION_MSG } from '../context/SiteContentContext'

function post(msg) {
  try { window.parent?.postMessage(msg, window.location.origin) } catch { /* noop */ }
}

// Wraps one card in a repeatable list (Community's "what you get" cards,
// Pricing's plan cards) with a hover toolbar to move it left/right within the
// list or hide it — the card-level analogue of BlockFrame for whole sections.
// orderPath/hiddenPath point at the section's __xOrder/__xHidden overrides;
// itemCount is the total number of cards in the underlying content array.
export default function CardFrame({ orderPath, hiddenPath, itemCount, index, canLeft, canRight, dimmed, children }) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation() }
  const send = (action) => post({ type: EDIT_ACTION_MSG, target: 'card', orderPath, hiddenPath, itemCount, index, action })
  return (
    <div className="hc-card" style={{ position: 'relative', opacity: dimmed ? 0.35 : 1 }}>
      <div className="hc-card-toolbar" onClick={stop}>
        <button type="button" title="Move left" disabled={!canLeft} onClick={(e) => { stop(e); send('left') }}><ArrowLeft size={14} /></button>
        <button type="button" title="Move right" disabled={!canRight} onClick={(e) => { stop(e); send('right') }}><ArrowRight size={14} /></button>
        <button type="button" title="Hide card" onClick={(e) => { stop(e); send('hide') }}><EyeOff size={14} /></button>
      </div>
      {children}
    </div>
  )
}
