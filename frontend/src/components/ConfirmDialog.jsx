// Bilingual, senior-friendly confirmation dialog for member-facing destructive
// actions (cancel RSVP, delete photo, disconnect a login method, etc.) — large
// text, high-contrast buttons, and an explicit Cancel so a mis-tap never
// silently fires the action.
export default function ConfirmDialog({ lang = 'en', title, body, confirmLabel, danger = true, onConfirm, onCancel }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(44,26,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: '30px 28px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ fontSize: 19, fontWeight: 700, color: 'var(--deep, #180C04)', marginBottom: 10, lineHeight: 1.4 }}>{title}</p>
        {body && <p style={{ fontSize: 16, color: '#555', marginBottom: 26, lineHeight: 1.6 }}>{body}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
            style={{
              padding: '14px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: danger ? '#c0392b' : 'var(--rose, #7E3434)', color: '#fff',
              fontSize: 16, fontWeight: 700, fontFamily: 'inherit', minHeight: 48,
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '14px 20px', borderRadius: 10, border: '1px solid var(--sand, #DDD0BA)', cursor: 'pointer',
              background: '#fff', color: 'var(--taupe, #786050)',
              fontSize: 16, fontWeight: 600, fontFamily: 'inherit', minHeight: 48,
            }}
          >
            {lang === 'hy' ? 'Հետ վերադառնալ' : 'Go back'}
          </button>
        </div>
      </div>
    </div>
  )
}
