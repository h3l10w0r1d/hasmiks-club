import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  PartyPopper, Flower2, AlertTriangle, UserPlus, MapPin, CalendarDays,
  Send, CheckCircle2, Circle, Lock, Image as ImageIcon, User, MessageCircle,
  Home, BookOpen, GalleryHorizontal, Users, CreditCard, Phone, ExternalLink,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto, getMemberDirectory, getGallery, getAlbum, addProfilePhoto, deleteProfilePhoto, getMemberProfile } from '../api/members'
import { getEvents, rsvp, cancelRsvp, joinWaitlist, leaveWaitlist, getWaitlistPosition } from '../api/events'
import { getLibrary } from '../api/content'
import { getPublicSettings, createCheckout } from '../api/payments'
import { refreshToken as apiRefresh } from '../api/auth'
import NotificationBell from '../components/NotificationBell'
import OnboardingModal from '../components/OnboardingModal'
import ForumTab from '../components/ForumTab'
import MemberProfileModal from '../components/MemberProfileModal'
import { getCheckinToken } from '../api/events'
import client from '../api/client'

const TABS = ['home', 'profile', 'events', 'library', 'gallery', 'community', 'forum']

function getCountdown(iso, lang) {
  const diff = new Date(iso) - new Date()
  if (diff < 0) return null
  const h = Math.floor(diff / 36e5)
  const d = Math.floor(diff / 864e5)
  if (h < 3) return lang === 'hy' ? 'Այսօր!' : 'Today!'
  if (d === 0) return lang === 'hy' ? 'Վաղը!' : 'Tomorrow!'
  if (d <= 7) return lang === 'hy' ? `${d} օրից` : `In ${d} days`
  return null
}

function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDateHeader(iso, lang) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (dayKey(iso) === dayKey(today)) return lang === 'hy' ? 'Այսօր' : 'Today'
  if (dayKey(iso) === dayKey(tomorrow)) return lang === 'hy' ? 'Վաղը' : 'Tomorrow'
  const opts = { weekday: 'long', month: 'long', day: 'numeric' }
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-US', opts)
}

// Groups a chronologically-sorted events array into { label, events }[] buckets by calendar day.
function groupEventsByDate(events, lang) {
  const groups = []
  for (const ev of events) {
    const key = dayKey(ev.event_date)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.events.push(ev)
    else groups.push({ key, label: formatDateHeader(ev.event_date, lang), events: [ev] })
  }
  return groups
}

export default function DashboardPage({ lang }) {
  const { user, setUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'home')

  // Keep the URL's ?tab= in sync so refreshing (or sharing/bookmarking the
  // link) lands back on the same tab instead of always resetting to Home.
  const changeTab = useCallback((next) => {
    setTab(next)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', next)
      return p
    }, { replace: true })
  }, [setSearchParams])
  const [events, setEvents] = useState([])
  const [library, setLibrary] = useState([])
  const [directory, setDirectory] = useState([])
  const [waitlistPositions, setWaitlistPositions] = useState({}) // eventId -> {on_waitlist, position}
  const [profileForm, setProfileForm] = useState({ full_name: '', photo_url: '', show_in_directory: true, bio: '', facebook_url: '', telegram_username: '', phone: '', whatsapp: '' })
  const [profilePhotos, setProfilePhotos] = useState([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const galleryInputRef = useRef(null)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved
  const lastSavedProfileRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [verifiedToast, setVerifiedToast] = useState(false)
  const [rsvpError, setRsvpError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [telegramUrl, setTelegramUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedContent, setSelectedContent] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [forumDeepLinkTopicId, setForumDeepLinkTopicId] = useState(null)
  const [albums, setAlbums] = useState([])
  const [openAlbum, setOpenAlbum] = useState(null)
  const [rsvpDone, setRsvpDone] = useState({})
  const [showOnboarding, setShowOnboarding] = useState(false)
  const fileInputRef = useRef(null)
  const homeLoaded = useRef(false)

  const closeContent = useCallback(() => setSelectedContent(null), [])
  useEffect(() => {
    if (!selectedContent) return
    const onKey = (e) => { if (e.key === 'Escape') closeContent() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedContent, closeContent])

  const t = {
    home:        lang === 'hy' ? 'Գլխ.' : 'Home',
    profile:     lang === 'hy' ? 'Պրոֆիլ' : 'Profile',
    events:      lang === 'hy' ? 'Հանդիպումներ' : 'Events',
    library:     lang === 'hy' ? 'Գրադարան' : 'Library',
    community:   lang === 'hy' ? 'Համայնք' : 'Community',
    signOut:     lang === 'hy' ? 'Ելք' : 'Sign Out',
    welcome:     lang === 'hy' ? 'Բարի գալուստ' : 'Welcome back',
    memberSince: lang === 'hy' ? 'Անդամ է' : 'Member since',
    status:      lang === 'hy' ? 'Կարգավիճակ' : 'Status',
    active:      lang === 'hy' ? 'Ակտիվ' : 'Active',
    inactive:    lang === 'hy' ? 'Ոչ ակտիվ' : 'Inactive',
    fullName:    lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    uploadPhoto: lang === 'hy' ? 'Վերբեռնել լուսանկար' : 'Upload Photo',
    save:        lang === 'hy' ? 'Պահպանել' : 'Save Changes',
    saved:       lang === 'hy' ? 'Պահպանված է' : 'Saved!',
    savingNow:   lang === 'hy' ? 'Պահպանվում է...' : 'Saving…',
    savedNow:    lang === 'hy' ? 'Պահպանված է ✓' : 'Saved ✓',
    showInDir:   lang === 'hy' ? 'Ցուցադրել համայնքի ցուցակում' : 'Show in community directory',
    seats:       lang === 'hy' ? 'տեղ մնացել' : 'seats left',
    rsvpBtn:     lang === 'hy' ? 'Գրանցվել' : 'RSVP',
    cancelRsvp:  lang === 'hy' ? 'Չեղարկել' : 'Cancel RSVP',
    booked:      lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    waitlist:    lang === 'hy' ? 'Ցուցակ' : 'Join Waitlist',
    leaveWait:   lang === 'hy' ? 'Ցուցակից հեռացնել' : 'Leave Waitlist',
    waitPos:     lang === 'hy' ? 'Հերթ' : 'Waitlist position',
    noEvents:    lang === 'hy' ? 'Առայժմ հանդիպումներ չկան' : 'No upcoming events yet',
    noLibrary:   lang === 'hy' ? 'Ձեր գրադարանը դատարկ է' : 'Your library is empty',
    lockedLib:   lang === 'hy' ? 'Կողպված' : 'Locked',
    recipe:      lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
    ebook:       lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
    download:    lang === 'hy' ? 'Բեռնել' : 'Download',
    joinTelegram:lang === 'hy' ? 'Միանալ Telegram խմբին' : 'Join our Telegram group',
    gallery:     lang === 'hy' ? 'Ֆոտոսրահ' : 'Gallery',
    noGallery:   lang === 'hy' ? 'Ֆոտոլբոմներ դեռ չկան' : 'No photo albums yet',
    photos:      lang === 'hy' ? 'լուսանկար' : 'photos',
    viewAlbum:   lang === 'hy' ? 'Տեսնել' : 'View',
    closeAlbum:  lang === 'hy' ? 'Փակել' : 'Close',
    noMembers:   lang === 'hy' ? 'Անդամներ չկան ցուցակում' : 'No members in the directory yet',
    memberSince2: lang === 'hy' ? 'Անդամ' : 'Member since',
    viewProfile: lang === 'hy' ? 'Պրոֆիլ' : 'View profile',
    bio:         lang === 'hy' ? 'Իմ մասին' : 'About me',
    bioPh:       lang === 'hy' ? 'Պատմեք մի փոքր ձեր մասին...' : 'Tell others a little about yourself…',
    contactInfo: lang === 'hy' ? 'Կապի տվյալներ' : 'Contact info',
    facebook:    'Facebook',
    telegram:    'Telegram',
    phone:       lang === 'hy' ? 'Հեռախոս' : 'Phone',
    whatsapp:    'WhatsApp',
    myPhotos:    lang === 'hy' ? 'Իմ լուսանկարները' : 'My photos',
    addPhoto:    lang === 'hy' ? 'Ավելացնել լուսանկար' : 'Add photo',
    photoLimit:  lang === 'hy' ? 'Առավելագույնը 6 լուսանկար' : 'Up to 6 photos',
    verifyBanner:lang === 'hy' ? 'Խնդրում ենք հաստատել Ձեր էլ. հասցեն' : 'Please verify your email address',
    resendVerify:lang === 'hy' ? 'Կրկին ուղարկել' : 'Resend verification email',
    verifyOk:    lang === 'hy' ? 'Էլ. հասցեն հաստատված է ✓' : 'Email verified ✓',
    forum:        lang === 'hy' ? 'Ֆորում' : 'Forum',
    newTopic:     lang === 'hy' ? 'Նոր թեմա' : 'New Topic',
    reply:        lang === 'hy' ? 'Պատասխանել' : 'Reply',
    post:         lang === 'hy' ? 'Հրապարակել' : 'Post',
    cancel:       lang === 'hy' ? 'Չեղարկել' : 'Cancel',
    topicTitle:   lang === 'hy' ? 'Վերնագիր' : 'Title',
    topicBody:    lang === 'hy' ? 'Բովանդակություն' : 'Content',
    noTopics:     lang === 'hy' ? 'Թեմաներ դեռ չկան' : 'No topics yet — start a conversation!',
  }

  useEffect(() => {
    let alive = true
    getMe().then(fresh => {
      if (!alive) return
      setUser(fresh)
      const initialForm = {
        full_name: fresh.full_name, photo_url: fresh.photo_url || '', show_in_directory: fresh.show_in_directory ?? true,
        bio: fresh.bio || '', facebook_url: fresh.facebook_url || '', telegram_username: fresh.telegram_username || '',
        phone: fresh.phone || '', whatsapp: fresh.whatsapp || '',
      }
      setProfileForm(initialForm)
      lastSavedProfileRef.current = JSON.stringify(initialForm)
      setProfilePhotos(fresh.profile_photos || [])
      if (!fresh.onboarding_completed) setShowOnboarding(true)
    }).catch(() => {})
    getPublicSettings().then(s => { if (alive) setTelegramUrl(s.telegram_invite_url || '') }).catch(() => {})
    return () => { alive = false }
  }, [])

  // handle ?verified=ok in URL
  useEffect(() => {
    const v = searchParams.get('verified')
    if (v === 'ok') {
      setVerifiedToast(true)
      getMe().then(fresh => { setUser(fresh) }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!verifiedToast) return
    const timer = setTimeout(() => setVerifiedToast(false), 5000)
    return () => clearTimeout(timer)
  }, [verifiedToast])

  useEffect(() => {
    if (tab === 'home' && !homeLoaded.current) {
      homeLoaded.current = true
      getEvents().then(evs => {
        setEvents(evs)
        evs.filter(e => e.seats_available === 0 && !e.user_has_rsvp).forEach(e => {
          getWaitlistPosition(e.id).then(pos => setWaitlistPositions(p => ({ ...p, [e.id]: pos }))).catch(() => {})
        })
      }).catch(() => {})
      getLibrary().then(setLibrary).catch(() => {})
      getGallery().then(setAlbums).catch(() => {})
      getMemberDirectory().then(setDirectory).catch(() => {})
    }
    if (tab === 'events') {
      getEvents().then(evs => {
        setEvents(evs)
        evs.filter(e => e.seats_available === 0 && !e.user_has_rsvp).forEach(e => {
          getWaitlistPosition(e.id).then(pos => setWaitlistPositions(p => ({ ...p, [e.id]: pos }))).catch(() => {})
        })
      }).catch(() => {})
    }
    if (tab === 'library') getLibrary().then(setLibrary).catch(() => {})
    if (tab === 'gallery') getGallery().then(setAlbums).catch(() => {})
    if (tab === 'community') getMemberDirectory().then(setDirectory).catch(() => {})
    // forum data is loaded inside the ForumTab component
  }, [tab])

  // Auto-save the profile form: debounce edits, skip the initial fetch-populated value.
  useEffect(() => {
    const current = JSON.stringify(profileForm)
    if (lastSavedProfileRef.current === null || current === lastSavedProfileRef.current) return
    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        const updated = await updateMe(profileForm)
        setUser(updated)
        lastSavedProfileRef.current = current
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [profileForm])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const updated = await uploadPhoto(file)
      setUser(updated)
      setProfileForm(f => ({ ...f, photo_url: updated.photo_url || '' }))
      setMsg(lang === 'hy' ? 'Լուսանկարը պահպանված է' : 'Photo updated!')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      const detail = err.response?.data?.detail
      setMsg(detail || (lang === 'hy' ? 'Վերբեռնումը ձախողվեց' : 'Upload failed'))
    }
    finally { setPhotoUploading(false) }
  }

  const handleGalleryAdd = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setGalleryUploading(true)
    try {
      const updated = await addProfilePhoto(file)
      setProfilePhotos(updated)
    } catch (err) {
      const detail = err.response?.data?.detail
      setMsg(detail || (lang === 'hy' ? 'Վերբեռնումը ձախողվեց' : 'Upload failed'))
    } finally { setGalleryUploading(false) }
  }

  const handleGalleryDelete = async (photoId) => {
    try { setProfilePhotos(await deleteProfilePhoto(photoId)) } catch { /* ignore */ }
  }

  const handleRsvp = async (event) => {
    setRsvpError('')
    try {
      if (event.user_has_rsvp) {
        await cancelRsvp(event.id)
      } else {
        await rsvp(event.id)
        setRsvpDone(s => ({ ...s, [event.id]: true }))
        setTimeout(() => setRsvpDone(s => { const n = { ...s }; delete n[event.id]; return n }), 2500)
      }
      const updated = await getEvents()
      setEvents(updated)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setRsvpError(detail || (lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong'))
    }
  }

  const handleWaitlist = async (event) => {
    setRsvpError('')
    const pos = waitlistPositions[event.id]
    try {
      if (pos?.on_waitlist) {
        await leaveWaitlist(event.id)
        setWaitlistPositions(p => ({ ...p, [event.id]: { on_waitlist: false } }))
      } else {
        const result = await joinWaitlist(event.id)
        setWaitlistPositions(p => ({ ...p, [event.id]: { on_waitlist: true, position: result.position } }))
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      setRsvpError(detail || (lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong'))
    }
  }

  const handleResendVerify = async () => {
    try {
      await client.post('/auth/resend-verification')
      setMsg(lang === 'hy' ? 'Հաստատման նամակն ուղարկվել է' : 'Verification email sent!')
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg(lang === 'hy' ? 'Սխալ' : 'Error sending email') }
  }

  const handleSignOut = () => { signOut(); navigate('/') }

  const handleSubscribe = async () => {
    setCheckoutLoading(true)
    try {
      const { url } = await createCheckout()
      window.location.href = url
    } catch {
      setMsg(lang === 'hy' ? 'Չհաջողվեց սկսել վճարումը: Փորձե՛ք կրկին:' : 'Could not start checkout. Please try again.')
      setCheckoutLoading(false)
    }
  }

  if (!user) return null

  // Pending application screen
  if (user.application_status === 'pending') {
    const hour = new Date().getHours()
    const greeting = hour < 12
      ? (lang === 'hy' ? 'Բարի առավոտ' : 'Good morning')
      : hour < 18
        ? (lang === 'hy' ? 'Բարի կեսօր' : 'Good afternoon')
        : (lang === 'hy' ? 'Բարի երեկո' : 'Good evening')
    return (
      <div style={{ minHeight: '100vh', background: '#fff8f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'inherit' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <Flower2 size={44} strokeWidth={1.5} color="var(--rose)" style={{ marginBottom: 24 }} />
          <h1 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 34, fontWeight: 700, color: '#2c1a1a', margin: '0 0 16px', lineHeight: 1.2 }}>
            {greeting}, {user.full_name.split(' ')[0]}!
          </h1>
          <h2 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 24, fontWeight: 600, color: '#c0394b', margin: '0 0 20px' }}>
            {lang === 'hy' ? 'Ձեր հայտը ուսումնասիրվում է' : 'Your application is under review'}
          </h2>
          <p style={{ fontSize: 15, color: '#2c1a1a', lineHeight: 1.75, marginBottom: 12 }}>
            {lang === 'hy'
              ? 'Շնորհակալ ենք Hasmik\'s Club-ին միանալու ցանկության համար: Մենք ուշադիր ծանոթանում ենք Ձեր հայտին և կապ կհաստատենք Ձեզ հետ շուտով:'
              : "Thank you for applying to Hasmik's Club. We're carefully reviewing your application and will be in touch with you very soon."}
          </p>
          <p style={{ fontSize: 14, color: '#9b6e6e', lineHeight: 1.7, marginBottom: 36 }}>
            {lang === 'hy'
              ? 'Այս գործընթացը սովորաբար տևում է 2–3 աշխատանքային օր: Ստուգե՛ք Ձեր էլ. փոստի մուտքի արկղը:'
              : 'This process typically takes 2–3 business days. Keep an eye on your inbox for a personal note from us.'}
          </p>
          <button
            onClick={handleSignOut}
            style={{ background: '#c0394b', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', cursor: 'pointer', fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}
          >
            {t.signOut}
          </button>
        </div>
      </div>
    )
  }

  const isActive = user.membership_status === 'active'
  const paymentFailed = searchParams.get('payment') === 'failed'

  // Ghost view: approved accounts that skipped or haven't completed payment can
  // still browse the dashboard, but aren't visible in the directory, can't post
  // in the forum, and can't RSVP to events (all enforced server-side too) until
  // they subscribe. This banner is their one persistent, always-visible path
  // back to checkout — shown on every tab, not a full-page block.
  const membershipBanner = !isActive && (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      background: paymentFailed ? '#fdecea' : '#fff8f5',
      border: `1px solid ${paymentFailed ? '#f3c6c0' : '#f5ddd0'}`,
      borderRadius: 14, padding: '16px 20px', marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CreditCard size={22} strokeWidth={1.5} color={paymentFailed ? '#c0392b' : 'var(--rose)'} style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: paymentFailed ? '#c0392b' : '#2c1a1a', margin: 0 }}>
            {paymentFailed
              ? (lang === 'hy' ? 'Վերջին վճարման փորձը չհաջողվեց' : 'Your last payment attempt failed')
              : (lang === 'hy' ? 'Դուք դիտում եք որպես հյուր' : "You're browsing as a guest")}
          </p>
          <p style={{ fontSize: 12.5, color: '#8a746a', margin: '2px 0 0' }}>
            {paymentFailed
              ? (lang === 'hy' ? 'Կրկին փորձեք, կամ կապվեք մեզ հետ, եթե խնդիրը կրկնվում է:' : 'Try again, or contact us if this keeps happening.')
              : (lang === 'hy'
                  ? 'Բաժանորդագրվեք՝ ֆորումում գրելու, հանդիպումներին գրանցվելու և համայնքին տեսանելի լինելու համար:'
                  : 'Subscribe to post in the forum, RSVP to gatherings, and be visible to the community.')}
          </p>
          {msg && <p style={{ fontSize: 12.5, color: '#c0392b', margin: '4px 0 0' }}>{msg}</p>}
        </div>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={checkoutLoading}
        style={{ background: '#c0394b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: checkoutLoading ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', opacity: checkoutLoading ? 0.7 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {checkoutLoading
          ? (lang === 'hy' ? 'Բեռնվում է…' : 'Loading…')
          : paymentFailed
            ? (lang === 'hy' ? 'Կրկին փորձել' : 'Try Again')
            : (lang === 'hy' ? 'Բաժանորդագրվել' : 'Subscribe Now')}
      </button>
    </div>
  )

  // Home tab helpers
  const now = new Date()
  const nextEvent = events.find(ev => new Date(ev.event_date) > now)
  const unlockedLibrary = library.filter(item => item.is_unlocked)
  const hour = new Date().getHours()
  const greeting = hour < 12
    ? (lang === 'hy' ? 'Բարի առավոտ' : 'Good morning')
    : hour < 18
      ? (lang === 'hy' ? 'Բարի կեսօր' : 'Good afternoon')
      : (lang === 'hy' ? 'Բարի երեկո' : 'Good evening')

  return (
    <div className="dash-page">
      <nav className="dash-nav">
        <div className="dash-nav-brand">Hasmik's <span>Club</span></div>
        <div className="dash-nav-right">
          <NotificationBell />
          <span className="dash-user-name">{user.full_name}</span>
          {user.is_admin && (
            <Link to="/admin" className="dash-signout" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Admin</Link>
          )}
          <button className="dash-signout" onClick={handleSignOut}>{t.signOut}</button>
        </div>
      </nav>

      {/* Email verification banner */}
      {!user.is_verified && (
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#795548', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} /> {t.verifyBanner}</span>
          <button onClick={handleResendVerify} style={{ background: 'none', border: '1px solid #795548', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#795548' }}>
            {t.resendVerify}
          </button>
        </div>
      )}

      <div className="dash-body">
        <aside className="dash-sidebar">
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{lang === 'hy' ? 'Գլխ.' : 'Overview'}</span>
            {['home'].map(k => (
              <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>{t[k]}</button>
            ))}
          </div>
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{lang === 'hy' ? 'Անձ.' : 'Personal'}</span>
            {['profile', 'events', 'library'].map(k => (
              <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>{t[k]}</button>
            ))}
          </div>
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{lang === 'hy' ? 'Համ.' : 'Community'}</span>
            {['gallery', 'community', 'forum'].map(k => (
              <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>{t[k]}</button>
            ))}
          </div>
          <div className="dash-membership-badge">
            <span className={`dash-status ${user.membership_status}`}>{isActive ? t.active : t.inactive}</span>
          </div>
        </aside>

        <main className="dash-main">
          <div key={tab} className="dash-tab-content">
          {membershipBanner}

          {/* ── HOME ── */}
          {tab === 'home' && (
            <div className="dash-section">
              <h2 className="dash-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {greeting}, {user.full_name.split(' ')[0]}! <Flower2 size={20} strokeWidth={1.5} color="var(--rose)" />
              </h2>

              {/* Referral link — prominent, first card */}
              {user.referral_code && (
                <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--deep)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={16} /> {lang === 'hy' ? 'Հրավիրե՛ք ընկերուհի' : 'Invite a friend'}
                  </p>
                  <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
                    {lang === 'hy' ? 'Կիսե՛ք հղումը՝ ընկերուհուն հրավիրելու համար:' : "Share your link and your friend's application will be linked to you."}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ background: '#f5ece8', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--deep)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {window.location.origin}/register?ref={user.referral_code}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referral_code}`); setMsg(lang === 'hy' ? 'Պատճենված է!' : 'Copied!'); setTimeout(() => setMsg(''), 2000) }}
                      style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                    >
                      {lang === 'hy' ? 'Պատճենել' : 'Copy'}
                    </button>
                  </div>
                  {msg && <p className="auth-success" style={{ marginTop: 10, marginBottom: 0 }}>{msg}</p>}
                </div>
              )}

              {/* Next event card */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#2c1a1a', marginBottom: 14 }}>
                  {lang === 'hy' ? 'Հաջորդ հանդիպումը' : 'Next Event'}
                </h3>
                {nextEvent ? (
                  <div className={`event-card${nextEvent.user_has_rsvp ? ' rsvpd' : ''}`}>
                    <div className="event-card-top">
                      <div>
                        <div className="event-title">{lang === 'hy' && nextEvent.title_hy ? nextEvent.title_hy : nextEvent.title}</div>
                        <div className="event-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {nextEvent.location}</span> ·
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={13} /> {new Date(nextEvent.event_date).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {getCountdown(nextEvent.event_date, lang) && (
                            <span style={{ background: '#fff0f2', color: '#c0394b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                              {getCountdown(nextEvent.event_date, lang)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="event-seats">
                        {nextEvent.seats_available > 0
                          ? <><strong>{nextEvent.seats_available}</strong> {t.seats}</>
                          : <span className="fully-booked">{t.booked}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {rsvpDone[nextEvent.id] ? (
                        <span style={{ color: '#c0394b', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>You're going! <PartyPopper size={15} /></span>
                      ) : nextEvent.user_has_rsvp ? (
                        <button className="plan-btn plan-btn-outline" onClick={() => handleRsvp(nextEvent)}>{t.cancelRsvp}</button>
                      ) : nextEvent.seats_available > 0 ? (
                        isActive
                          ? <button className="plan-btn plan-btn-fill" onClick={() => handleRsvp(nextEvent)}>{t.rsvpBtn}</button>
                          : <button className="plan-btn plan-btn-fill" onClick={handleSubscribe}>{lang === 'hy' ? 'Բաժանորդագրվեք՝ գրանցվելու համար' : 'Subscribe to RSVP'}</button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#9b6e6e', fontSize: 14, fontStyle: 'italic' }}>
                    {lang === 'hy' ? 'Առայժմ հանդիպումներ չկան — շուտով կլինեն' : 'No upcoming events — check back soon'}
                  </p>
                )}
              </div>

              {/* Library preview */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#2c1a1a', marginBottom: 14 }}>
                  {lang === 'hy' ? 'Գրադարանից' : 'From the Library'}
                </h3>
                {unlockedLibrary.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '20px 24px' }}>
                    <p style={{ fontSize: 14, color: '#9b6e6e', fontStyle: 'italic', margin: 0 }}>
                      {lang === 'hy' ? 'Ձեր գրադարանը կհայտնվի, երբ անդամությունը ակտիվ լինի' : 'Your library will appear here once your membership is activated'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {unlockedLibrary.slice(0, 2).map(item => (
                      <div key={item.id}
                        style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                        onClick={() => setSelectedContent(item)}>
                        {item.cover_url && (
                          <img src={item.cover_url} alt={item.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>
                            {item.type === 'recipe' ? t.recipe : t.ebook}
                          </div>
                          <div style={{ fontWeight: 600, color: '#2c1a1a', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lang === 'hy' && item.title_hy ? item.title_hy : item.title}
                          </div>
                        </div>
                        {item.file_url && (
                          <a href={item.file_url} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                            {t.download}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gallery preview */}
              {albums.length > 0 && albums[0].cover_url && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#2c1a1a', marginBottom: 14 }}>
                    {lang === 'hy' ? 'Ֆոտոսրահ' : 'Gallery'}
                  </h3>
                  <div
                    style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => changeTab('gallery')}
                  >
                    <img src={albums[0].cover_url} alt={albums[0].title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(44,26,26,.6) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: '16px 20px' }}>
                      <span style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#fff' }}>{albums[0].title}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Community count */}
              {directory.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 22, fontWeight: 700, color: '#2c1a1a' }}>
                      {directory.length} {lang === 'hy' ? 'անդամ համայնքում' : 'members in the community'}
                    </div>
                    <div style={{ fontSize: 13, color: '#9b6e6e', marginTop: 4 }}>
                      {lang === 'hy' ? 'Ծանոթացե՛ք Hasmik\'s Club-ի անդամների հետ' : "Connect with fellow Hasmik's Club members"}
                    </div>
                  </div>
                  <button
                    onClick={() => changeTab('community')}
                    style={{ background: 'none', border: '1px solid #c0394b', color: '#c0394b', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {lang === 'hy' ? 'Ծանոթանալ →' : 'Meet them →'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.welcome}, {user.full_name.split(' ')[0]}.</h2>
              <p className="dash-meta">
                {t.memberSince}: {new Date(user.joined_at).toLocaleDateString()}
                &nbsp;·&nbsp;
                {t.status}: <strong>{isActive ? t.active : t.inactive}</strong>
              </p>

              {!user.onboarding_completed && (
                <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
                  <p style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian",serif', fontSize: 18, fontWeight: 700, color: 'var(--deep)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lang === 'hy' ? 'Ողջույն Hasmik\'s Club-ում' : 'Getting started'} <Flower2 size={17} strokeWidth={1.5} color="var(--rose)" />
                  </p>
                  {[
                    { done: !!profileForm.photo_url, label: lang === 'hy' ? 'Ավելացրե՛ք ձեր լուսանկարը' : 'Add a profile photo', action: null },
                    { done: isActive && !!telegramUrl, label: lang === 'hy' ? 'Միացե՛ք Telegram խմբին' : 'Join our Telegram group', action: isActive && telegramUrl ? () => window.open(telegramUrl, '_blank') : null },
                    { done: user.is_verified, label: lang === 'hy' ? 'Հաստատե՛ք ձեր էլ. հասցեն' : 'Verify your email', action: null },
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{ display: 'flex', color: step.done ? '#2e7d32' : '#ccc' }}>{step.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
                      <span style={{ fontSize: 14, color: step.done ? '#aaa' : 'var(--deep)', textDecoration: step.done ? 'line-through' : 'none' }}>
                        {step.label}
                      </span>
                      {step.action && !step.done && (
                        <button onClick={step.action} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--rose)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--rose)' }}>
                          {lang === 'hy' ? 'Անել' : 'Do it'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isActive && telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noreferrer" className="btn-rose auth-submit"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', marginBottom: '24px', maxWidth: '280px' }}>
                  <Send size={15} /> {t.joinTelegram}
                </a>
              )}

              {user.referral_code && (
                <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={15} /> {lang === 'hy' ? 'Հրավիրե՛ք ընկերուհի' : 'Invite a friend'}
                  </p>
                  <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                    {lang === 'hy' ? 'Կիսե՛ք հղումը՝ ընկերուհուն հրավիրելու համար:' : 'Share your link and your friend\'s application will be linked to you.'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ background: '#f5ece8', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--deep)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {window.location.origin}/register?ref={user.referral_code}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referral_code}`); setMsg(lang === 'hy' ? 'Պատճենված է!' : 'Copied!'); setTimeout(() => setMsg(''), 2000) }}
                      style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                    >
                      {lang === 'hy' ? 'Պատճենել' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {msg && <p className="auth-success" style={{ marginBottom: 16 }}>{msg}</p>}

              <div className="profile-form">
                <div className="profile-card">
                  <div className="profile-avatar-row">
                    {profileForm.photo_url
                      ? <img src={profileForm.photo_url} alt="avatar" className="profile-avatar" />
                      : <div className="profile-avatar-placeholder">{profileForm.full_name.charAt(0) || '?'}</div>
                    }
                    <button type="button" className="plan-btn plan-btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}
                      onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
                      {photoUploading ? '...' : t.uploadPhoto}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                  </div>

                  <div className="profile-field">
                    <label>{t.fullName}</label>
                    <input value={profileForm.full_name}
                      onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', cursor: 'pointer', fontSize: 14, color: '#555' }}>
                    <input type="checkbox" checked={profileForm.show_in_directory}
                      onChange={e => setProfileForm(f => ({ ...f, show_in_directory: e.target.checked }))} />
                    {t.showInDir}
                  </label>

                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: saveStatus === 'saved' ? '#2e7d32' : '#aaa', minHeight: 16, margin: 0 }}>
                    {saveStatus === 'saving' && t.savingNow}
                    {saveStatus === 'saved' && <><CheckCircle2 size={14} /> {t.savedNow}</>}
                  </p>
                </div>

                <div>
                  <div className="profile-card">
                    <p className="profile-card-title">{t.bio}</p>
                    <div className="profile-field">
                      <textarea value={profileForm.bio} placeholder={t.bioPh} rows={4}
                        style={{ resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }}
                        onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                    </div>
                  </div>

                  <div className="profile-card">
                    <p className="profile-card-title">{t.contactInfo}</p>
                    <div className="profile-contact-grid">
                      <div className="profile-field">
                        <label><ExternalLink size={12} /> {t.facebook}</label>
                        <input placeholder="https://facebook.com/…" value={profileForm.facebook_url}
                          onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))} />
                      </div>
                      <div className="profile-field">
                        <label><Send size={12} /> {t.telegram}</label>
                        <input placeholder="@username" value={profileForm.telegram_username}
                          onChange={e => setProfileForm(f => ({ ...f, telegram_username: e.target.value }))} />
                      </div>
                      <div className="profile-field">
                        <label><Phone size={12} /> {t.phone}</label>
                        <input placeholder="+374 …" value={profileForm.phone}
                          onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="profile-field">
                        <label><MessageCircle size={12} /> {t.whatsapp}</label>
                        <input placeholder="+374 …" value={profileForm.whatsapp}
                          onChange={e => setProfileForm(f => ({ ...f, whatsapp: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="profile-card">
                    <p className="profile-card-title">{t.myPhotos}</p>
                    <p style={{ fontSize: 12, color: '#aaa', marginTop: -10, marginBottom: 14 }}>{t.photoLimit}</p>
                    <div className="profile-photo-grid">
                      {profilePhotos.map(p => (
                        <div key={p.id} className="profile-photo-tile">
                          <img src={p.url} alt="" />
                          <button type="button" className="profile-photo-remove" onClick={() => handleGalleryDelete(p.id)}>×</button>
                        </div>
                      ))}
                      {profilePhotos.length < 6 && (
                        <button type="button" className="profile-photo-add"
                          onClick={() => galleryInputRef.current?.click()} disabled={galleryUploading}>
                          {galleryUploading ? '…' : '+'}
                        </button>
                      )}
                    </div>
                    <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGalleryAdd} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EVENTS ── */}
          {tab === 'events' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.events}</h2>
              {rsvpError && <p className="auth-error" style={{ marginBottom: '12px' }}>{rsvpError}</p>}
              {events.length === 0
                ? <p className="dash-empty">{t.noEvents}</p>
                : groupEventsByDate(events, lang).map(group => (
                  <div key={group.key} style={{ marginBottom: 28 }}>
                    <h3 style={{
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--rose)', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--sand)',
                    }}>
                      {group.label}
                    </h3>
                    {group.events.map(ev => {
                      const wl = waitlistPositions[ev.id]
                      const countdown = getCountdown(ev.event_date, lang)
                      return (
                        <div key={ev.id} className={`event-card${ev.user_has_rsvp ? ' rsvpd' : ''}`}>
                          <div className="event-card-top">
                            <div>
                              <div className="event-title">{lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title}</div>
                              <div className="event-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {ev.location}</span> ·
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={13} /> {new Date(ev.event_date).toLocaleTimeString(lang === 'hy' ? 'hy-AM' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                {countdown && (
                                  <span style={{ background: '#fff0f2', color: '#c0394b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                                    {countdown}
                                  </span>
                                )}
                              </div>
                              {lang === 'hy' && ev.description_hy
                                ? <p className="event-desc">{ev.description_hy}</p>
                                : ev.description && <p className="event-desc">{ev.description}</p>}
                            </div>
                            <div className="event-seats">
                              {ev.seats_available > 0
                                ? <><strong>{ev.seats_available}</strong> {t.seats}</>
                                : <span className="fully-booked">{t.booked}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {rsvpDone[ev.id] ? (
                              <span style={{ color: '#c0394b', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>You're going! <PartyPopper size={15} /></span>
                            ) : !isActive ? (
                              <button className="plan-btn plan-btn-fill" onClick={handleSubscribe}>{lang === 'hy' ? 'Բաժանորդագրվեք՝ գրանցվելու համար' : 'Subscribe to RSVP'}</button>
                            ) : ev.user_has_rsvp ? (
                              <button className="plan-btn plan-btn-outline" onClick={() => handleRsvp(ev)}>{t.cancelRsvp}</button>
                            ) : ev.seats_available > 0 ? (
                              <button className="plan-btn plan-btn-fill" onClick={() => handleRsvp(ev)}>{t.rsvpBtn}</button>
                            ) : (
                              <button
                                className={`plan-btn ${wl?.on_waitlist ? 'plan-btn-outline' : 'plan-btn-fill'}`}
                                style={{ background: wl?.on_waitlist ? undefined : '#f39c12', borderColor: '#f39c12', color: wl?.on_waitlist ? '#f39c12' : '#fff' }}
                                onClick={() => handleWaitlist(ev)}
                              >
                                {wl?.on_waitlist ? t.leaveWait : t.waitlist}
                              </button>
                            )}
                            {wl?.on_waitlist && (
                              <span style={{ fontSize: 13, color: '#f39c12', fontWeight: 600 }}>
                                #{wl.position} {t.waitPos}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              }
            </div>
          )}

          {/* ── LIBRARY ── */}
          {tab === 'library' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.library}</h2>
              {library.length === 0
                ? <p className="dash-empty">{t.noLibrary}</p>
                : (
                  <div className="library-grid">
                    {library.map(item => (
                      <div key={item.id} className="library-card" style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedContent(item)}>
                        {item.is_unlocked ? (
                          <>
                            {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" />}
                            <div className="library-type">{item.type === 'recipe' ? t.recipe : t.ebook}</div>
                            <div className="library-title">{lang === 'hy' && item.title_hy ? item.title_hy : item.title}</div>
                            {(lang === 'hy' && item.description_hy ? item.description_hy : item.description) && (
                              <p className="library-desc">{lang === 'hy' && item.description_hy ? item.description_hy : item.description}</p>
                            )}
                            {item.file_url
                              ? <span className="plan-btn plan-btn-fill library-dl">{t.download}</span>
                              : null
                            }
                          </>
                        ) : (
                          <>
                            <div style={{ position: 'relative', minHeight: 150 }}>
                              {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" style={{ filter: 'blur(2px)', opacity: 0.5 }} />}
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,248,245,.8)' }}>
                                <Lock size={26} strokeWidth={1.5} color="#c0394b" />
                                <p style={{ fontSize: 12, color: '#c0394b', fontWeight: 600, marginTop: 6, textAlign: 'center', padding: '0 8px' }}>
                                  {lang === 'hy' ? 'Ակտիվ անդամության համար' : 'Available with active membership'}
                                </p>
                              </div>
                            </div>
                            <div className="library-type">{item.type === 'recipe' ? t.recipe : t.ebook}</div>
                            <div className="library-title">{lang === 'hy' && item.title_hy ? item.title_hy : item.title}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── GALLERY ── */}
          {tab === 'gallery' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.gallery}</h2>
              {albums.length === 0
                ? <p className="dash-empty">{t.noGallery}</p>
                : (
                  <div className="library-grid">
                    {albums.map(album => (
                      <div key={album.id} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(192,57,75,.07)', cursor: 'pointer' }}
                        onClick={async () => {
                          if (openAlbum?.id === album.id) { setOpenAlbum(null); return }
                          const detail = await getAlbum(album.id)
                          setOpenAlbum(detail)
                        }}>
                        {album.cover_url
                          ? <img src={album.cover_url} alt={album.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', height: 140, background: '#f5ece8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={28} strokeWidth={1.5} color="#c9a8a8" /></div>
                        }
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian",serif', fontSize: 17, fontWeight: 700, color: 'var(--deep)' }}>{album.title}</div>
                          {album.description && <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.5, marginTop: 4 }}>{album.description}</p>}
                          <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{album.photo_count} {t.photos}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── COMMUNITY ── */}
          {tab === 'community' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{lang === 'hy' ? 'Մեր Անդամները' : 'Our Members'}</h2>
              <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>
                {lang === 'hy' ? 'Ծանոթացեք Hasmik\'s Club-ի ակտիվ անդամների հետ' : "Meet the active members of Hasmik's Club"}
              </p>
              {directory.length === 0
                ? <p className="dash-empty">{t.noMembers}</p>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
                    {directory.map(m => (
                      <div key={m.id}
                        onClick={() => setSelectedMember(m)}
                        style={{ textAlign: 'center', background: '#fff', borderRadius: 14, padding: '24px 16px', boxShadow: '0 2px 10px rgba(192,57,75,.07)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(192,57,75,.13)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 10px rgba(192,57,75,.07)' }}
                      >
                        {m.photo_url
                          ? <img src={m.photo_url} alt={m.full_name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, border: '3px solid #f5c0c0' }} />
                          : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f5c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px', color: '#c0394b', fontWeight: 700 }}>
                              {m.full_name.charAt(0)}
                            </div>
                        }
                        <div style={{ fontWeight: 600, color: '#2c1a1a', fontSize: 14 }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                          {lang === 'hy' ? 'Անդամ' : 'Member'} {new Date(m.joined_at).getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── FORUM ── */}
          {tab === 'forum' && (
            <ForumTab
              lang={lang}
              isActive={isActive}
              onSubscribe={handleSubscribe}
              checkoutLoading={checkoutLoading}
              initialTopicId={forumDeepLinkTopicId}
              onConsumedInitialTopic={() => setForumDeepLinkTopicId(null)}
            />
          )}

          </div>
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="dash-bottom-nav">
        {TABS.map(k => {
          const icons = { home: Home, profile: User, events: CalendarDays, library: BookOpen, gallery: GalleryHorizontal, community: Users, forum: MessageCircle }
          const Icon = icons[k]
          return (
            <button key={k} className={`dash-bottom-nav-item${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>
              <span className="nav-icon"><Icon size={20} strokeWidth={1.75} /></span>
              {t[k]}
            </button>
          )
        })}
      </nav>

      {/* ── Member profile modal ── */}
      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          lang={lang}
          onClose={() => setSelectedMember(null)}
          onOpenForumTopic={(topicId) => {
            setSelectedMember(null)
            setForumDeepLinkTopicId(topicId)
            changeTab('forum')
          }}
        />
      )}

      {/* ── Album lightbox ── */}
      {openAlbum && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px' }}
          onClick={() => setOpenAlbum(null)}>
          <div style={{ width: '100%', maxWidth: 860, background: '#fff', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f0e0e5' }}>
              <h2 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian",serif', fontSize: 22, fontWeight: 700, color: '#2c1a1a', margin: 0 }}>{openAlbum.title}</h2>
              <button onClick={() => setOpenAlbum(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#bbb', lineHeight: 1, padding: 4 }}>×</button>
            </div>
            {openAlbum.description && <p style={{ padding: '12px 24px 0', color: '#888', fontSize: 14 }}>{openAlbum.description}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, padding: 16 }}>
              {(openAlbum.photos || []).map(photo => (
                <div key={photo.id}>
                  <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                  {photo.caption && <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 }}>{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Onboarding modal ── */}
      {showOnboarding && (
        <OnboardingModal
          lang={lang}
          telegramUrl={telegramUrl}
          onDone={() => setShowOnboarding(false)}
        />
      )}

      {/* ── Content viewer modal ── */}
      {selectedContent && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(44,26,26,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={closeContent}
        >
          <div
            style={{ background: 'var(--linen)', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={closeContent}
              style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#999', lineHeight: 1, zIndex: 1 }}
              aria-label="Close"
            >×</button>

            {selectedContent.cover_url && (
              <img src={selectedContent.cover_url} alt={selectedContent.title}
                style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: '16px 16px 0 0', display: 'block' }} />
            )}

            <div style={{ padding: '28px 32px 32px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                {selectedContent.type === 'recipe' ? t.recipe : t.ebook}
              </div>
              <h2 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 26, fontWeight: 700, color: 'var(--deep)', margin: '0 0 14px', lineHeight: 1.25 }}>
                {lang === 'hy' && selectedContent.title_hy ? selectedContent.title_hy : selectedContent.title}
              </h2>
              {(lang === 'hy' && selectedContent.description_hy ? selectedContent.description_hy : selectedContent.description) && (
                <p style={{ color: 'var(--taupe)', fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
                  {lang === 'hy' && selectedContent.description_hy ? selectedContent.description_hy : selectedContent.description}
                </p>
              )}

              {selectedContent.is_unlocked && selectedContent.file_url ? (
                <>
                  {selectedContent.file_url.toLowerCase().endsWith('.pdf') && (
                    <iframe
                      src={selectedContent.file_url}
                      title={selectedContent.title}
                      style={{ width: '100%', height: 380, border: '1px solid var(--sand)', borderRadius: 8, marginBottom: 16, display: 'block' }}
                    />
                  )}
                  <a href={selectedContent.file_url} target="_blank" rel="noreferrer"
                    className="plan-btn plan-btn-fill"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    {t.download}
                  </a>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Lock size={13} /> {t.lockedLib}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Email-verified toast ── */}
      {verifiedToast && (
        <div className="toast-slide-in" style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid var(--sand)', borderRadius: 14,
          padding: '14px 16px', boxShadow: '0 10px 32px rgba(44,26,26,.16)', maxWidth: 340,
        }}>
          <span style={{ display: 'flex', color: '#2e7d32', flexShrink: 0 }}><CheckCircle2 size={22} /></span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--deep)' }}>{t.verifyOk}</p>
          <button onClick={() => setVerifiedToast(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 18, lineHeight: 1, marginLeft: 4, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
