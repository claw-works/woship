import client from './client'

export interface User {
  id: string
  email: string
  name: string
  role: string
  created_at: string
  updated_at: string
}

export interface RegisterPayload {
  email: string
  password: string
  name: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
}

export const register = (data: RegisterPayload) =>
  client.post<User>('/api/auth/register', data).then((r) => r.data)

export const login = (data: LoginPayload) =>
  client.post<LoginResponse>('/api/auth/login', data).then((r) => r.data)

export const me = () =>
  client.get<User>('/api/users/me').then((r) => r.data)
