import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Set right before a deliberate sign-out clears the token, so any request
// still in flight at that moment (dashboard/admin pages fire several on
// mount) doesn't have its resulting 401 force a hard redirect to /login
// over top of the sign-out flow's own navigate('/') — a genuinely expired
// session hit mid-browsing should still bounce to /login, just not this.
let justSignedOut = false
export function markSignedOut() {
  justSignedOut = true
  setTimeout(() => { justSignedOut = false }, 3000)
}

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hc_token')
      if (!justSignedOut) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
