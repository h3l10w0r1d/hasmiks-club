import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  PartyPopper, Flower2, AlertTriangle, UserPlus, MapPin, CalendarDays,
  Send, CheckCircle2, Circle, Lock, Image as ImageIcon, User, MessageCircle,
  Home, BookOpen, GalleryHorizontal, Users, CreditCard, Phone, ExternalLink, Search,
  LogOut, Shield,
} from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto, getMemberDirectory, getGallery, getAlbum, getGalleryNewCount, markGalleryVisited, addProfilePhoto, deleteProfilePhoto, getMemberProfile, unlinkTelegram, exportMyData, deleteMyAccount } from '../api/members'
import { getEvents, rsvp, cancelRsvp, joinWaitlist, leaveWaitlist, getWaitlistPosition, memberGuestTicketCheckout } from '../api/events'
import { getLibrary, updateLibraryProgress } from '../api/content'
import { getMemberSettings } from '../api/payments'
import { getMyPackages, getPublicPackages, checkoutPackage, removeCard } from '../api/packages'
import PackagePicker from '../components/PackagePicker'
import { getNotificationPreferences, updateNotificationPreferences } from '../api/notifications'
import { refreshToken as apiRefresh } from '../api/auth'
import { sanitizeHtml, stripHtml } from '../utils/sanitizeHtml'
import NotificationBell from '../components/NotificationBell'
import PostRegisterPackageModal from '../components/PostRegisterPackageModal'
import ConfirmDialog from '../components/ConfirmDialog'
import DateTile from '../components/EventDateTile'
// Forum disabled for now — kept for a future re-enable, see all "FORUM (disabled)" markers below.
// import ForumTab from '../components/ForumTab'
import MemberProfileModal from '../components/MemberProfileModal'
import LangSwitch from '../components/LangSwitch'
import TelegramLinkButton from '../components/TelegramLinkButton'
import { getCheckinToken } from '../api/events'
import client from '../api/client'
import { cldOptimize } from '../utils/cloudinary'

// Events (no longer a separate tab) live directly on Home — see the
// "Upcoming Events" list there, styled the same way as the public
// EventsPage.jsx list.
const TABS = ['home', 'profile', 'library', 'gallery', 'community', 'forum']
const TAB_ICONS = { home: Home, profile: User, library: BookOpen, gallery: GalleryHorizontal, community: Users, forum: MessageCircle }
// Mobile bottom nav has limited width — Profile lives behind the top-nav
// account icon instead, and Gallery is reachable from the Home tab's
// gallery preview card, so both are dropped from this shorter list.
// FORUM (disabled): 'forum' removed from this list — was ['home', 'library', 'community', 'forum']
const BOTTOM_NAV_TABS = ['home', 'library', 'community']

function HomeHeading({ icon: Icon, children }) {
  return <h3 className="home-heading"><Icon size={17} strokeWidth={1.75} />{children}</h3>
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={accent ? { color: 'var(--rose)', background: 'var(--rose-bg, #F5EAEA)' } : undefined}>
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function getCountdown(iso, lang) {
  const diff = new Date(iso) - new Date()
  if (diff < 0) return null
  // Compare calendar days, not raw elapsed hours — an event later today but
  // more than a few hours away must still say "Today", not "Tomorrow".
  const dayDiff = Math.round((startOfDay(iso) - startOfDay(new Date())) / 864e5)
  if (dayDiff === 0) return lang === 'hy' ? 'Այսօր!' : 'Today!'
  if (dayDiff === 1) return lang === 'hy' ? 'Վաղը!' : 'Tomorrow!'
  if (dayDiff <= 7) return lang === 'hy' ? `${dayDiff} օրից` : `In ${dayDiff} days`
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

// Mirrors backend NOTIFICATION_TYPES (app/routers/notifications.py) — every
// value ever passed as Notification.type.
const NOTIF_TYPES = [
  { key: 'rsvp',     en: 'Event RSVPs',      hy: 'Միջոցառումների հաստատումներ' },
  { key: 'waitlist', en: 'Waitlist',         hy: 'Սպասման ցուցակ' },
  { key: 'content',  en: 'New content',      hy: 'Նոր բովանդակություն' },
  { key: 'system',   en: 'Account & system', hy: 'Հաշիվ և համակարգ' },
]

// Set by RegisterPage right after a successful (auto-approved) signup —
// keep this string in sync with the matching constant there.
const JUST_REGISTERED_KEY = 'hc_just_registered'

export default function DashboardPage({ lang, setLang }) {
  const { user, setUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'home')
  // Set by RegisterPage right after a successful (auto-approved) signup —
  // shows the package-picker popup instantly on arrival here. Read from
  // sessionStorage, not router navigation state: signing in on the
  // register page makes GuestOnlyRoute redirect away from it on its own
  // the instant that auth-context update lands, and that redirect reliably
  // races (and wins over) any navigate(..., {state}) call made there,
  // silently dropping the state before this page ever sees it.
  const [showPackageModal, setShowPackageModal] = useState(() => {
    try { return sessionStorage.getItem(JUST_REGISTERED_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { sessionStorage.removeItem(JUST_REGISTERED_KEY) } catch { /* storage unavailable */ }
  }, [])

  const [newPhotoCount, setNewPhotoCount] = useState(0)

  // Keep the URL's ?tab= in sync so refreshing (or sharing/bookmarking the
  // link) lands back on the same tab instead of always resetting to Home.
  const changeTab = useCallback((next) => {
    setTab(next)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('tab', next)
      return p
    }, { replace: true })
    // Opening the gallery clears the "N new" badge on Home — fire-and-forget,
    // the tab switch shouldn't wait on it.
    if (next === 'gallery') {
      markGalleryVisited().then(() => setNewPhotoCount(0)).catch(() => {})
    }
  }, [setSearchParams])
  const [events, setEvents] = useState([])
  const [library, setLibrary] = useState([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryType, setLibraryType] = useState('all')
  const [directory, setDirectory] = useState([])
  const [directorySearch, setDirectorySearch] = useState('')
  const [directorySearchResults, setDirectorySearchResults] = useState(null) // null = not searching, use full `directory`
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
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [oneTimeTicketLoading, setOneTimeTicketLoading] = useState(null) // eventId currently checking out, or null
  const [telegramUrl, setTelegramUrl] = useState('')
  const [myPackages, setMyPackages] = useState({ packages: [], credits_available: 0 })
  const [buyablePackages, setBuyablePackages] = useState([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedContent, setSelectedContent] = useState(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  // FORUM (disabled): re-enable when Forum comes back
  // const [forumDeepLinkTopicId, setForumDeepLinkTopicId] = useState(null)
  const [albums, setAlbums] = useState([])
  const [openAlbum, setOpenAlbum] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [rsvpDone, setRsvpDone] = useState({})
  const fileInputRef = useRef(null)
  const homeLoaded = useRef(false)

  const closeContent = useCallback(() => { setSelectedContent(null); setReaderOpen(false) }, [])
  // Self-reported "how far did you get" — there's no in-app reader to track
  // this automatically, library items are just downloadable files.
  const handleSetProgress = useCallback((contentId, progress) => {
    updateLibraryProgress(contentId, progress).then(() => {
      setLibrary(list => list.map(i => i.id === contentId ? { ...i, progress } : i))
      setSelectedContent(c => c && c.id === contentId ? { ...c, progress } : c)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!selectedContent) return
    const onKey = (e) => { if (e.key === 'Escape') { readerOpen ? setReaderOpen(false) : closeContent() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedContent, readerOpen, closeContent])

  const t = {
    home:        lang === 'hy' ? 'Գլխ.' : 'Home',
    profile:     lang === 'hy' ? 'Պրոֆիլ' : 'Profile',
    library:     lang === 'hy' ? 'Գրադարան' : 'Library',
    community:   lang === 'hy' ? 'Ակումբ' : 'Club',
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
    showInDir:   lang === 'hy' ? 'Ցուցադրել ակումբի ցուցակում' : 'Show in club directory',
    seats:       lang === 'hy' ? 'տեղ է մնացել' : 'seats left',
    rsvpBtn:     lang === 'hy' ? 'Գրանցվել' : 'RSVP',
    cancelRsvp:  lang === 'hy' ? 'Չեղարկել' : 'Cancel RSVP',
    booked:      lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    waitlist:    lang === 'hy' ? 'Ցուցակ' : 'Join Waitlist',
    leaveWait:   lang === 'hy' ? 'Ցուցակից հեռացնել' : 'Leave Waitlist',
    waitPos:     lang === 'hy' ? 'Հերթ' : 'Waitlist position',
    noLibrary:   lang === 'hy' ? 'Ձեր գրադարանը դատարկ է' : 'Your library is empty',
    lockedLib:   lang === 'hy' ? 'Կողպված' : 'Locked',
    recipe:      lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
    ebook:       lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
    download:    lang === 'hy' ? 'Բեռնել' : 'Download',
    joinTelegram:lang === 'hy' ? 'Միանալ Telegram խմբին' : 'Join our Telegram group',
    gallery:     lang === 'hy' ? 'Լուսանկարներ' : 'Gallery',
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
    tgConnected: lang === 'hy' ? 'Կապակցված է որպես' : 'Connected as',
    tgDisconnect:lang === 'hy' ? 'Անջատել' : 'Disconnect',
    tgSignInNote:lang === 'hy' ? 'Կապակցեք՝ Telegram-ով մուտք գործելու համար' : 'Connect it so you can also sign in with Telegram',
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
    }).catch(() => {})
    getMemberSettings().then(s => { if (alive) setTelegramUrl(s.telegram_invite_url || '') }).catch(() => {})
    getMyPackages().then(p => { if (alive) setMyPackages(p) }).catch(() => {})
    getPublicPackages().then(p => { if (alive) setBuyablePackages(p) }).catch(() => {})
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
      getGalleryNewCount().then(r => setNewPhotoCount(r.count)).catch(() => {})
      if (isActive) getMemberDirectory().then(setDirectory).catch(() => {})
    }
    if (tab === 'library') getLibrary().then(setLibrary).catch(() => {})
    if (tab === 'gallery') getGallery().then(setAlbums).catch(() => {})
    if (tab === 'community' && isActive) getMemberDirectory().then(setDirectory).catch(() => {})
    // forum data is loaded inside the ForumTab component
  }, [tab])

  // Debounced member-directory search — keeps `directory` itself untouched
  // (it also backs the "Club" stat card on the home tab) and only swaps in
  // search results while the query box has text.
  useEffect(() => {
    if (!directorySearch.trim()) { setDirectorySearchResults(null); return }
    const id = setTimeout(() => {
      getMemberDirectory(directorySearch.trim()).then(setDirectorySearchResults).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [directorySearch])

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

  const handleTelegramLinked = (updated) => {
    setUser(updated)
    setMsg(lang === 'hy' ? 'Telegram-ը կապակցված է ✓' : 'Telegram connected ✓')
    setTimeout(() => setMsg(''), 2500)
  }

  const handleTelegramUnlink = async () => {
    try {
      const updated = await unlinkTelegram()
      setUser(updated)
    } catch (err) {
      setMsg(err?.response?.data?.detail || (lang === 'hy' ? 'Չհաջողվեց անջատել' : 'Could not disconnect'))
      setTimeout(() => setMsg(''), 3000)
    }
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

  const handleBuyOneTimeTicket = async (ev) => {
    setRsvpError('')
    setOneTimeTicketLoading(ev.id)
    try {
      const { url } = await memberGuestTicketCheckout(ev.id, lang)
      window.location.href = url
    } catch (err) {
      const detail = err?.response?.data?.detail
      setRsvpError(detail || (lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong'))
      setOneTimeTicketLoading(null)
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

  // Cancelling/leaving/deleting/disconnecting are all one-tap-irreversible on
  // the old buttons — a mis-tap loses your RSVP, a photo, or a login method
  // with no way back. Route the destructive branch through a confirm step;
  // joining/RSVPing stays a direct single tap since it's harmless to redo.
  const handleRsvpClick = (event) => {
    if (event.user_has_rsvp) {
      setConfirmDialog({
        title: lang === 'hy' ? 'Չեղարկե՞լ գրանցումը' : 'Cancel your RSVP?',
        body: lang === 'hy' ? `Ձեր տեղը «${event.title}»-ի համար կազատվի:` : `Your spot for "${event.title}" will be released.`,
        confirmLabel: t.cancelRsvp,
        onConfirm: () => handleRsvp(event),
      })
    } else {
      handleRsvp(event)
    }
  }

  const handleWaitlistClick = (event) => {
    const onList = waitlistPositions[event.id]?.on_waitlist
    if (onList) {
      setConfirmDialog({
        title: lang === 'hy' ? 'Հեռանա՞լ ցուցակից' : 'Leave the waitlist?',
        body: lang === 'hy' ? `Դուք կկորցնեք ձեր տեղը «${event.title}»-ի սպասման ցուցակում:` : `You'll lose your spot on the waitlist for "${event.title}".`,
        confirmLabel: t.leaveWait,
        onConfirm: () => handleWaitlist(event),
      })
    } else {
      handleWaitlist(event)
    }
  }

  const confirmGalleryDelete = (photoId) => {
    setConfirmDialog({
      title: lang === 'hy' ? 'Ջնջե՞լ նկարը' : 'Delete this photo?',
      body: lang === 'hy' ? 'Այս գործողությունը հնարավոր չէ հետարկել:' : 'This can\'t be undone.',
      confirmLabel: lang === 'hy' ? 'Ջնջել' : 'Delete',
      onConfirm: () => handleGalleryDelete(photoId),
    })
  }

  const confirmTelegramUnlink = () => {
    setConfirmDialog({
      title: lang === 'hy' ? 'Անջատե՞լ Telegram-ը' : 'Disconnect Telegram?',
      body: lang === 'hy' ? 'Այլևս չեք կարողանա մուտք գործել Telegram-ի միջոցով, եթե նորից չկապակցեք:' : 'You won\'t be able to sign in with Telegram again until you reconnect it.',
      confirmLabel: t.tgDisconnect,
      danger: false,
      onConfirm: handleTelegramUnlink,
    })
  }

  const handleResendVerify = async () => {
    try {
      await client.post('/auth/resend-verification')
      setMsg(lang === 'hy' ? 'Հաստատման նամակն ուղարկվել է' : 'Verification email sent!')
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg(lang === 'hy' ? 'Սխալ' : 'Error sending email') }
  }

  // Navigate away first, then clear the user — ProtectedRoute reactively
  // redirects to /login the instant `user` goes null, so clearing it while
  // still mounted here races this navigate('/') and (has been observed to)
  // win, landing signed-out users on /login instead of the homepage.
  const handleSignOut = () => { navigate('/'); signOut() }

  const [notifPrefs, setNotifPrefs] = useState(null)
  useEffect(() => {
    if (tab === 'profile' && notifPrefs === null) {
      getNotificationPreferences().then(setNotifPrefs).catch(() => {})
    }
  }, [tab, notifPrefs])
  const toggleNotifPref = (type, channel) => {
    if (!notifPrefs) return
    const next = { ...notifPrefs, [type]: { ...notifPrefs[type], [channel]: !notifPrefs[type][channel] } }
    setNotifPrefs(next)
    updateNotificationPreferences(next).catch(() => setNotifPrefs(notifPrefs)) // revert on failure
  }

  const [exportingData, setExportingData] = useState(false)
  const handleExportData = async () => {
    setExportingData(true)
    try {
      const blob = await exportMyData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMsg(lang === 'hy' ? 'Չհաջողվեց ներբեռնել տվյալները' : 'Could not download your data')
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setExportingData(false)
    }
  }

  const [deletingAccount, setDeletingAccount] = useState(false)
  const confirmDeleteAccount = () => {
    setConfirmDialog({
      title: lang === 'hy' ? 'Ջնջե՞լ հաշիվը' : 'Delete your account?',
      body: lang === 'hy'
        ? 'Ձեր անձնական տվյալները (անուն, էլ. փոստ, լուսանկարներ, կոնտակտներ) կհեռացվեն ընդմիշտ, և դուք կդուրս գաք համակարգից: Այս գործողությունը հնարավոր չէ հետարկել:'
        : 'Your personal details (name, email, photos, contact info) are permanently removed and you\'ll be signed out. This cannot be undone.',
      confirmLabel: lang === 'hy' ? 'Ջնջել հաշիվը' : 'Delete my account',
      danger: true,
      onConfirm: async () => {
        setDeletingAccount(true)
        try {
          await deleteMyAccount()
          navigate('/')
          signOut()
        } catch {
          setMsg(lang === 'hy' ? 'Չհաջողվեց ջնջել հաշիվը' : 'Could not delete your account')
          setTimeout(() => setMsg(''), 3000)
        } finally {
          setDeletingAccount(false)
        }
      },
    })
  }

  // Generic "buy a package" prompts scattered around the dashboard (RSVP
  // gate, forum gate, etc.) send the member to /welcome to pick a package —
  // buying a specific one inline (the package-status card's own picker)
  // uses handleBuyPackage below instead of navigating away.
  const handleSubscribe = () => navigate('/welcome')

  const [buyPickerOpen, setBuyPickerOpen] = useState(false)
  const [buyPackageKey, setBuyPackageKey] = useState(null)
  const handleBuyPackage = async (packageKey) => {
    setCheckoutLoading(true)
    try {
      const result = await checkoutPackage(packageKey, lang)
      if (result.mode === 'redirect') {
        window.location.href = result.url
        return
      }
      if (result.success) {
        const fresh = await getMe()
        setUser(fresh)
        setMyPackages(await getMyPackages())
        setBuyPickerOpen(false)
      } else {
        setMsg(result.message || (lang === 'hy' ? 'Վճարումը չհաջողվեց: Փորձե՛ք կրկին:' : 'The payment failed. Please try again.'))
      }
    } catch {
      setMsg(lang === 'hy' ? 'Չհաջողվեց սկսել վճարումը: Փորձե՛ք կրկին:' : 'Could not start checkout. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const [removeCardLoading, setRemoveCardLoading] = useState(false)
  const handleRemoveCard = () => {
    setConfirmDialog({
      title: lang === 'hy' ? 'Հեռացնե՞լ պահված քարտը' : 'Remove saved card?',
      body: lang === 'hy'
        ? 'Հաջորդ գնումը կպահանջի կրկին անցնել վճարման էջով:'
        : "Your next package purchase will go through the payment page again instead of charging instantly.",
      confirmLabel: lang === 'hy' ? 'Հեռացնել' : 'Remove',
      onConfirm: async () => {
        setRemoveCardLoading(true)
        try {
          await removeCard()
          const fresh = await getMe()
          setUser(fresh)
        } catch {
          setMsg(lang === 'hy' ? 'Չհաջողվեց հեռացնել: Փորձե՛ք կրկին:' : 'Could not remove the card. Please try again.')
        } finally {
          setRemoveCardLoading(false)
        }
      },
    })
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
  // SUPERSEDED — 'past_due' was a recurring-billing state (a renewal charge
  // failed); packages are one-time purchases, so it's never set by new
  // checkouts. Left readable for any legacy account still carrying it.
  const isPastDue = user.membership_status === 'past_due'
  const packageFailed = searchParams.get('package') === 'failed'
  const creditsAvailable = myPackages.credits_available

  // Ghost view: approved accounts that haven't bought a package yet can
  // still browse the dashboard, but aren't visible in the directory, can't
  // post in the forum, and can't RSVP to events (all enforced server-side
  // too) until they buy one. This banner is their one persistent,
  // always-visible path back to checkout — shown on every tab, not a
  // full-page block.
  const membershipBanner = !isActive && (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      background: packageFailed ? '#fdecea' : '#fff8f5',
      border: `1px solid ${packageFailed ? '#f3c6c0' : '#f5ddd0'}`,
      borderRadius: 14, padding: '16px 20px', marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CreditCard size={22} strokeWidth={1.5} color={packageFailed ? '#c0392b' : 'var(--rose)'} style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: packageFailed ? '#c0392b' : '#2c1a1a', margin: 0 }}>
            {packageFailed
              ? (lang === 'hy' ? 'Վերջին վճարման փորձը չհաջողվեց' : 'Your last payment attempt failed')
              : (lang === 'hy' ? 'Դուք դիտում եք որպես հյուր' : "You're browsing as a guest")}
          </p>
          <p style={{ fontSize: 12.5, color: '#8a746a', margin: '2px 0 0' }}>
            {packageFailed
              ? (lang === 'hy' ? 'Կրկին փորձեք, կամ կապվեք մեզ հետ, եթե խնդիրը կրկնվում է:' : 'Try again, or contact us if this keeps happening.')
              : (lang === 'hy'
                  ? 'Գնեք փաթեթ՝ ֆորումում գրելու, հանդիպումներին գրանցվելու և ակումբին տեսանելի լինելու համար:'
                  : 'Buy a package to post in the forum, RSVP to gatherings, and be visible to the club.')}
          </p>
          {msg && <p style={{ fontSize: 12.5, color: '#c0392b', margin: '4px 0 0' }}>{msg}</p>}
        </div>
      </div>
      <button
        onClick={handleSubscribe}
        style={{ background: '#c0394b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {packageFailed
          ? (lang === 'hy' ? 'Կրկին փորձել' : 'Try Again')
          : (lang === 'hy' ? 'Գնել փաթեթ' : 'Buy a Package')}
      </button>
    </div>
  )

  // Home tab helpers
  const now = new Date()
  const upcomingEvents = events.filter(ev => new Date(ev.event_date) > now)
  const unlockedLibrary = library.filter(item => item.is_unlocked)
  // The event to feature in the hero card — whichever the member is
  // already RSVP'd to and soonest, or just the soonest event overall if
  // they haven't RSVP'd to anything yet.
  const heroEvent = upcomingEvents.find(ev => ev.user_has_rsvp) || upcomingEvents[0] || null
  const myRsvpCount = upcomingEvents.filter(ev => ev.user_has_rsvp).length
  const totalPhotoCount = albums.reduce((sum, a) => sum + (a.photo_count || 0), 0)
  // "Currently reading" — the first unlocked item with visible progress,
  // falling back to the first unlocked item at 0% if nothing's started yet.
  const currentlyReading = unlockedLibrary.find(item => item.progress > 0 && item.progress < 100) || unlockedLibrary[0] || null

  // Same RSVP/waitlist/buy-ticket button block used both in the hero card
  // and in each row of the Upcoming Events list — kept as one function
  // (not a separate component) so it can close over all the handlers/state
  // above without prop-drilling a dozen values through.
  const renderEventActions = (ev) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Link to={`/events/${ev.id}`} className="plan-btn plan-btn-outline plan-btn-row" style={{ textDecoration: 'none' }}>
        {lang === 'hy' ? 'Մանրամասն' : 'Details'}
      </Link>
      {rsvpDone[ev.id] ? (
        <span style={{ color: '#c0394b', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>You're going! <PartyPopper size={15} /></span>
      ) : !isActive ? (
        <>
          <button className="plan-btn plan-btn-fill plan-btn-row" onClick={handleSubscribe}>{lang === 'hy' ? 'Գնեք փաթեթ՝ գրանցվելու համար' : 'Buy a package to RSVP'}</button>
          {ev.ticket_price != null && ev.seats_available > 0 && !(ev.max_guest_tickets != null && ev.guest_seats_taken >= ev.max_guest_tickets) && (
            <button
              className="plan-btn plan-btn-outline plan-btn-row"
              disabled={oneTimeTicketLoading === ev.id}
              onClick={() => handleBuyOneTimeTicket(ev)}
            >
              {oneTimeTicketLoading === ev.id
                ? (lang === 'hy' ? 'Բեռնվում է…' : 'Loading…')
                : (lang === 'hy'
                  ? `Գնել մեկանգամյա տոմս — ֏${Number(ev.ticket_price).toLocaleString()}`
                  : `Buy a one-time ticket — ֏${Number(ev.ticket_price).toLocaleString()}`)}
            </button>
          )}
        </>
      ) : ev.user_has_rsvp ? (
        <button className="plan-btn plan-btn-outline plan-btn-row" onClick={() => handleRsvpClick(ev)}>{t.cancelRsvp}</button>
      ) : creditsAvailable <= 0 ? (
        <button className="plan-btn plan-btn-fill plan-btn-row" onClick={handleSubscribe}>{lang === 'hy' ? 'Գնեք փաթեթ՝ գրանցվելու համար' : 'Buy a package to RSVP'}</button>
      ) : ev.seats_available > 0 ? (
        <button className="plan-btn plan-btn-fill plan-btn-row" onClick={() => handleRsvp(ev)}>{t.rsvpBtn}</button>
      ) : (
        <button
          className={`plan-btn plan-btn-row ${waitlistPositions[ev.id]?.on_waitlist ? 'plan-btn-outline' : 'plan-btn-fill'}`}
          style={{ background: waitlistPositions[ev.id]?.on_waitlist ? undefined : '#f39c12', borderColor: '#f39c12', color: waitlistPositions[ev.id]?.on_waitlist ? '#f39c12' : '#fff' }}
          onClick={() => handleWaitlistClick(ev)}
        >
          {waitlistPositions[ev.id]?.on_waitlist ? t.leaveWait : t.waitlist}
        </button>
      )}
      {waitlistPositions[ev.id]?.on_waitlist && (
        <span style={{ fontSize: 13, color: '#f39c12', fontWeight: 600 }}>
          #{waitlistPositions[ev.id].position} {t.waitPos}
        </span>
      )}
    </div>
  )
  const filteredLibrary = library.filter(item => {
    if (libraryType !== 'all' && item.type !== libraryType) return false
    if (!librarySearch.trim()) return true
    const q = librarySearch.trim().toLowerCase()
    const title = (lang === 'hy' && item.title_hy ? item.title_hy : item.title) || ''
    const desc = (lang === 'hy' && item.description_hy ? item.description_hy : item.description) || ''
    return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
  })
  const hour = new Date().getHours()
  const greeting = hour < 12
    ? (lang === 'hy' ? 'Բարի առավոտ' : 'Good morning')
    : hour < 18
      ? (lang === 'hy' ? 'Բարի կեսօր' : 'Good afternoon')
      : (lang === 'hy' ? 'Բարի երեկո' : 'Good evening')

  return (
    <div className="dash-page">
      <nav className="dash-nav">
        <Link to="/" className="dash-nav-brand">
          <img src="/logo-h.png" alt="" className="dash-nav-logo" aria-hidden="true" />
          Hasmik's <span>Club</span>
        </Link>
        <div className="dash-nav-right">
          <LangSwitch lang={lang} setLang={setLang} />
          <NotificationBell />
          <Link to="/contact" className="dash-signout" aria-label={lang === 'hy' ? 'Կապ' : 'Contact'} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Phone size={14} strokeWidth={2} className="dash-signout-icon" />
            <span className="dash-signout-label">{lang === 'hy' ? 'Կապ' : 'Contact'}</span>
          </Link>
          <button className="dash-signout dash-profile-btn" onClick={() => changeTab('profile')} aria-label={t.profile}>
            <User size={14} strokeWidth={2} />
          </button>
          <span className="dash-user-name">{user.full_name}</span>
          {user.is_admin && (
            <Link to="/admin" className="dash-signout" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} strokeWidth={2} className="dash-signout-icon" />
              <span className="dash-signout-label">Admin</span>
            </Link>
          )}
          <button className="dash-signout" onClick={handleSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={14} strokeWidth={2} className="dash-signout-icon" />
            <span className="dash-signout-label">{t.signOut}</span>
          </button>
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
            {['home'].map(k => {
              const Icon = TAB_ICONS[k]
              return (
                <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>
                  <Icon size={16} strokeWidth={1.75} /> {t[k]}
                </button>
              )
            })}
          </div>
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{lang === 'hy' ? 'Անձ.' : 'Personal'}</span>
            {['profile', 'library'].map(k => {
              const Icon = TAB_ICONS[k]
              return (
                <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>
                  <Icon size={16} strokeWidth={1.75} /> {t[k]}
                </button>
              )
            })}
          </div>
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{lang === 'hy' ? 'Ակումբ' : 'Club'}</span>
            {/* FORUM (disabled): 'forum' removed from this list — was ['gallery', 'community', 'forum'] */}
            {['gallery', 'community'].map(k => {
              const Icon = TAB_ICONS[k]
              return (
                <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>
                  <Icon size={16} strokeWidth={1.75} /> {t[k]}
                </button>
              )
            })}
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
              <div className="home-header-row">
                <h2 className="dash-section-title" style={{ margin: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {greeting}, {user.full_name.split(' ')[0]}! <Flower2 size={20} strokeWidth={1.5} color="var(--rose)" />
                  </span>
                </h2>
                {isActive && telegramUrl && (
                  <a href={telegramUrl} target="_blank" rel="noreferrer" className="home-telegram-chip">
                    <Send size={15} strokeWidth={2} />
                    {lang === 'hy' ? 'Միանալ Telegram խմբին' : 'Join the Telegram group'}
                  </a>
                )}
              </div>

              {/* Featured event — whichever is soonest and (preferably) already RSVP'd */}
              {heroEvent && (() => {
                const title = lang === 'hy' && heroEvent.title_hy ? heroEvent.title_hy : heroEvent.title
                const descRaw = lang === 'hy' && heroEvent.description_hy ? heroEvent.description_hy : heroEvent.description
                const descFull = descRaw ? stripHtml(descRaw) : ''
                const desc = descFull.length > 220 ? `${descFull.slice(0, 220).trim()}…` : descFull
                const countdown = getCountdown(heroEvent.event_date, lang)
                return (
                  <div className="home-hero-card">
                    <div className="home-hero-body">
                      <span className="home-hero-eyebrow">
                        {heroEvent.user_has_rsvp
                          ? (lang === 'hy' ? 'Ձեր հաջորդ հանդիպումը' : "Your next event")
                          : (lang === 'hy' ? 'Ամենամոտ հանդիպումը' : 'Closest upcoming event')}
                      </span>
                      <Link to={`/events/${heroEvent.id}`} className="home-hero-title">{title}</Link>
                      <div className="event-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={13} /> {new Date(heroEvent.event_date).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { day: 'numeric', month: 'short' })}, {new Date(heroEvent.event_date).toLocaleTimeString(lang === 'hy' ? 'hy-AM' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {heroEvent.location}</span>
                      </div>
                      {desc && <p className="event-desc" style={{ marginBottom: 16 }}>{desc}</p>}
                      {renderEventActions(heroEvent)}
                    </div>
                    {heroEvent.cover_url && (
                      <Link to={`/events/${heroEvent.id}`} className="home-hero-img">
                        <img src={cldOptimize(heroEvent.cover_url, { width: 900 })} alt={title} />
                        {countdown && <span className="home-hero-countdown">{countdown}</span>}
                      </Link>
                    )}
                  </div>
                )
              })()}

              {/* At-a-glance stats */}
              <div className="stat-strip">
                <StatCard icon={CheckCircle2} label={lang === 'hy' ? 'Իմ գրանցումները' : 'My RSVPs'} value={myRsvpCount} accent={myRsvpCount > 0} />
                <StatCard icon={BookOpen} label={t.library} value={unlockedLibrary.length} />
                <StatCard icon={ImageIcon} label={lang === 'hy' ? 'Լուսանկարներ' : 'Photos'} value={totalPhotoCount} />
                <StatCard icon={Users} label={lang === 'hy' ? 'Ակումբ' : 'Club'} value={directory.length} />
              </div>

              <div className="home-grid">
              <div className="home-main">
              {/* Upcoming events — same image-left/content-right layout as the public events page */}
              <div style={{ marginBottom: 32 }}>
                <HomeHeading icon={CalendarDays}>{lang === 'hy' ? 'Առաջիկա հանդիպումները' : 'Upcoming Events'}</HomeHeading>
                {rsvpError && <p className="auth-error" style={{ marginBottom: 12 }}>{rsvpError}</p>}
                {upcomingEvents.length === 0 ? (
                  <div className="home-card">
                    <p style={{ color: '#9b6e6e', fontSize: 14, fontStyle: 'italic', margin: 0 }}>
                      {lang === 'hy' ? 'Առայժմ հանդիպումներ չկան — շուտով կլինեն' : 'No upcoming events — check back soon'}
                    </p>
                  </div>
                ) : groupEventsByDate(upcomingEvents, lang).map(group => (
                  <div key={group.key} style={{ marginBottom: 20 }}>
                    <h3 style={{
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--rose)', margin: '0 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--sand)',
                    }}>
                      {group.label}
                    </h3>
                    {group.events.map(ev => {
                      const title = lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title
                      const descRaw = lang === 'hy' && ev.description_hy ? ev.description_hy : ev.description
                      const descFull = descRaw ? stripHtml(descRaw) : ''
                      const desc = descFull.length > 160 ? `${descFull.slice(0, 160).trim()}…` : descFull
                      return (
                        <div key={ev.id} className="event-row" style={{ background: '#fff', borderRadius: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(126,52,52,.07)', border: '1px solid #f5ecee', overflow: 'hidden' }}>
                          {ev.cover_url && (
                            <Link to={`/events/${ev.id}`} className="event-row-img">
                              <img className="event-row-img-el" src={cldOptimize(ev.cover_url, { width: 800 })} alt={title} />
                              <DateTile iso={ev.event_date} lang={lang} />
                            </Link>
                          )}
                          <div className="event-row-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                              <Link to={`/events/${ev.id}`} style={{ textDecoration: 'none', color: '#2c1a1a', fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif", fontSize: 22, fontWeight: 600 }}>{title}</Link>
                              <span style={ev.seats_available > 0 ? {
                                display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                                background: '#edfaf3', color: '#2a7a50', fontSize: 12, fontWeight: 600,
                                border: '1px solid #c5eddb', whiteSpace: 'nowrap',
                              } : {
                                display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                                background: '#fef2f2', color: '#7E3434', fontSize: 12, fontWeight: 600,
                                border: '1px solid #f5d9d9', whiteSpace: 'nowrap',
                              }}>
                                {ev.seats_available > 0 ? `${ev.seats_available} ${t.seats}` : t.booked}
                              </span>
                            </div>
                            <div className="event-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {ev.location}</span> ·
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={13} /> {new Date(ev.event_date).toLocaleTimeString(lang === 'hy' ? 'hy-AM' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              {getCountdown(ev.event_date, lang) && (
                                <span style={{ background: '#fff0f2', color: '#c0394b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                                  {getCountdown(ev.event_date, lang)}
                                </span>
                              )}
                            </div>
                            {desc && <p className="event-desc" style={{ marginBottom: 12 }}>{desc}</p>}
                            {renderEventActions(ev)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              </div>

              <div className="home-side">
              {/* Gallery preview */}
              {albums.length > 0 && albums[0].cover_url && (
                <div style={{ marginBottom: 28 }}>
                  <HomeHeading icon={GalleryHorizontal}>{lang === 'hy' ? 'Լուսանկարներ' : 'Gallery'}</HomeHeading>
                  <div
                    className="home-clickable"
                    style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--sand)' }}
                    onClick={() => changeTab('gallery')}
                  >
                    <img src={cldOptimize(albums[0].cover_url, { width: 800 })} alt={albums[0].title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(44,26,26,.6) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: '16px 20px' }}>
                      <span style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#fff' }}>{albums[0].title}</span>
                    </div>
                    {newPhotoCount > 0 && (
                      <span className="home-new-badge">
                        {lang === 'hy' ? `${newPhotoCount} նոր` : `${newPhotoCount} new`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Currently reading */}
              {currentlyReading && (
                <div style={{ marginBottom: 28 }}>
                  <HomeHeading icon={BookOpen}>{lang === 'hy' ? 'Գրադարանից' : 'From the Library'}</HomeHeading>
                  <div
                    className="home-card home-clickable"
                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
                    onClick={() => setSelectedContent(currentlyReading)}
                  >
                    {currentlyReading.cover_url && (
                      <img src={cldOptimize(currentlyReading.cover_url, { width: 96 })} alt={currentlyReading.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>
                        {currentlyReading.type === 'recipe' ? t.recipe : t.ebook}
                      </div>
                      <div style={{ fontWeight: 600, color: '#2c1a1a', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                        {lang === 'hy' && currentlyReading.title_hy ? currentlyReading.title_hy : currentlyReading.title}
                      </div>
                      <div className="home-progress-track">
                        <div className="home-progress-fill" style={{ width: `${currentlyReading.progress}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rose)', flexShrink: 0 }}>{currentlyReading.progress}%</span>
                  </div>
                </div>
              )}

              {/* Community */}
              {directory.length > 0 && (
                <div className="home-card">
                  <div className="home-avatar-stack">
                    {directory.slice(0, 3).map(m => (
                      m.photo_url
                        ? <img key={m.id} src={cldOptimize(m.photo_url, { width: 64 })} alt={m.full_name} className="home-avatar" />
                        : <span key={m.id} className="home-avatar home-avatar-initials">{m.full_name?.[0] || '?'}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 20, fontWeight: 700, color: '#2c1a1a', margin: '10px 0 2px' }}>
                    {directory.length} {lang === 'hy' ? 'անդամ ակումբում' : 'members in the club'}
                  </div>
                  <div style={{ fontSize: 13, color: '#9b6e6e', marginBottom: 14 }}>
                    {lang === 'hy' ? 'Ծանոթացե՛ք Hasmik\'s Club-ի անդամների հետ' : "Connect with fellow Hasmik's Club members"}
                  </div>
                  <button
                    onClick={() => changeTab('community')}
                    style={{ width: '100%', background: 'none', border: '1px solid #c0394b', color: '#c0394b', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {lang === 'hy' ? 'Ծանոթանալ →' : 'View all →'}
                  </button>
                </div>
              )}
              </div>
              </div>
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

              {isActive && (
                <div style={{ background: '#fff', border: '1px solid #f0dde0', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={15} /> {lang === 'hy' ? 'Փաթեթներ' : 'Packages'}
                  </p>

                  <p style={{ fontSize: 13, color: '#555', margin: '0 0 4px' }}>
                    {lang === 'hy' ? 'Հասանելի մասնակցություններ՝ ' : 'Credits available: '}
                    <strong style={{ color: creditsAvailable > 0 ? '#2e7d32' : '#c0392b' }}>{creditsAvailable}</strong>
                  </p>
                  {myPackages.packages.filter(p => p.credits_remaining > 0).map(p => (
                    <p key={p.id} style={{ fontSize: 12.5, color: '#888', margin: '0 0 4px' }}>
                      {lang === 'hy' ? p.name_hy : p.name_en} — {p.credits_remaining} {lang === 'hy' ? 'մասնակցություն' : 'left'}
                      {p.expires_at && ` · ${lang === 'hy' ? 'ավարտ՝' : 'expires'} ${new Date(p.expires_at).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB')}`}
                    </p>
                  ))}

                  <p style={{ fontSize: 12.5, color: '#888', margin: '12px 0' }}>
                    {user.binding_active
                      ? (lang === 'hy' ? 'Քարտը պահված է — հաջորդ գնումն ակնթարթային կլինի:' : 'Card on file — your next purchase will be instant.')
                      : (lang === 'hy' ? 'Քարտ պահված չէ:' : 'No card on file.')}
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: buyPickerOpen ? 14 : 0 }}>
                    <button
                      onClick={() => setBuyPickerOpen(o => !o)}
                      style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
                    >
                      {buyPickerOpen ? (lang === 'hy' ? 'Փակել' : 'Close') : (lang === 'hy' ? 'Գնել փաթեթ' : 'Buy another package')}
                    </button>
                    {user.binding_active && (
                      <button
                        onClick={handleRemoveCard}
                        disabled={removeCardLoading}
                        style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '7px 14px', cursor: removeCardLoading ? 'default' : 'pointer', fontSize: 12.5, color: '#888', opacity: removeCardLoading ? 0.6 : 1 }}
                      >
                        {removeCardLoading
                          ? (lang === 'hy' ? 'Հեռացվում է…' : 'Removing…')
                          : (lang === 'hy' ? 'Հեռացնել քարտը' : 'Remove saved card')}
                      </button>
                    )}
                  </div>

                  {buyPickerOpen && (
                    <div>
                      <PackagePicker packages={buyablePackages} selected={buyPackageKey} onSelect={setBuyPackageKey} lang={lang} />
                      <button
                        onClick={() => handleBuyPackage(buyPackageKey)}
                        disabled={checkoutLoading || !buyPackageKey}
                        style={{ marginTop: 12, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: checkoutLoading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: checkoutLoading ? 0.7 : 1 }}
                      >
                        {checkoutLoading ? (lang === 'hy' ? 'Բեռնվում է…' : 'Loading…') : (lang === 'hy' ? 'Հաստատել գնումը' : 'Confirm purchase')}
                      </button>
                    </div>
                  )}
                </div>
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
                      ? <img src={cldOptimize(profileForm.photo_url, { width: 200 })} alt="avatar" className="profile-avatar" />
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

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--sand)' }}>
                      {user.telegram_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--deep)', fontWeight: 600 }}>
                            <CheckCircle2 size={15} color="#2e7d32" />
                            {t.tgConnected} {user.telegram_username ? `@${user.telegram_username}` : 'Telegram'}
                          </span>
                          <button type="button" onClick={confirmTelegramUnlink}
                            style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                            {t.tgDisconnect}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <TelegramLinkButton lang={lang} onSuccess={handleTelegramLinked} onError={(m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }} />
                          <span style={{ fontSize: 12, color: '#aaa' }}>{t.tgSignInNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="profile-card">
                    <p className="profile-card-title">{t.myPhotos}</p>
                    <p style={{ fontSize: 12, color: '#aaa', marginTop: -10, marginBottom: 14 }}>{t.photoLimit}</p>
                    <div className="profile-photo-grid">
                      {profilePhotos.map(p => (
                        <div key={p.id} className="profile-photo-tile">
                          <img src={cldOptimize(p.url, { width: 400 })} alt="" />
                          <button type="button" className="profile-photo-remove" aria-label={lang === 'hy' ? 'Ջնջել նկարը' : 'Delete photo'} onClick={() => confirmGalleryDelete(p.id)}>×</button>
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

                  <div className="profile-card">
                    <p className="profile-card-title">{lang === 'hy' ? 'Ծանուցումներ' : 'Notifications'}</p>
                    <p style={{ fontSize: 12, color: '#aaa', marginTop: -10, marginBottom: 14 }}>
                      {lang === 'hy' ? 'Ընտրեք, թե ինչի մասին եք ուզում ստանալ ծանուցում, և ինչպես:' : 'Choose what you get notified about, and how.'}
                    </p>
                    {!notifPrefs ? (
                      <p style={{ fontSize: 12.5, color: '#aaa' }}>{lang === 'hy' ? 'Բեռնվում է…' : 'Loading…'}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 8, fontSize: 11, color: '#aaa', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span />
                          <span style={{ textAlign: 'center' }}>{lang === 'hy' ? 'Հավելված' : 'In-app'}</span>
                          <span style={{ textAlign: 'center' }}>{lang === 'hy' ? 'Push' : 'Push'}</span>
                        </div>
                        {NOTIF_TYPES.map(nt => (
                          <div key={nt.key} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13.5, color: 'var(--deep)' }}>{lang === 'hy' ? nt.hy : nt.en}</span>
                            <span style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={notifPrefs[nt.key]?.in_app ?? true} onChange={() => toggleNotifPref(nt.key, 'in_app')} />
                            </span>
                            <span style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={notifPrefs[nt.key]?.push ?? true} onChange={() => toggleNotifPref(nt.key, 'push')} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="profile-card">
                    <p className="profile-card-title">{lang === 'hy' ? 'Իմ տվյալները' : 'My data'}</p>
                    <p style={{ fontSize: 12, color: '#aaa', marginTop: -10, marginBottom: 14 }}>
                      {lang === 'hy' ? 'Ներբեռնեք ձեր տվյալների պատճենը կամ ընդմիշտ ջնջեք ձեր հաշիվը:' : 'Download a copy of your data, or permanently delete your account.'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" onClick={handleExportData} disabled={exportingData}
                        style={{ background: 'none', border: '1px solid var(--sand)', borderRadius: 8, padding: '8px 16px', cursor: exportingData ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--deep)', opacity: exportingData ? 0.6 : 1 }}>
                        {exportingData ? (lang === 'hy' ? 'Ներբեռնվում է…' : 'Downloading…') : (lang === 'hy' ? 'Ներբեռնել իմ տվյալները' : 'Download my data')}
                      </button>
                      <button type="button" onClick={confirmDeleteAccount} disabled={deletingAccount}
                        style={{ background: 'none', border: '1px solid #e0a0a8', borderRadius: 8, padding: '8px 16px', cursor: deletingAccount ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: '#c0394b', opacity: deletingAccount ? 0.6 : 1 }}>
                        {deletingAccount ? (lang === 'hy' ? 'Ջնջվում է…' : 'Deleting…') : (lang === 'hy' ? 'Ջնջել իմ հաշիվը' : 'Delete my account')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LIBRARY ── */}
          {tab === 'library' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.library}</h2>
              {library.length === 0
                ? <p className="dash-empty">{t.noLibrary}</p>
                : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--taupe)', marginTop: -10, marginBottom: 20 }}>
                      {filteredLibrary.length !== library.length
                        ? (lang === 'hy'
                          ? `Ցուցադրված է ${filteredLibrary.length} ${library.length}-ից`
                          : `Showing ${filteredLibrary.length} of ${library.length}`)
                        : (lang === 'hy' ? `${library.length} նյութ` : `${library.length} item${library.length !== 1 ? 's' : ''}`)
                      }
                      {' · '}
                      {library.filter(i => i.type === 'recipe').length} {t.recipe.toLowerCase()}{library.filter(i => i.type === 'recipe').length !== 1 && lang !== 'hy' ? 's' : ''}
                      {' · '}
                      {library.filter(i => i.type === 'ebook').length} {t.ebook.toLowerCase()}{library.filter(i => i.type === 'ebook').length !== 1 && lang !== 'hy' ? 's' : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
                      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                        <Search size={15} color="#b89a8a" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          value={librarySearch}
                          onChange={e => setLibrarySearch(e.target.value)}
                          placeholder={lang === 'hy' ? 'Փնտրել գրադարանում…' : 'Search the library…'}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 999, border: '1px solid var(--sand)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { key: 'all', label: lang === 'hy' ? 'Բոլորը' : 'All' },
                          { key: 'recipe', label: t.recipe },
                          { key: 'ebook', label: t.ebook },
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => setLibraryType(f.key)}
                            style={{
                              padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              border: '1px solid ' + (libraryType === f.key ? 'var(--rose)' : 'var(--sand)'),
                              background: libraryType === f.key ? 'var(--rose)' : '#fff',
                              color: libraryType === f.key ? '#fff' : 'var(--taupe)',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filteredLibrary.length === 0 ? (
                      <p className="dash-empty">{lang === 'hy' ? 'Ոչինչ չի գտնվել' : 'No matches found'}</p>
                    ) : (
                  <div className="library-grid">
                    {filteredLibrary.map(item => (
                      <div key={item.id} className="library-card" style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedContent(item)}>
                        {item.is_unlocked ? (
                          <>
                            {item.cover_url && <img src={cldOptimize(item.cover_url, { width: 400 })} alt={item.title} className="library-cover" />}
                            <div className="library-type">{item.type === 'recipe' ? t.recipe : t.ebook}</div>
                            <div className="library-title">{lang === 'hy' && item.title_hy ? item.title_hy : item.title}</div>
                            {(lang === 'hy' && item.description_hy ? item.description_hy : item.description) && (
                              <p className="library-desc">{stripHtml(lang === 'hy' && item.description_hy ? item.description_hy : item.description)}</p>
                            )}
                            {item.file_url
                              ? <span className="plan-btn plan-btn-fill library-dl">{t.download}</span>
                              : null
                            }
                          </>
                        ) : (
                          <>
                            <div style={{ position: 'relative', minHeight: 150 }}>
                              {item.cover_url && <img src={cldOptimize(item.cover_url, { width: 400 })} alt={item.title} className="library-cover" style={{ filter: 'blur(2px)', opacity: 0.5 }} />}
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
                    )}
                  </>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                    {albums.map(album => (
                      <div key={album.id} className="home-clickable" style={{ width: 'min(100%, 320px)', background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--sand)', alignSelf: 'flex-start' }}
                        onClick={async () => {
                          if (openAlbum?.id === album.id) { setOpenAlbum(null); return }
                          const detail = await getAlbum(album.id)
                          setOpenAlbum(detail)
                        }}>
                        {album.cover_url
                          ? <img src={cldOptimize(album.cover_url, { width: 600 })} alt={album.title} style={{ width: '100%', display: 'block' }} />
                          : <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#f5ece8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={28} strokeWidth={1.5} color="#c9a8a8" /></div>
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
              <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
                {lang === 'hy' ? 'Ծանոթացեք Hasmik\'s Club-ի ակտիվ անդամների հետ' : "Meet the active members of Hasmik's Club"}
              </p>
              {!isActive ? (
                <p className="dash-empty">
                  {lang === 'hy'
                    ? 'Անդամների ցանկը հասանելի է միայն փաթեթ ունեցող անդամներին:'
                    : 'The member directory is available to members with a package only.'}
                </p>
              ) : <>
              {directory.length > 0 && (
                <div style={{ position: 'relative', maxWidth: 320, marginBottom: 24 }}>
                  <Search size={16} color="#bbb" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    value={directorySearch}
                    onChange={e => setDirectorySearch(e.target.value)}
                    placeholder={lang === 'hy' ? 'Որոնել անդամի' : 'Search members…'}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid var(--sand)', fontSize: 14 }}
                  />
                </div>
              )}
              {(directorySearchResults ?? directory).length === 0
                ? <p className="dash-empty">{directorySearchResults ? (lang === 'hy' ? 'Անդամ չի գտնվել' : 'No matching members') : t.noMembers}</p>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
                    {(directorySearchResults ?? directory).map(m => (
                      <div key={m.id}
                        onClick={() => setSelectedMember(m)}
                        style={{ textAlign: 'center', background: '#fff', borderRadius: 14, padding: '24px 16px', boxShadow: '0 2px 10px rgba(192,57,75,.07)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(192,57,75,.13)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 10px rgba(192,57,75,.07)' }}
                      >
                        {m.photo_url
                          ? <img src={cldOptimize(m.photo_url, { width: 150 })} alt={m.full_name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, border: '3px solid #f5c0c0' }} />
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
              </>}
            </div>
          )}

          {/* ── FORUM (disabled) ──
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
          ── END FORUM (disabled) ── */}

          </div>
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="dash-bottom-nav">
        {BOTTOM_NAV_TABS.map(k => {
          const Icon = TAB_ICONS[k]
          return (
            <button key={k} className={`dash-bottom-nav-item${tab === k ? ' active' : ''}`} onClick={() => changeTab(k)}>
              <span className="nav-icon"><Icon size={20} strokeWidth={1.75} /></span>
              <span className="dash-bottom-nav-label">{t[k]}</span>
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
          /* FORUM (disabled): re-enable when Forum comes back
          onOpenForumTopic={(topicId) => {
            setSelectedMember(null)
            setForumDeepLinkTopicId(topicId)
            changeTab('forum')
          }}
          */
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
              {(openAlbum.photos || []).map((photo, i) => (
                <div key={photo.id} className="home-clickable" style={{ borderRadius: 10 }} onClick={() => setLightboxIndex(i)}>
                  <img src={cldOptimize(photo.url, { width: 500 })} alt={photo.caption || ''} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                  {photo.caption && <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 }}>{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {openAlbum && (
        <Lightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          index={lightboxIndex}
          slides={(openAlbum.photos || []).map(photo => ({
            src: cldOptimize(photo.url, { width: 1600 }),
            title: photo.caption || undefined,
          }))}
          plugins={[Zoom, Counter, Captions, Thumbnails]}
          styles={{ container: { zIndex: 9998 } }}
        />
      )}

      {/* ── Post-registration package popup ── */}
      {showPackageModal && (
        <PostRegisterPackageModal
          lang={lang}
          user={user}
          onSkip={() => setShowPackageModal(false)}
          onSuccess={() => {
            setShowPackageModal(false)
            getMe().then(setUser).catch(() => {})
          }}
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
              <img src={cldOptimize(selectedContent.cover_url, { width: 800 })} alt={selectedContent.title}
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
                <div
                  className="rich-content"
                  style={{ color: 'var(--taupe)', fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(lang === 'hy' && selectedContent.description_hy ? selectedContent.description_hy : selectedContent.description) }}
                />
              )}

              {selectedContent.is_unlocked && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--taupe)' }}>
                      {lang === 'hy' ? 'Ինչքա՞ն եք առաջադիմել' : 'How far did you get?'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rose)' }}>{selectedContent.progress}%</span>
                  </div>
                  <div className="home-progress-track" style={{ marginBottom: 10 }}>
                    <div className="home-progress-fill" style={{ width: `${selectedContent.progress}%` }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 25, 50, 75, 100].map(p => (
                      <button
                        key={p}
                        onClick={() => handleSetProgress(selectedContent.id, p)}
                        className={`home-progress-step${selectedContent.progress === p ? ' active' : ''}`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedContent.is_unlocked && selectedContent.file_url ? (
                selectedContent.file_url.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setReaderOpen(true)}
                      className="plan-btn plan-btn-fill" style={{ flex: '1 1 160px' }}>
                      {lang === 'hy' ? 'Կարդալ' : 'Read'}
                    </button>
                    <a href={selectedContent.file_url} target="_blank" rel="noreferrer"
                      className="plan-btn plan-btn-outline"
                      style={{ flex: '1 1 160px', textAlign: 'center', textDecoration: 'none' }}>
                      {t.download}
                    </a>
                  </div>
                ) : (
                  <a href={selectedContent.file_url} target="_blank" rel="noreferrer"
                    className="plan-btn plan-btn-fill"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    {t.download}
                  </a>
                )
              ) : (
                <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Lock size={13} /> {t.lockedLib}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen PDF reader ── */}
      {selectedContent && readerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: '#221c16', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1A1714', flexShrink: 0 }}>
            <span style={{ color: '#F2E9DC', fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lang === 'hy' && selectedContent.title_hy ? selectedContent.title_hy : selectedContent.title}
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
              <a href={selectedContent.file_url} target="_blank" rel="noreferrer"
                style={{ color: '#F2E9DC', fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '6px 14px' }}>
                {t.download}
              </a>
              <button onClick={() => setReaderOpen(false)} aria-label="Close reader"
                style={{ background: 'none', border: 'none', color: '#F2E9DC', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <iframe
            src={selectedContent.file_url}
            title={selectedContent.title}
            style={{ flex: 1, width: '100%', border: 'none' }}
          />
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
          <button onClick={() => setVerifiedToast(false)} aria-label={lang === 'hy' ? 'Փակել' : 'Close'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#786050', fontSize: 18, lineHeight: 1, marginLeft: 4, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          lang={lang}
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel}
          danger={confirmDialog.danger !== false}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}
