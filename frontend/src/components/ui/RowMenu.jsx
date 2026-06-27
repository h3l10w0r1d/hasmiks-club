import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

/**
 * RowMenu — lightweight overflow (⋯) action menu for table rows.
 * Renders the popover in a portal with fixed positioning so it never gets
 * clipped by table/card overflow. No extra dependencies.
 *
 * items: Array<{ icon?, label, onClick, danger?, separator? } | false | null>
 */
export function RowMenu({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const MENU_W = 208
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8))
    setCoords({ top: r.bottom + 6, left })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = () => setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place])

  const list = items.filter(Boolean)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="admin-rowmenu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} role="menu" className="admin-rowmenu" style={{ top: coords.top, left: coords.left }}>
          {list.map((it, i) => (
            it.separator
              ? <div key={i} className="admin-rowmenu-sep" />
              : (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={`admin-rowmenu-item${it.danger ? ' danger' : ''}`}
                  onClick={() => { setOpen(false); it.onClick?.() }}
                >
                  {it.icon && <it.icon className="h-4 w-4" />}
                  <span>{it.label}</span>
                </button>
              )
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

export default RowMenu
