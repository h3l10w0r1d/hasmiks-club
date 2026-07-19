import client from './client'

export const getMe = () => client.get('/members/me').then((r) => r.data)

export const updateMe = (data) => client.patch('/members/me', data).then((r) => r.data)

export const exportMyData = () => client.get('/members/me/export', { responseType: 'blob' }).then((r) => r.data)
export const deleteMyAccount = () => client.delete('/members/me').then((r) => r.data)

export const getMemberDirectory = (q) => client.get('/members/directory', { params: q ? { q } : {} }).then(r => r.data)
export const getGallery = () => client.get('/gallery').then(r => r.data)
export const getAlbum = (id) => client.get(`/gallery/${id}`).then(r => r.data)

export const uploadPhoto = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/members/me/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

// personal photo gallery (up to 6, separate from the main avatar)
export const addProfilePhoto = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/members/me/photos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}
export const deleteProfilePhoto = (id) => client.delete(`/members/me/photos/${id}`).then(r => r.data)

// full public profile (bio, contact links, photos, activity) for the directory modal
export const getMemberProfile = (id) => client.get(`/members/${id}`).then(r => r.data)

// attach/detach a Telegram account to the currently-logged-in member
export const linkTelegram = (telegramUser) => client.post('/members/me/telegram', telegramUser).then(r => r.data)
export const unlinkTelegram = () => client.delete('/members/me/telegram').then(r => r.data)
