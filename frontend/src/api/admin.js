import client from './client'

// members
export const adminGetMembers          = ()           => client.get('/admin/members').then(r => r.data)
export const adminUpdateMember        = (id, data)   => client.patch(`/admin/members/${id}`, data).then(r => r.data)
export const adminDeleteMember        = (id)         => client.delete(`/admin/members/${id}`)
export const adminSendTelegramInvite  = (id)         => client.post(`/admin/members/${id}/telegram-invite`).then(r => r.data)

// applications
export const adminGetApplications     = ()           => client.get('/admin/applications').then(r => r.data)
export const adminApproveApplication  = (id)         => client.post(`/admin/applications/${id}/approve`).then(r => r.data)
export const adminDeclineApplication  = (id)         => client.post(`/admin/applications/${id}/decline`).then(r => r.data)

// referrals
export const adminGetReferrals        = ()           => client.get('/admin/referrals').then(r => r.data)

// events
export const adminGetEvents           = ()           => client.get('/admin/events').then(r => r.data)
export const adminGetEventAttendees   = (id)         => client.get(`/admin/events/${id}/attendees`).then(r => r.data)
export const adminCreateEvent         = (data)       => client.post('/admin/events', data).then(r => r.data)
export const adminUpdateEvent         = (id, data)   => client.patch(`/admin/events/${id}`, data).then(r => r.data)
export const adminDeleteEvent         = (id)         => client.delete(`/admin/events/${id}`)
export const adminToggleCheckin       = (evId, uid)  => client.post(`/admin/events/${evId}/checkin/${uid}`).then(r => r.data)
export const adminToggleGuestTicketCheckin = (evId, ticketId) => client.post(`/admin/events/${evId}/guest-tickets/${ticketId}/checkin`).then(r => r.data)

// content
export const adminGetContent          = ()           => client.get('/admin/content').then(r => r.data)
export const adminCreateContent       = (data)       => client.post('/admin/content', data).then(r => r.data)
export const adminUpdateContent       = (id, data)   => client.patch(`/admin/content/${id}`, data).then(r => r.data)
export const adminDeleteContent       = (id)         => client.delete(`/admin/content/${id}`)
export const adminUnlockContent       = (cid, uid)   => client.post(`/admin/content/${cid}/unlock/${uid}`).then(r => r.data)
export const adminUnlockContentForAll = (cid)        => client.post(`/admin/content/${cid}/unlock-all`).then(r => r.data)

// gallery
export const adminGetAlbums           = ()               => client.get('/admin/gallery').then(r => r.data)
export const adminGetAlbum            = (id)             => client.get(`/admin/gallery/${id}`).then(r => r.data)
export const adminCreateAlbum         = (data)           => client.post('/admin/gallery', data).then(r => r.data)
export const adminUpdateAlbum         = (id, data)       => client.patch(`/admin/gallery/${id}`, data).then(r => r.data)
export const adminDeleteAlbum         = (id)             => client.delete(`/admin/gallery/${id}`)
export const adminAddPhoto            = (albumId, data)  => client.post(`/admin/gallery/${albumId}/photos`, data).then(r => r.data)
export const adminUpdatePhoto         = (photoId, data)  => client.patch(`/admin/gallery/photos/${photoId}`, data).then(r => r.data)
export const adminDeletePhoto         = (photoId)        => client.delete(`/admin/gallery/photos/${photoId}`)
export const adminReorderPhotos       = (albumId, photoIds) => client.patch(`/admin/gallery/${albumId}/photos/reorder`, { photo_ids: photoIds })
export const adminUploadGalleryPhoto  = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/admin/gallery/upload-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}
export const adminAddPhotosBulk = (albumId, files) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  return client.post(`/admin/gallery/${albumId}/photos/bulk`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// image upload (for events/content forms)
export const adminUploadImage = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/admin/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// analytics & stats
export const adminGetStats            = ()     => client.get('/admin/stats').then(r => r.data)
export const adminGetAnalytics        = ()     => client.get('/admin/analytics').then(r => r.data)

// broadcast
export const adminBroadcast           = (data) => client.post('/admin/broadcast', data).then(r => r.data)

// csv export
export const adminExportCsv           = ()     => client.get('/admin/members/export', { responseType: 'blob' }).then(r => r.data)

// audit log
export const adminGetAuditLog         = ()     => client.get('/admin/audit-log').then(r => r.data)

// settings
export const adminGetSettings         = ()           => client.get('/admin/settings').then(r => r.data)
export const adminSaveSettings        = (data)       => client.put('/admin/settings', data).then(r => r.data)

// roles & permissions
export const adminGetRoles            = ()           => client.get('/admin/roles').then(r => r.data)
export const adminUpdateRole          = (userId, payload) => client.put(`/admin/roles/${userId}`, payload).then(r => r.data)
export const adminGetPermissionDefaults = ()         => client.get('/admin/permissions/defaults').then(r => r.data)

// payments (Ameriabank vPOS)
export const adminGetPayments         = ()           => client.get('/admin/payments').then(r => r.data)
export const adminRefreshPayment      = (id)         => client.post(`/admin/payments/${id}/refresh`).then(r => r.data)
export const adminRefundPayment       = (id, amount) => client.post(`/admin/payments/${id}/refund`, { amount }).then(r => r.data)
export const adminCancelPayment       = (id)         => client.post(`/admin/payments/${id}/cancel`).then(r => r.data)
export const adminGetPaymentLogs      = (id)         => client.get(`/admin/payments/${id}/logs`).then(r => r.data)

// one-time guest tickets
export const adminGetGuestTickets     = (params)     => client.get('/admin/guest-tickets', { params }).then(r => r.data)
export const adminGuestTicketCheckin  = (payload)    => client.post('/admin/guest-tickets/checkin', { payload }).then(r => r.data)
