import client from './client'

export const getMe = () => client.get('/members/me').then((r) => r.data)

export const updateMe = (data) => client.patch('/members/me', data).then((r) => r.data)
