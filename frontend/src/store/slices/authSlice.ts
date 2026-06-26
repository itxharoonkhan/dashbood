import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string
  name: string
  role: 'admin' | 'cashier' | 'superadmin'
  permissions: string[]
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload
      state.isLoading = false
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },
    clearUser(state) {
      state.user = null
      state.isLoading = false
    },
  },
})

export const { setUser, setLoading, clearUser } = authSlice.actions
export default authSlice.reducer
