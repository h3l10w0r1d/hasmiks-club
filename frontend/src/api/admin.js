import client from './client'

// members
export const adminGetMembers = () => client.get('/admin/members').then(r => r.data)
export const adminUpdateMember = (id, data) => client.patch(`/admin/members/${id}`, data).then(r => r.data)
export const adminDeleteMember = (id) => client.delete(`/admin/members/${id}`)

// events
export const adminGetEvents = () => client.get('/admin/events').then(r => r.data)
export const adminGetEventAttendees = (id) => client.get(`/admin/events/${id}/attendees`).then(r => r.data)
export const adminCreateEvent = (data) => client.post('/admin/events', data).then(r => r.data)
export const adminUpdateEvent = (id, data) => client.patch(`/admin/events/${id}`, data).then(r => r.data)
export const adminDeleteEvent = (id) => client.delete(`/admin/events/${id}`)

// content
export const adminGetContent = () => client.get('/admin/content').then(r => r.data)
export const adminCreateContent = (data) => client.post('/admin/content', data).then(r => r.data)
export const adminUpdateContent = (id, data) => client.patch(`/admin/content/${id}`, data).then(r => r.data)
export const adminDeleteContent = (id) => client.delete(`/admin/content/${id}`)
export const adminUnlockContent = (contentId, userId) =>
  client.post(`/admin/content/${contentId}/unlock/${userId}`).then(r => r.data)
export const adminUnlockContentForAll = (contentId) =>
  client.post(`/admin/content/${contentId}/unlock-all`).then(r => r.data)

// stats (simple)
export const adminGetStats = () => client.get('/admin/stats').then(r => r.data)

// deep analytics
export const adminGetAnalytics = () => client.get('/admin/analytics').then(r => r.data)
