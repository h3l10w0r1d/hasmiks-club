import client from './client'

export const getVapidPublicKey = () => client.get('/push/vapid-public-key').then(r => r.data.key)
export const subscribePush = (subscription) => client.post('/push/subscribe', subscription.toJSON())
export const unsubscribePush = (endpoint) => client.post('/push/unsubscribe', { endpoint })
