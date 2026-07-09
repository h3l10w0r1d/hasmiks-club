import client from './client'

export const getEvents = () => client.get('/events/').then((r) => r.data)
export const getPublicEvents = () => client.get('/events/public').then((r) => r.data)

export const rsvp = (eventId) => client.post(`/events/${eventId}/rsvp`).then((r) => r.data)
export const cancelRsvp = (eventId) => client.delete(`/events/${eventId}/rsvp`)

export const joinWaitlist = (eventId) => client.post(`/events/${eventId}/waitlist`).then((r) => r.data)
export const leaveWaitlist = (eventId) => client.delete(`/events/${eventId}/waitlist`)
export const getWaitlistPosition = (eventId) => client.get(`/events/${eventId}/waitlist/position`).then((r) => r.data)

export const selfCheckin = (eventId, token) => client.post(`/events/${eventId}/checkin-self`, null, { params: { token } })
export const getCheckinToken = (eventId) => client.get(`/admin/events/${eventId}/checkin-token`).then(r => r.data)

// one-time guest ticket (no account) — returns { url } to redirect to for payment
export const guestCheckout = (eventId, { full_name, email, lang_pref }) =>
  client.post(`/events/${eventId}/guest-checkout`, { full_name, email, lang_pref }).then((r) => r.data)
