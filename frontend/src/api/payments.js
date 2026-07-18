import client from './client'

export const createCheckout = () =>
  client.post('/payments/create-checkout').then((r) => r.data)

export const cancelAutoRenew = () =>
  client.post('/payments/cancel-auto-renew').then((r) => r.data)

export const getPublicSettings = () =>
  client.get('/settings/public').then((r) => r.data)

// Public landing-page copy overrides set via the admin Site Editor.
export const getSiteContent = () =>
  client.get('/settings/site-content').then((r) => r.data)

// Auth-required, and only returns the private Telegram invite for members
// with an active subscription — see backend/app/routers/settings.py
export const getMemberSettings = () =>
  client.get('/settings/member').then((r) => r.data)
