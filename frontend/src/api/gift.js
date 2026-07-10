import client from './client'

// gift purchase, 3 steps: start (emails a code to the giver) -> verify -> checkout (returns { url })
export const giftStart = (payload) =>
  client.post('/gift/start', payload).then((r) => r.data)
export const giftResendCode = (giftId) =>
  client.post(`/gift/${giftId}/resend-code`).then((r) => r.data)
export const giftVerify = (giftId, code) =>
  client.post(`/gift/${giftId}/verify`, { code }).then((r) => r.data)
export const giftCheckout = (giftId, lang_pref) =>
  client.post(`/gift/${giftId}/checkout`, { lang_pref }).then((r) => r.data)

// redemption (membership gifts only — event-ticket gifts are emailed directly, no claim step)
export const getGiftClaimInfo = (token) =>
  client.get(`/gift/claim/${token}`).then((r) => r.data)
export const claimGiftWithPassword = (token, password) =>
  client.post(`/gift/claim/${token}/password`, { password }).then((r) => r.data)
export const claimGiftApply = (token) =>
  client.post(`/gift/claim/${token}`).then((r) => r.data)
