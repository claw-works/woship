package model

import "time"

type DriftStatus string

const (
	DriftDetected DriftStatus = "detected"
	DriftResolved DriftStatus = "resolved"
)

type DriftRecord struct {
	ID           string      `db:"id" json:"id"`
	DeploymentID string      `db:"deployment_id" json:"deployment_id"`
	PlanOutput   string      `db:"plan_output" json:"plan_output"`
	Status       DriftStatus `db:"status" json:"status"`
	ResolvedAt   *time.Time  `db:"resolved_at" json:"resolved_at,omitempty"`
	CreatedAt    time.Time   `db:"created_at" json:"created_at"`
}
