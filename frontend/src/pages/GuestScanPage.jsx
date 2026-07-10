import '../admin.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { QrCode, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminGuestTicketCheckin } from '../api/admin'

const READER_ID = 'guest-scan-reader'

export default function GuestScanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const scannerRef = useRef(null)
  const busyRef = useRef(false)
  const [cameraError, setCameraError] = useState('')
  const [result, setResult] = useState(null) // { kind: 'ok'|'repeat'|'error', ...details }

  const handleScan = async (payload) => {
    if (busyRef.current) return
    busyRef.current = true
    if (scannerRef.current) {
      try { await scannerRef.current.pause(true) } catch { /* ignore */ }
    }
    try {
      const res = await adminGuestTicketCheckin(payload)
      setResult({
        kind: res.already_checked_in ? 'repeat' : 'ok',
        full_name: res.full_name,
        email: res.email,
        event_title: res.event_title,
        event_date: res.event_date,
      })
    } catch (err) {
      setResult({ kind: 'error', message: err?.response?.data?.detail || 'Scan failed — please try again.' })
    }
  }
  const handleScanRef = useRef(handleScan)
  useEffect(() => { handleScanRef.current = handleScan })

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID)
    scannerRef.current = scanner

    // start() rejects on camera failure, but some environments (no camera
    // device present at all) throw synchronously instead — queue the error
    // state update as a microtask so it never lands synchronously inside the
    // effect body itself.
    Promise.resolve()
      .then(() => scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => handleScanRef.current(decodedText),
        () => {},
      ))
      .catch((err) => setCameraError(err?.message || String(err)))

    return () => {
      const s = scannerRef.current
      if (!s) return
      // start() may still be pending, or may have failed, when this runs (fast
      // unmount, React StrictMode double-invoke, camera permission denied) —
      // stop() throws synchronously rather than rejecting in that case, so it
      // must be gated on actual scanner state instead of relied on to reject.
      if (s.getState() === Html5QrcodeScannerState.SCANNING || s.getState() === Html5QrcodeScannerState.PAUSED) {
        s.stop().then(() => s.clear()).catch(() => {})
      } else {
        try { s.clear() } catch { /* ignore */ }
      }
    }
  }, [])

  const resumeScanning = () => {
    setResult(null)
    busyRef.current = false
    if (scannerRef.current) {
      try { scannerRef.current.resume() } catch { /* ignore */ }
    }
  }

  return (
    <div className="admin-shell" style={{ minHeight: '100vh', background: 'hsl(var(--background))', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid hsl(var(--border))', background: '#fff' }}>
        <button onClick={() => navigate('/admin')} aria-label="Back" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'hsl(var(--foreground))' }}>
          <ArrowLeft size={20} />
        </button>
        <QrCode size={18} style={{ color: 'hsl(var(--primary))' }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: 'hsl(var(--foreground))' }}>Ticket Check-In</span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px 40px', gap: 16 }}>
        {!user?.is_admin ? (
          <p style={{ fontSize: 15, color: 'hsl(var(--destructive))', textAlign: 'center', marginTop: 40 }}>Admin access required.</p>
        ) : (
          <>
            <div
              style={{
                width: '100%', maxWidth: 420, borderRadius: 16, overflow: 'hidden', background: '#000',
                aspectRatio: '1 / 1', position: 'relative', boxShadow: '0 8px 30px rgba(0,0,0,.18)',
              }}
            >
              <div id={READER_ID} style={{ width: '100%', height: '100%' }} />
            </div>

            {cameraError && (
              <p style={{ fontSize: 14, color: 'hsl(var(--destructive))', textAlign: 'center', maxWidth: 420 }}>
                Couldn't access the camera: {cameraError}. Check camera permissions for this site.
              </p>
            )}

            {!result && !cameraError && (
              <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                Point the camera at a guest's ticket QR code.
              </p>
            )}

            {result && (
              <div
                onClick={resumeScanning}
                style={{
                  width: '100%', maxWidth: 420, borderRadius: 14, padding: '20px 18px', cursor: 'pointer',
                  background: result.kind === 'ok' ? '#e9f7ef' : result.kind === 'repeat' ? '#fff6e5' : '#fceceb',
                  border: `1px solid ${result.kind === 'ok' ? '#8fd6ab' : result.kind === 'repeat' ? '#f0c76b' : '#e7a39c'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {result.kind === 'ok' && <CheckCircle2 size={26} color="#1e8a4c" />}
                  {result.kind === 'repeat' && <AlertTriangle size={26} color="#b8860b" />}
                  {result.kind === 'error' && <XCircle size={26} color="#c0392b" />}
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#180C04' }}>
                    {result.kind === 'ok' && 'Checked in'}
                    {result.kind === 'repeat' && 'Already checked in'}
                    {result.kind === 'error' && 'Not admitted'}
                  </span>
                </div>

                {result.kind !== 'error' ? (
                  <>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#180C04', margin: '2px 0' }}>{result.full_name}</p>
                    <p style={{ fontSize: 14, color: '#786050', margin: '2px 0' }}>{result.email}</p>
                    {result.event_title && <p style={{ fontSize: 14, color: '#786050', margin: '2px 0' }}>{result.event_title}</p>}
                  </>
                ) : (
                  <p style={{ fontSize: 15, color: '#7E3434' }}>{result.message}</p>
                )}

                <p style={{ fontSize: 12, color: '#A99B8A', marginTop: 12, textAlign: 'center' }}>Tap anywhere to scan the next ticket</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
