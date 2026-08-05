import { useEffect, useMemo, useRef, useState } from 'react'

// Full ITU-ish calling-code list. Armenia is pinned to the top of the
// closed (unfiltered) list since this club's primary audience is Armenian —
// everyone else stays in plain alphabetical order below it.
export const COUNTRY_CODES = [
  { name: 'Armenia', flag: '🇦🇲', code: '+374' },
  { name: 'Afghanistan', flag: '🇦🇫', code: '+93' },
  { name: 'Albania', flag: '🇦🇱', code: '+355' },
  { name: 'Algeria', flag: '🇩🇿', code: '+213' },
  { name: 'American Samoa', flag: '🇦🇸', code: '+1-684' },
  { name: 'Andorra', flag: '🇦🇩', code: '+376' },
  { name: 'Angola', flag: '🇦🇴', code: '+244' },
  { name: 'Anguilla', flag: '🇦🇮', code: '+1-264' },
  { name: 'Antigua and Barbuda', flag: '🇦🇬', code: '+1-268' },
  { name: 'Argentina', flag: '🇦🇷', code: '+54' },
  { name: 'Aruba', flag: '🇦🇼', code: '+297' },
  { name: 'Australia', flag: '🇦🇺', code: '+61' },
  { name: 'Austria', flag: '🇦🇹', code: '+43' },
  { name: 'Azerbaijan', flag: '🇦🇿', code: '+994' },
  { name: 'Bahamas', flag: '🇧🇸', code: '+1-242' },
  { name: 'Bahrain', flag: '🇧🇭', code: '+973' },
  { name: 'Bangladesh', flag: '🇧🇩', code: '+880' },
  { name: 'Barbados', flag: '🇧🇧', code: '+1-246' },
  { name: 'Belarus', flag: '🇧🇾', code: '+375' },
  { name: 'Belgium', flag: '🇧🇪', code: '+32' },
  { name: 'Belize', flag: '🇧🇿', code: '+501' },
  { name: 'Benin', flag: '🇧🇯', code: '+229' },
  { name: 'Bermuda', flag: '🇧🇲', code: '+1-441' },
  { name: 'Bhutan', flag: '🇧🇹', code: '+975' },
  { name: 'Bolivia', flag: '🇧🇴', code: '+591' },
  { name: 'Bosnia and Herzegovina', flag: '🇧🇦', code: '+387' },
  { name: 'Botswana', flag: '🇧🇼', code: '+267' },
  { name: 'Brazil', flag: '🇧🇷', code: '+55' },
  { name: 'Brunei', flag: '🇧🇳', code: '+673' },
  { name: 'Bulgaria', flag: '🇧🇬', code: '+359' },
  { name: 'Burkina Faso', flag: '🇧🇫', code: '+226' },
  { name: 'Burundi', flag: '🇧🇮', code: '+257' },
  { name: 'Cabo Verde', flag: '🇨🇻', code: '+238' },
  { name: 'Cambodia', flag: '🇰🇭', code: '+855' },
  { name: 'Cameroon', flag: '🇨🇲', code: '+237' },
  { name: 'Canada', flag: '🇨🇦', code: '+1' },
  { name: 'Cayman Islands', flag: '🇰🇾', code: '+1-345' },
  { name: 'Central African Republic', flag: '🇨🇫', code: '+236' },
  { name: 'Chad', flag: '🇹🇩', code: '+235' },
  { name: 'Chile', flag: '🇨🇱', code: '+56' },
  { name: 'China', flag: '🇨🇳', code: '+86' },
  { name: 'Colombia', flag: '🇨🇴', code: '+57' },
  { name: 'Comoros', flag: '🇰🇲', code: '+269' },
  { name: 'Congo (Brazzaville)', flag: '🇨🇬', code: '+242' },
  { name: 'Congo (Kinshasa)', flag: '🇨🇩', code: '+243' },
  { name: 'Cook Islands', flag: '🇨🇰', code: '+682' },
  { name: 'Costa Rica', flag: '🇨🇷', code: '+506' },
  { name: 'Croatia', flag: '🇭🇷', code: '+385' },
  { name: 'Cuba', flag: '🇨🇺', code: '+53' },
  { name: 'Curaçao', flag: '🇨🇼', code: '+599' },
  { name: 'Cyprus', flag: '🇨🇾', code: '+357' },
  { name: 'Czech Republic', flag: '🇨🇿', code: '+420' },
  { name: 'Denmark', flag: '🇩🇰', code: '+45' },
  { name: 'Djibouti', flag: '🇩🇯', code: '+253' },
  { name: 'Dominica', flag: '🇩🇲', code: '+1-767' },
  { name: 'Dominican Republic', flag: '🇩🇴', code: '+1-809' },
  { name: 'Ecuador', flag: '🇪🇨', code: '+593' },
  { name: 'Egypt', flag: '🇪🇬', code: '+20' },
  { name: 'El Salvador', flag: '🇸🇻', code: '+503' },
  { name: 'Equatorial Guinea', flag: '🇬🇶', code: '+240' },
  { name: 'Eritrea', flag: '🇪🇷', code: '+291' },
  { name: 'Estonia', flag: '🇪🇪', code: '+372' },
  { name: 'Eswatini', flag: '🇸🇿', code: '+268' },
  { name: 'Ethiopia', flag: '🇪🇹', code: '+251' },
  { name: 'Fiji', flag: '🇫🇯', code: '+679' },
  { name: 'Finland', flag: '🇫🇮', code: '+358' },
  { name: 'France', flag: '🇫🇷', code: '+33' },
  { name: 'French Guiana', flag: '🇬🇫', code: '+594' },
  { name: 'French Polynesia', flag: '🇵🇫', code: '+689' },
  { name: 'Gabon', flag: '🇬🇦', code: '+241' },
  { name: 'Gambia', flag: '🇬🇲', code: '+220' },
  { name: 'Georgia', flag: '🇬🇪', code: '+995' },
  { name: 'Germany', flag: '🇩🇪', code: '+49' },
  { name: 'Ghana', flag: '🇬🇭', code: '+233' },
  { name: 'Gibraltar', flag: '🇬🇮', code: '+350' },
  { name: 'Greece', flag: '🇬🇷', code: '+30' },
  { name: 'Greenland', flag: '🇬🇱', code: '+299' },
  { name: 'Grenada', flag: '🇬🇩', code: '+1-473' },
  { name: 'Guadeloupe', flag: '🇬🇵', code: '+590' },
  { name: 'Guam', flag: '🇬🇺', code: '+1-671' },
  { name: 'Guatemala', flag: '🇬🇹', code: '+502' },
  { name: 'Guernsey', flag: '🇬🇬', code: '+44-1481' },
  { name: 'Guinea', flag: '🇬🇳', code: '+224' },
  { name: 'Guinea-Bissau', flag: '🇬🇼', code: '+245' },
  { name: 'Guyana', flag: '🇬🇾', code: '+592' },
  { name: 'Haiti', flag: '🇭🇹', code: '+509' },
  { name: 'Honduras', flag: '🇭🇳', code: '+504' },
  { name: 'Hong Kong', flag: '🇭🇰', code: '+852' },
  { name: 'Hungary', flag: '🇭🇺', code: '+36' },
  { name: 'Iceland', flag: '🇮🇸', code: '+354' },
  { name: 'India', flag: '🇮🇳', code: '+91' },
  { name: 'Indonesia', flag: '🇮🇩', code: '+62' },
  { name: 'Iran', flag: '🇮🇷', code: '+98' },
  { name: 'Iraq', flag: '🇮🇶', code: '+964' },
  { name: 'Ireland', flag: '🇮🇪', code: '+353' },
  { name: 'Isle of Man', flag: '🇮🇲', code: '+44-1624' },
  { name: 'Israel', flag: '🇮🇱', code: '+972' },
  { name: 'Italy', flag: '🇮🇹', code: '+39' },
  { name: 'Ivory Coast', flag: '🇨🇮', code: '+225' },
  { name: 'Jamaica', flag: '🇯🇲', code: '+1-876' },
  { name: 'Japan', flag: '🇯🇵', code: '+81' },
  { name: 'Jersey', flag: '🇯🇪', code: '+44-1534' },
  { name: 'Jordan', flag: '🇯🇴', code: '+962' },
  { name: 'Kazakhstan', flag: '🇰🇿', code: '+7' },
  { name: 'Kenya', flag: '🇰🇪', code: '+254' },
  { name: 'Kiribati', flag: '🇰🇮', code: '+686' },
  { name: 'Kosovo', flag: '🇽🇰', code: '+383' },
  { name: 'Kuwait', flag: '🇰🇼', code: '+965' },
  { name: 'Kyrgyzstan', flag: '🇰🇬', code: '+996' },
  { name: 'Laos', flag: '🇱🇦', code: '+856' },
  { name: 'Latvia', flag: '🇱🇻', code: '+371' },
  { name: 'Lebanon', flag: '🇱🇧', code: '+961' },
  { name: 'Lesotho', flag: '🇱🇸', code: '+266' },
  { name: 'Liberia', flag: '🇱🇷', code: '+231' },
  { name: 'Libya', flag: '🇱🇾', code: '+218' },
  { name: 'Liechtenstein', flag: '🇱🇮', code: '+423' },
  { name: 'Lithuania', flag: '🇱🇹', code: '+370' },
  { name: 'Luxembourg', flag: '🇱🇺', code: '+352' },
  { name: 'Macao', flag: '🇲🇴', code: '+853' },
  { name: 'Madagascar', flag: '🇲🇬', code: '+261' },
  { name: 'Malawi', flag: '🇲🇼', code: '+265' },
  { name: 'Malaysia', flag: '🇲🇾', code: '+60' },
  { name: 'Maldives', flag: '🇲🇻', code: '+960' },
  { name: 'Mali', flag: '🇲🇱', code: '+223' },
  { name: 'Malta', flag: '🇲🇹', code: '+356' },
  { name: 'Marshall Islands', flag: '🇲🇭', code: '+692' },
  { name: 'Martinique', flag: '🇲🇶', code: '+596' },
  { name: 'Mauritania', flag: '🇲🇷', code: '+222' },
  { name: 'Mauritius', flag: '🇲🇺', code: '+230' },
  { name: 'Mayotte', flag: '🇾🇹', code: '+262' },
  { name: 'Mexico', flag: '🇲🇽', code: '+52' },
  { name: 'Micronesia', flag: '🇫🇲', code: '+691' },
  { name: 'Moldova', flag: '🇲🇩', code: '+373' },
  { name: 'Monaco', flag: '🇲🇨', code: '+377' },
  { name: 'Mongolia', flag: '🇲🇳', code: '+976' },
  { name: 'Montenegro', flag: '🇲🇪', code: '+382' },
  { name: 'Montserrat', flag: '🇲🇸', code: '+1-664' },
  { name: 'Morocco', flag: '🇲🇦', code: '+212' },
  { name: 'Mozambique', flag: '🇲🇿', code: '+258' },
  { name: 'Myanmar', flag: '🇲🇲', code: '+95' },
  { name: 'Namibia', flag: '🇳🇦', code: '+264' },
  { name: 'Nauru', flag: '🇳🇷', code: '+674' },
  { name: 'Nepal', flag: '🇳🇵', code: '+977' },
  { name: 'Netherlands', flag: '🇳🇱', code: '+31' },
  { name: 'New Caledonia', flag: '🇳🇨', code: '+687' },
  { name: 'New Zealand', flag: '🇳🇿', code: '+64' },
  { name: 'Nicaragua', flag: '🇳🇮', code: '+505' },
  { name: 'Niger', flag: '🇳🇪', code: '+227' },
  { name: 'Nigeria', flag: '🇳🇬', code: '+234' },
  { name: 'Niue', flag: '🇳🇺', code: '+683' },
  { name: 'North Korea', flag: '🇰🇵', code: '+850' },
  { name: 'North Macedonia', flag: '🇲🇰', code: '+389' },
  { name: 'Northern Mariana Islands', flag: '🇲🇵', code: '+1-670' },
  { name: 'Norway', flag: '🇳🇴', code: '+47' },
  { name: 'Oman', flag: '🇴🇲', code: '+968' },
  { name: 'Pakistan', flag: '🇵🇰', code: '+92' },
  { name: 'Palau', flag: '🇵🇼', code: '+680' },
  { name: 'Palestine', flag: '🇵🇸', code: '+970' },
  { name: 'Panama', flag: '🇵🇦', code: '+507' },
  { name: 'Papua New Guinea', flag: '🇵🇬', code: '+675' },
  { name: 'Paraguay', flag: '🇵🇾', code: '+595' },
  { name: 'Peru', flag: '🇵🇪', code: '+51' },
  { name: 'Philippines', flag: '🇵🇭', code: '+63' },
  { name: 'Poland', flag: '🇵🇱', code: '+48' },
  { name: 'Portugal', flag: '🇵🇹', code: '+351' },
  { name: 'Puerto Rico', flag: '🇵🇷', code: '+1-787' },
  { name: 'Qatar', flag: '🇶🇦', code: '+974' },
  { name: 'Réunion', flag: '🇷🇪', code: '+262' },
  { name: 'Romania', flag: '🇷🇴', code: '+40' },
  { name: 'Russia', flag: '🇷🇺', code: '+7' },
  { name: 'Rwanda', flag: '🇷🇼', code: '+250' },
  { name: 'Saint Kitts and Nevis', flag: '🇰🇳', code: '+1-869' },
  { name: 'Saint Lucia', flag: '🇱🇨', code: '+1-758' },
  { name: 'Saint Vincent and the Grenadines', flag: '🇻🇨', code: '+1-784' },
  { name: 'Samoa', flag: '🇼🇸', code: '+685' },
  { name: 'San Marino', flag: '🇸🇲', code: '+378' },
  { name: 'São Tomé and Príncipe', flag: '🇸🇹', code: '+239' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: '+966' },
  { name: 'Senegal', flag: '🇸🇳', code: '+221' },
  { name: 'Serbia', flag: '🇷🇸', code: '+381' },
  { name: 'Seychelles', flag: '🇸🇨', code: '+248' },
  { name: 'Sierra Leone', flag: '🇸🇱', code: '+232' },
  { name: 'Singapore', flag: '🇸🇬', code: '+65' },
  { name: 'Sint Maarten', flag: '🇸🇽', code: '+1-721' },
  { name: 'Slovakia', flag: '🇸🇰', code: '+421' },
  { name: 'Slovenia', flag: '🇸🇮', code: '+386' },
  { name: 'Solomon Islands', flag: '🇸🇧', code: '+677' },
  { name: 'Somalia', flag: '🇸🇴', code: '+252' },
  { name: 'South Africa', flag: '🇿🇦', code: '+27' },
  { name: 'South Korea', flag: '🇰🇷', code: '+82' },
  { name: 'South Sudan', flag: '🇸🇸', code: '+211' },
  { name: 'Spain', flag: '🇪🇸', code: '+34' },
  { name: 'Sri Lanka', flag: '🇱🇰', code: '+94' },
  { name: 'Sudan', flag: '🇸🇩', code: '+249' },
  { name: 'Suriname', flag: '🇸🇷', code: '+597' },
  { name: 'Sweden', flag: '🇸🇪', code: '+46' },
  { name: 'Switzerland', flag: '🇨🇭', code: '+41' },
  { name: 'Syria', flag: '🇸🇾', code: '+963' },
  { name: 'Taiwan', flag: '🇹🇼', code: '+886' },
  { name: 'Tajikistan', flag: '🇹🇯', code: '+992' },
  { name: 'Tanzania', flag: '🇹🇿', code: '+255' },
  { name: 'Thailand', flag: '🇹🇭', code: '+66' },
  { name: 'Timor-Leste', flag: '🇹🇱', code: '+670' },
  { name: 'Togo', flag: '🇹🇬', code: '+228' },
  { name: 'Tonga', flag: '🇹🇴', code: '+676' },
  { name: 'Trinidad and Tobago', flag: '🇹🇹', code: '+1-868' },
  { name: 'Tunisia', flag: '🇹🇳', code: '+216' },
  { name: 'Turkey', flag: '🇹🇷', code: '+90' },
  { name: 'Turkmenistan', flag: '🇹🇲', code: '+993' },
  { name: 'Turks and Caicos Islands', flag: '🇹🇨', code: '+1-649' },
  { name: 'Tuvalu', flag: '🇹🇻', code: '+688' },
  { name: 'Uganda', flag: '🇺🇬', code: '+256' },
  { name: 'Ukraine', flag: '🇺🇦', code: '+380' },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971' },
  { name: 'United Kingdom', flag: '🇬🇧', code: '+44' },
  { name: 'United States', flag: '🇺🇸', code: '+1' },
  { name: 'Uruguay', flag: '🇺🇾', code: '+598' },
  { name: 'Uzbekistan', flag: '🇺🇿', code: '+998' },
  { name: 'Vanuatu', flag: '🇻🇺', code: '+678' },
  { name: 'Vatican City', flag: '🇻🇦', code: '+379' },
  { name: 'Venezuela', flag: '🇻🇪', code: '+58' },
  { name: 'Vietnam', flag: '🇻🇳', code: '+84' },
  { name: 'Virgin Islands (British)', flag: '🇻🇬', code: '+1-284' },
  { name: 'Virgin Islands (U.S.)', flag: '🇻🇮', code: '+1-340' },
  { name: 'Yemen', flag: '🇾🇪', code: '+967' },
  { name: 'Zambia', flag: '🇿🇲', code: '+260' },
  { name: 'Zimbabwe', flag: '🇿🇼', code: '+263' },
]

// Armenia may appear twice in the raw table above only once (it's already
// deduped) — kept as a flat list; consumers match by `code + '|' + name`
// since several countries share a calling code (e.g. +1).
export default function CountryCodeSelect({ lang, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selected = useMemo(
    () => COUNTRY_CODES.find(c => `${c.code}|${c.name}` === value) || COUNTRY_CODES[0],
    [value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRY_CODES
    return COUNTRY_CODES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.replace('+', '').includes(q.replace('+', ''))
    )
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  const placeholder = lang === 'hy' ? 'Փնտրել երկիր կամ կոդ...' : 'Search country or code...'

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        type="button"
        className="auth-input"
        onClick={() => setOpen(o => !o)}
        style={{ width: 118, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span>{selected.flag}</span>
          <span style={{ fontSize: 14 }}>{selected.code}</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--taupe)' }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
            width: 300, maxWidth: '80vw',
            background: '#fff', border: '1px solid var(--sand)', borderRadius: 4,
            boxShadow: '0 8px 30px rgba(24,12,4,0.14)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="auth-input"
            style={{ margin: 8, width: 'auto' }}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto', borderTop: '1px solid var(--sand)' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 14, color: 'var(--taupe)' }}>
                {lang === 'hy' ? 'Ոչինչ չի գտնվել' : 'No matches'}
              </div>
            )}
            {filtered.map(c => (
              <button
                type="button"
                key={`${c.code}|${c.name}`}
                onClick={() => { onChange(`${c.code}|${c.name}`); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 14, textAlign: 'left', color: 'var(--deep)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cream)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: 'var(--taupe)' }}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
