import axios, { AxiosError } from 'axios'
import { toast } from '@/hooks/use-toast'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Extract a human-readable message from an Axios error.
 * Prefers the backend's { message } field, then the axios message.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as AxiosError<{ message?: string; error?: string }>
  if (err?.response?.data?.message) return err.response.data.message
  if (err?.response?.data?.error) return err.response.data.error
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your internet or that the backend is running.'
  if (err?.message) return err.message
  return fallback
}

// Handle errors globally: surface unexpected ones on the UI so nothing fails silently
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status
    const backendMessage = error.response?.data?.message
    const onClient = typeof window !== 'undefined'

    // 401: token expired/invalid -> redirect to login (except on the login page)
    if (status === 401) {
      if (onClient && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('userRole')
        localStorage.removeItem('userId')
        localStorage.removeItem('userName')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // 400/403/404/422 are "expected" — pages show their own specific messages.
    // Everything else (network errors, 429, 5xx) is unexpected: log it AND show a toast
    // so the user always sees that something failed, even if the page forgot to handle it.
    const isExpectedError = [400, 403, 404, 422].includes(status as number)
    if (!isExpectedError) {
      console.error(`❌ API Error [${status || 'NETWORK'}]: ${error.message}`)

      if (onClient) {
        let title = 'Something went wrong'
        let description = backendMessage || 'Please try again.'

        if (!status) {
          title = 'Network error'
          description = 'Cannot reach the server. Check your internet or that the backend is running.'
        } else if (status === 429) {
          title = 'Too many requests'
          description = backendMessage || 'Please slow down and try again in a moment.'
        } else if (status >= 500) {
          title = 'Server error'
          description = backendMessage || 'An unexpected error occurred on the server.'
        }

        toast({ title, description, variant: 'destructive' })
      }
    }

    return Promise.reject(error)
  }
)

export default api
