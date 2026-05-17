import client from './client'

export const getMe = () => client.get('/members/me').then((r) => r.data)

export const updateMe = (data) => client.patch('/members/me', data).then((r) => r.data)

export const getMemberDirectory = () => client.get('/members/directory').then(r => r.data)
export const getGallery = () => client.get('/gallery').then(r => r.data)
export const getAlbum = (id) => client.get(`/gallery/${id}`).then(r => r.data)

export const uploadPhoto = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/members/me/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}
