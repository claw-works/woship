package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// TicketStatus represents the lifecycle state of a ticket.
type TicketStatus string

const (
	TicketDraft     TicketStatus = "draft"
	TicketPending   TicketStatus = "pending"
	TicketApproved  TicketStatus = "approved"
	TicketRejected  TicketStatus = "rejected"
	TicketDeploying TicketStatus = "deploying"
	TicketDone      TicketStatus = "done"
	TicketFailed    TicketStatus = "failed"
)

// RawJSON is a json.RawMessage that properly implements database driver interfaces.
type RawJSON json.RawMessage

func (r RawJSON) MarshalJSON() ([]byte, error) {
	if r == nil {
		return []byte("null"), nil
	}
	return json.RawMessage(r).MarshalJSON()
}

func (r *RawJSON) UnmarshalJSON(data []byte) error {
	if r == nil {
		return fmt.Errorf("RawJSON: UnmarshalJSON on nil pointer")
	}
	*r = append((*r)[0:0], data...)
	return nil
}

// Value implements driver.Valuer for database storage.
func (r RawJSON) Value() (driver.Value, error) {
	if len(r) == 0 {
		return "{}", nil
	}
	return string(r), nil
}

// Scan implements sql.Scanner for database retrieval.
func (r *RawJSON) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		*r = append((*r)[0:0], v...)
		return nil
	case string:
		*r = RawJSON(v)
		return nil
	case nil:
		*r = RawJSON("{}")
		return nil
	default:
		return fmt.Errorf("RawJSON: cannot scan type %T", src)
	}
}

// Ticket is the database model for a work ticket.
type Ticket struct {
	ID           string       `db:"id" json:"id"`
	Type         string       `db:"type" json:"type"`
	Title        string       `db:"title" json:"title"`
	Status       TicketStatus `db:"status" json:"status"`
	Payload      RawJSON      `db:"payload" json:"payload"`
	CreatedBy    string       `db:"created_by" json:"created_by"`
	ReviewedBy   *string      `db:"reviewed_by" json:"reviewed_by,omitempty"`
	RejectReason *string      `db:"reject_reason" json:"reject_reason,omitempty"`
	CreatedAt    time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time    `db:"updated_at" json:"updated_at"`
}

// DockerDeployPayload holds parameters for a docker deployment ticket.
type DockerDeployPayload struct {
	Image      string            `json:"image"`
	Port       int               `json:"port"`
	Domain     string            `json:"domain"`
	Namespace  string            `json:"namespace,omitempty"`
	Replicas   int               `json:"replicas"`
	Env        map[string]string `json:"env,omitempty"`
	Resources  ResourceSpec      `json:"resources"`
	ProviderID string            `json:"provider_id"`
}

// ResourceSpec specifies CPU and memory resource requests.
type ResourceSpec struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}

// DbRequestPayload holds parameters for a database request ticket.
type DbRequestPayload struct {
	DbType           string `json:"db_type"`
	InstanceName     string `json:"instance_name"`
	Version          string `json:"version"`
	StorageGB        int    `json:"storage_gb"`
	HighAvailability bool   `json:"high_availability"`
	ProviderID       string `json:"provider_id"`
}

// DevProjectPayload holds parameters for a new development project ticket.
type DevProjectPayload struct {
	ProjectName string `json:"project_name"`
	Description string `json:"description"`
	Stack       string `json:"stack"`
}
