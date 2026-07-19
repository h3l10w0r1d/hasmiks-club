import client from './client'

export const getNotifications = () => client.get('/notifications').then(r => r.data)
export const markRead = (id) => client.patch(`/notifications/${id}/read`)
export const markAllRead = () => client.patch('/notifications/read-all')

export const getNotificationPreferences = () => client.get('/notifications/preferences').then(r => r.data.preferences)
export const updateNotificationPreferences = (preferences) =>
  client.put('/notifications/preferences', { preferences }).then(r => r.data.preferences)
