import client from './client'

export interface Provider {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateProviderPayload {
  name: string
  type: string
  config: Record<string, unknown>
}

export interface UpdateProviderPayload {
  name?: string
  config?: Record<string, unknown>
  enabled?: boolean
}

export const listProviders = () =>
  client.get<Provider[]>('/api/providers').then((r) => r.data)

export const createProvider = (data: CreateProviderPayload) =>
  client.post<Provider>('/api/providers', data).then((r) => r.data)

export const updateProvider = (id: string, data: UpdateProviderPayload) =>
  client.put<Provider>(`/api/providers/${id}`, data).then((r) => r.data)

export const deleteProvider = (id: string) =>
  client.delete(`/api/providers/${id}`)

export const testProvider = (id: string) =>
  client.get<{ ok: boolean }>(`/api/providers/${id}/test`).then((r) => r.data)
