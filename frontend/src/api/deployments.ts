import client from './client'

export interface Deployment {
  id: string
  ticket_id: string
  provider_id: string
  namespace: string
  app_name: string
  image: string
  domain?: string
  status: 'pending' | 'running' | 'destroying' | 'stopped' | 'failed'
  drift_status: 'clean' | 'drifted'
  created_at: string
  updated_at: string
}

export interface DriftRecord {
  id: string
  deployment_id: string
  plan_output: string
  status: 'detected' | 'resolved'
  resolved_at?: string
  created_at: string
}

export const listDeployments = () =>
  client.get<Deployment[]>('/api/deployments').then((r) => r.data)

export const deleteDeployment = (id: string) =>
  client.delete(`/api/deployments/${id}`)

export const listDriftRecords = () =>
  client.get<DriftRecord[]>('/api/drift').then((r) => r.data)

export const listDeploymentDrift = (id: string) =>
  client.get<DriftRecord[]>(`/api/deployments/${id}/drift`).then((r) => r.data)

export const remediateDeployment = (id: string) =>
  client.post(`/api/deployments/${id}/remediate`)

export const destroyDeployment = (id: string) =>
  client.post(`/api/deployments/${id}/destroy`)
