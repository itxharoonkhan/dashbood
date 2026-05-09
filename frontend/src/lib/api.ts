import axios from 'axios'

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

// Handle 401 and 403 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const responseData = error.response?.data

    // Log detailed error info for debugging
    const errorMsg = responseData?.message || error.message || 'Unknown error'
    const isExpectedError = [400, 401, 403, 404, 422].includes(status)
    
    if (isExpectedError) {
      console.warn(`⚠️ API Warning [${status}]: ${errorMsg}`)
    } else {
      console.error(`❌ API Error [${status || 'NETWORK'}]: ${errorMsg}`, {
        url: error.config?.url,
        method: error.config?.method,
        requestData: error.config?.data,
        serverResponse: responseData,
        errorMessage: error.message
      })
    }

    // Only redirect on 401 (unauthorized/token expired)
    if (status === 401) {
      // Don't redirect on login page itself
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('userRole')
        localStorage.removeItem('userId')
        localStorage.removeItem('userName')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
