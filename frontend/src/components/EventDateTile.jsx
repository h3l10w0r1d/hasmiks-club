// Torn-calendar-page date tile: weekday+month on the rose header strip, the
// day number large underneath — pinned over an event cover image's corner.
// Shared by EventsPage.jsx and the dashboard's home event list so both
// render events identically.

// Intl has no short-month data for hy-AM in most JS engines (silently falls
// back to English), so Armenian abbreviations are spelled out by hand here.
const MONTHS_HY = ['ՀՆՎ', 'ՓԵՏ', 'ՄԱՐ', 'ԱՊՐ', 'ՄԱՅ', 'ՀՈՒՆ', 'ՀՈՒԼ', 'ՕԳՍ', 'ՍԵՊ', 'ՀՈԿ', 'ՆՈՅ', 'ԴԵԿ']

const styles = {
  dateTile: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 62,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 8px 24px rgba(24,12,4,.22)',
    textAlign: 'center',
    fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif",
  },
  dateTileTop: {
    background: '#7E3434',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 0',
  },
  dateTileDay: {
    color: '#2c1a1a',
    fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif",
    fontSize: 26,
    fontWeight: 700,
    padding: '4px 0 6px',
    lineHeight: 1,
  },
}

export default function DateTile({ iso, lang }) {
  const d = new Date(iso)
  const top = lang === 'hy' ? MONTHS_HY[d.getMonth()] : d.toLocaleDateString('en-GB', { month: 'short' })
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' })
  return (
    <div style={styles.dateTile}>
      <div style={styles.dateTileTop}>{top}</div>
      <div style={styles.dateTileDay}>{day}</div>
    </div>
  )
}
