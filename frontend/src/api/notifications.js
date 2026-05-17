import client from './client'

export const getNotifications = () => client.get('/notifications').then(r => r.data)
export const markRead = (id) => client.patch(`/notifications/${id}/read`)
export const markAllRead = () => client.patch('/notifications/read-all')
