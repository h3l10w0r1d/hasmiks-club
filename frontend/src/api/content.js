import client from './client'

export const getLibrary = () => client.get('/content/my/library').then((r) => r.data)

export const getAllContent = () => client.get('/content/').then((r) => r.data)

export const updateLibraryProgress = (contentId, progress) =>
  client.patch(`/content/${contentId}/progress`, { progress }).then((r) => r.data)
