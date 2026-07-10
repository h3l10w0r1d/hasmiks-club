import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/push'

// applicationServerKey must be a Uint8Array, but the VAPID public key comes
// from the backend as a base64url string.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushSubscriptionState() {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  const permission = Notification.permission
  // getRegistration() resolves immediately (undefined if no SW is active yet)
  // — unlike `.ready`, which hangs forever until a controlling SW exists, no
  // good for a passive status check that runs unconditionally on mount.
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return { supported: true, permission, subscribed: false }
  const existing = await registration.pushManager.getSubscription()
  return { supported: true, permission, subscribed: !!existing }
}

export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this browser')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { permission, subscribed: false }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const vapidKey = await getVapidPublicKey()
    if (!vapidKey) throw new Error('Push notifications are not configured on the server yet')
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }
  await subscribePush(subscription)
  return { permission, subscribed: true }
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await unsubscribePush(subscription.endpoint)
  await subscription.unsubscribe()
}
