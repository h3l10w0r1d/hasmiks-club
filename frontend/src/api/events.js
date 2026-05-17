import client from './client'

export const getEvents = () => client.get('/events/').then((r) => r.data)
export const getPublicEvents = () => client.get('/events/public').then((r) => r.data)

export const rsvp = (eventId) => client.post(`/events/${eventId}/rsvp`).then((r) => r.data)
export const cancelRsvp = (eventId) => client.delete(`/events/${eventId}/rsvp`)

export const joinWaitlist = (eventId) => client.post(`/events/${eventId}/waitlist`).then((r) => r.data)
export const leaveWaitlist = (eventId) => client.delete(`/events/${eventId}/waitlist`)
export const getWaitlistPosition = (eventId) => client.get(`/events/${eventId}/waitlist/position`).then((r) => r.data)
