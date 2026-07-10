import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { COUNTRIES } from '../data/countries'

const copy = {
  en: { label: 'Phone number', search: 'Search country…', noMatch: 'No matches' },
  hy: { label: 'Հեռախոսահամար', search: 'Փնտրել երկիր…', noMatch: 'Արդյունք չկա' },
}

export default function CountryPhoneInput({ lang = 'en', country, onCountryChange, number, onNumberChange, required = false }) {
  const t = copy[lang] ?? copy.en
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const filtered = COUNTRIES.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.code.includes(q)
  })

  const selected = country || COUNTRIES[0]

  const inputStyle = { border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#180C04' }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050', marginBottom: 6 }}>
        {t.label}
      </div>
      <div style={{ display: 'flex', gap: 8 }} ref={ref}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#fff', minWidth: 96 }}
          >
            <span>{selected.flag}</span>
            <span>{selected.code}</span>
            <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#786050' }} />
          </button>

          {open && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 20, width: 260,
              background: '#fff', border: '1px solid #DDD0BA', borderRadius: 10,
              boxShadow: '0 12px 32px rgba(0,0,0,.14)', overflow: 'hidden',
            }}>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid #EEE3D0', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <p style={{ padding: '14px 12px', fontSize: 13, color: '#A99B8A', margin: 0 }}>{t.noMatch}</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => { onCountryChange(c); setOpen(false); setSearch('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '9px 12px', border: 'none', background: c.name === selected.name ? '#FBF6EC' : 'transparent',
                        cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left', color: '#180C04',
                      }}
                    >
                      <span>{c.flag}</span>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ color: '#786050' }}>{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <input
          type="tel"
          inputMode="tel"
          required={required}
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s-]/g, ''))}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
      </div>
    </div>
  )
}
