import client from './client'

export const getTopics    = ({ category, sort = 'latest', q } = {}) =>
  client.get('/forum', { params: {
    ...(category && category !== 'all' ? { category } : {}),
    ...(sort ? { sort } : {}),
    ...(q ? { q } : {}),
  } }).then(r => r.data)

export const createTopic  = (data)          => client.post('/forum', data).then(r => r.data)
export const getTopic     = (id)            => client.get(`/forum/${id}`).then(r => r.data)
export const createPost   = (topicId, data) => client.post(`/forum/${topicId}/posts`, data).then(r => r.data)
export const deleteTopic  = (id)            => client.delete(`/forum/${id}`)
export const deletePost   = (id)            => client.delete(`/forum/posts/${id}`)
export const pinTopic     = (id)            => client.patch(`/forum/${id}/pin`)

// emoji reactions — targetType is 'topic' | 'post'; returns the target's reaction summary
export const react        = (targetType, targetId, emoji) =>
  client.post(`/forum/${targetType}/${targetId}/react`, { emoji }).then(r => r.data)

// attachments
export const uploadForumImage = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post('/forum/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// Giphy (proxied through backend to keep the API key server-side)
export const searchGifs   = (q)  => client.get('/forum/gifs/search', { params: { q } }).then(r => r.data.gifs)
export const trendingGifs = ()   => client.get('/forum/gifs/trending').then(r => r.data.gifs)
