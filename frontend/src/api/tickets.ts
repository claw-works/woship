import client from './client'

// --- Payload types ---

export interface DockerDeployPayload {
  image: string
  port: number
  domain: string
  replicas: number
  env?: Record<string, string>
  resources: { cpu: string; memory: string }
  provider_id: string
}

export interface DbRequestPayload {
  db_type: 'postgresql' | 'mysql' | 'redis' | 'mongodb'
  instance_name: string
  version?: string
  storage_gb: number
  high_availability: boolean
  provider_id: string
}

export interface DevProjectPayload {
  project_name: string
  description: string
  stack: 'go_react' | 'nextjs' | 'vue_go' | 'python_react' | 'rust_react'
}

export type TicketPayload = DockerDeployPayload | DbRequestPayload | DevProjectPayload

// --- Ticket ---

export type TicketStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deploying'
  | 'done'
  | 'failed'

export type TicketType = 'docker_deploy' | 'db_request' | 'dev_project'

export interface Ticket {
  id: string
  type: TicketType
  title: string
  status: TicketStatus
  payload: TicketPayload
  created_by: string
  reviewed_by?: string
  reject_reason?: string
  created_at: string
  updated_at: string
}

export interface CreateTicketPayload {
  type: TicketType
  title: string
  payload: TicketPayload
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
