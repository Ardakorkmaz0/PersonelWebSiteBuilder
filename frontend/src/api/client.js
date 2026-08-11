import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'

// 8001, not Django's 8000: that port is the default for every Django project on
// the machine, so whichever one starts first wins it and the others silently
// talk to a stranger's API. Overridable with VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api'

const client = axios.create({ baseURL })

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)

export default client
