import client from './client'

export const getTopics    = (category) => client.get('/forum', { params: category ? { category } : {} }).then(r => r.data)
export const createTopic  = (data)     => client.post('/forum', data).then(r => r.data)
export const getTopic     = (id)       => client.get(`/forum/${id}`).then(r => r.data)
export const createPost   = (topicId, body) => client.post(`/forum/${topicId}/posts`, { body }).then(r => r.data)
export const deleteTopic  = (id)       => client.delete(`/forum/${id}`)
export const deletePost   = (id)       => client.delete(`/forum/posts/${id}`)
export const pinTopic     = (id)       => client.patch(`/forum/${id}/pin`)
