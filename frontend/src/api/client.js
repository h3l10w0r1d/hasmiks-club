import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// TEMP DEV MOCK — remove before commit
client.interceptors.request.use((config) => {
  if (config.url === '/settings/public') {
    config.adapter = async () => ({
      data: {
        club_email: 'info@hasmiksclub.am',
        club_phone: '+374 10 28 55 98',
        club_location: 'Հյուսիսային պողոտա 1, Երևան 0001, Հայաստան',
        club_instagram: 'hasmiks.club',
      },
      status: 200, statusText: 'OK', headers: {}, config,
    })
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hc_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
