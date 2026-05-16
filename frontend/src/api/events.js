import client from './client'

export const getEvents = () => client.get('/events/').then((r) => r.data)

export const rsvp = (eventId) => client.post(`/events/${eventId}/rsvp`).then((r) => r.data)

export const cancelRsvp = (eventId) => client.delete(`/events/${eventId}/rsvp`)
