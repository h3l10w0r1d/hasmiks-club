import client from './client'

export const createCheckout = () =>
  client.post('/payments/create-checkout').then((r) => r.data)

export const cancelAutoRenew = () =>
  client.post('/payments/cancel-auto-renew').then((r) => r.data)

export const getPublicSettings = () =>
  client.get('/settings/public').then((r) => r.data)
