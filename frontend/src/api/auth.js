import client from './client'

export const register = (data) =>
  client.post('/auth/register', data).then((r) => r.data)

export const login = (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  return client.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).then((r) => r.data)
}

export const refreshToken = () => client.post('/auth/refresh').then((r) => r.data)

export const googleSignIn = (credential, referralCode) =>
  client.post('/auth/google', { credential, referral_code: referralCode || null }).then((r) => r.data)

export const telegramSignIn = (telegramUser, referralCode) =>
  client.post('/auth/telegram', { ...telegramUser, referral_code: referralCode || null }).then((r) => r.data)

export const forgotPassword = (email) =>
  client.post('/auth/forgot-password', { email }).then((r) => r.data)

export const resetPassword = (token, new_password) =>
  client.post('/auth/reset-password', { token, new_password }).then((r) => r.data)
