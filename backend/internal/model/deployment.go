package model

import "time"

// DeploymentStatus represents the lifecycle state of a deployment.
type DeploymentStatus string

const (
	DeployPending DeploymentStatus = "pending"
	DeployRunning DeploymentStatus = "running"
	DeployStopped DeploymentStatus = "stopped"
	DeployFailed  DeploymentStatus = "failed"
)

// Deployment records a cloud deployment triggered by a ticket.
type Deployment struct {
	ID         string           `db:"id" json:"id"`
	TicketID   string           `db:"ticket_id" json:"ticket_id"`
	ProviderID string           `db:"provider_id" json:"provider_id"`
	Namespace  string           `db:"namespace" json:"namespace"`
	AppName    string           `db:"app_name" json:"app_name"`
	Image      string           `db:"image" json:"image"`
	Domain     *string          `db:"domain" json:"domain,omitempty"`
	Status     DeploymentStatus `db:"status" json:"status"`
	Logs       *string          `db:"logs" json:"logs,omitempty"`
	CreatedAt  time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time        `db:"updated_at" json:"updated_at"`
}
