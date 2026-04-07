import client from './client'

export interface DockerDeployPayload {
  image: string
  port: number
  domain: string
  replicas: number
  env?: Record<string, string>
  resources: { cpu: string; memory: string }
  provider_id: string
}

export type TicketStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deploying'
  | 'done'
  | 'failed'

export interface Ticket {
  id: string
  type: string
  title: string
  status: TicketStatus
  payload: DockerDeployPayload
  created_by: string
  reviewed_by?: string
  reject_reason?: string
  created_at: string
  updated_at: string
}

export interface CreateTicketPayload {
  type: string
  title: string
  payload: DockerDeployPayload
}

export const createTicket = (data: CreateTicketPayload) =>
  client.post<Ticket>('/api/tickets', data).then((r) => r.data)

export const listTickets = (params?: { status?: string; created_by?: string }) =>
  client.get<Ticket[]>('/api/tickets', { params }).then((r) => r.data)

export const getTicket = (id: string) =>
  client.get<Ticket>(`/api/tickets/${id}`).then((r) => r.data)

export const submitTicket = (id: string) =>
  client.put<Ticket>(`/api/tickets/${id}/submit`).then((r) => r.data)

export const approveTicket = (id: string) =>
  client.put<Ticket>(`/api/tickets/${id}/approve`).then((r) => r.data)

export const rejectTicket = (id: string, reason: string) =>
  client.put<Ticket>(`/api/tickets/${id}/reject`, { reason }).then((r) => r.data)
