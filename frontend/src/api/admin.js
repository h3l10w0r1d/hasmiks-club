import client from './client'

// members
export const adminGetMembers        = ()           => client.get('/admin/members').then(r => r.data)
export const adminUpdateMember      = (id, data)   => client.patch(`/admin/members/${id}`, data).then(r => r.data)
export const adminDeleteMember      = (id)         => client.delete(`/admin/members/${id}`)
export const adminSendTelegramInvite = (id)        => client.post(`/admin/members/${id}/telegram-invite`).then(r => r.data)

// events
export const adminGetEvents         = ()           => client.get('/admin/events').then(r => r.data)
export const adminGetEventAttendees = (id)         => client.get(`/admin/events/${id}/attendees`).then(r => r.data)
export const adminCreateEvent       = (data)       => client.post('/admin/events', data).then(r => r.data)
export const adminUpdateEvent       = (id, data)   => client.patch(`/admin/events/${id}`, data).then(r => r.data)
export const adminDeleteEvent       = (id)         => client.delete(`/admin/events/${id}`)
export const adminToggleCheckin     = (evId, uid)  => client.post(`/admin/events/${evId}/checkin/${uid}`).then(r => r.data)

// content
export const adminGetContent        = ()           => client.get('/admin/content').then(r => r.data)
export const adminCreateContent     = (data)       => client.post('/admin/content', data).then(r => r.data)
export const adminUpdateContent     = (id, data)   => client.patch(`/admin/content/${id}`, data).then(r => r.data)
export const adminDeleteContent     = (id)         => client.delete(`/admin/content/${id}`)
export const adminUnlockContent     = (cid, uid)   => client.post(`/admin/content/${cid}/unlock/${uid}`).then(r => r.data)
export const adminUnlockContentForAll = (cid)      => client.post(`/admin/content/${cid}/unlock-all`).then(r => r.data)

// image upload
export const adminUploadImage = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/admin/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// analytics & stats
export const adminGetStats     = ()     => client.get('/admin/stats').then(r => r.data)
export const adminGetAnalytics = ()     => client.get('/admin/analytics').then(r => r.data)

// broadcast
export const adminBroadcast    = (data) => client.post('/admin/broadcast', data).then(r => r.data)

// csv export
export const adminExportCsv    = ()     => client.get('/admin/members/export', { responseType: 'blob' }).then(r => r.data)

// audit log
export const adminGetAuditLog  = ()     => client.get('/admin/audit-log').then(r => r.data)
