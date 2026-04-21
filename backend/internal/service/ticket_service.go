package service

import (
	"encoding/json"
	"errors"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/worker"
)

var (
	// ErrInvalidPayload is returned when a ticket's payload fails validation.
	ErrInvalidPayload = errors.New("invalid payload")
	// ErrInvalidTransition is returned when a status change is not allowed.
	ErrInvalidTransition = errors.New("invalid status transition")
	// ErrForbidden is returned when the caller lacks required permissions.
	ErrForbidden = errors.New("forbidden")
)

// TicketRepository defines the persistence interface needed by TicketService.
type TicketRepository interface {
	Create(t *model.Ticket) error
	GetByID(id string) (*model.Ticket, error)
	List(createdBy string, status string) ([]model.Ticket, error)
	UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error
}

// DeploymentRepository defines the persistence interface for deployments.
type DeploymentRepository interface {
	Create(d *model.Deployment) error
	GetByID(id string) (*model.Deployment, error)
	GetByTicketID(ticketID string) ([]model.Deployment, error)
	List() ([]model.Deployment, error)
	UpdateStatus(id string, status model.DeploymentStatus, logs string) error
}

// JobEnqueuer can enqueue deployment jobs.
type JobEnqueuer interface {
	Enqueue(ticketID string, job worker.Job)
}

// JobFactory creates a worker.Job from a ticket and deployment.
type JobFactory func(ticket *model.Ticket, deployment *model.Deployment, providerID string) (worker.Job, error)

// TicketService implements the ticket lifecycle business rules.
type TicketService struct {
	ticketRepo TicketRepository
	deployRepo DeploymentRepository
	worker     JobEnqueuer
	jobFactory JobFactory
}

// NewTicketService creates a TicketService. jobFactory may be nil if approve is not used.
func NewTicketService(
	ticketRepo TicketRepository,
	deployRepo DeploymentRepository,
	w JobEnqueuer,
	jf JobFactory,
) *TicketService {
	return &TicketService{
		ticketRepo: ticketRepo,
		deployRepo: deployRepo,
		worker:     w,
		jobFactory: jf,
	}
}

// Create validates and persists a new draft ticket.
func (s *TicketService) Create(createdBy, title, ticketType string, payload json.RawMessage) (*model.Ticket, error) {
	if err := validatePayload(ticketType, payload); err != nil {
		return nil, ErrInvalidPayload
	}
	t := &model.Ticket{
		Type:      ticketType,
		Title:     title,
		Status:    model.TicketDraft,
		Payload:   model.RawJSON(payload),
		CreatedBy: createdBy,
	}
	if err := s.ticketRepo.Create(t); err != nil {
		return nil, err
	}
	return t, nil
}

// Submit transitions a draft ticket to pending.
func (s *TicketService) Submit(ticketID, userID string) error {
	t, err := s.ticketRepo.GetByID(ticketID)
	if err != nil {
		return err
	}
	if t.CreatedBy != userID {
		return ErrForbidden
	}
	if t.Status != model.TicketDraft {
		return ErrInvalidTransition
	}
	return s.ticketRepo.UpdateStatus(ticketID, model.TicketPending, nil, nil)
}

// Approve transitions a pending ticket to approved and enqueues the deployment job.
func (s *TicketService) Approve(ticketID, reviewerID string, reviewerRole model.Role) error {
	if reviewerRole != model.RoleApprover && reviewerRole != model.RoleAdmin {
		return ErrForbidden
	}
	t, err := s.ticketRepo.GetByID(ticketID)
	if err != nil {
		return err
	}
	if t.Status != model.TicketPending {
		return ErrInvalidTransition
	}
	if err := s.ticketRepo.UpdateStatus(ticketID, model.TicketApproved, &reviewerID, nil); err != nil {
		return err
	}

	// Build and enqueue the deployment job if factory is provided
	if s.worker != nil && s.jobFactory != nil {
		d := buildDeployment(t)
		if d != nil {
			if s.deployRepo != nil {
				_ = s.deployRepo.Create(d)
			}
			job, err := s.jobFactory(t, d, d.ProviderID)
			if err == nil {
				s.worker.Enqueue(ticketID, job)
			}
		}
	}
	return nil
}

// Reject transitions a pending ticket to rejected with a reason.
func (s *TicketService) Reject(ticketID, reviewerID, reason string, reviewerRole model.Role) error {
	if reviewerRole != model.RoleApprover && reviewerRole != model.RoleAdmin {
		return ErrForbidden
	}
	t, err := s.ticketRepo.GetByID(ticketID)
	if err != nil {
		return err
	}
	if t.Status != model.TicketPending {
		return ErrInvalidTransition
	}
	return s.ticketRepo.UpdateStatus(ticketID, model.TicketRejected, &reviewerID, &reason)
}

// GetByID returns a single ticket.
func (s *TicketService) GetByID(id string) (*model.Ticket, error) {
	return s.ticketRepo.GetByID(id)
}

// List returns tickets with optional filters.
func (s *TicketService) List(createdBy, status string) ([]model.Ticket, error) {
	return s.ticketRepo.List(createdBy, status)
}

// validatePayload checks that a payload matches the rules for the ticket type.
func validatePayload(ticketType string, raw json.RawMessage) error {
	switch ticketType {
	case "docker_deploy":
		var p model.DockerDeployPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return err
		}
		if p.Image == "" {
			return errors.New("image is required")
		}
		if p.ProviderID == "" {
			return errors.New("provider_id is required")
		}
		return nil
	case "db_request":
		var p model.DbRequestPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return err
		}
		if p.DbType == "" {
			return errors.New("db_type is required")
		}
		if p.InstanceName == "" {
			return errors.New("instance_name is required")
		}
		if p.ProviderID == "" {
			return errors.New("provider_id is required")
		}
		return nil
	case "dev_project":
		var p model.DevProjectPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return err
		}
		if p.ProjectName == "" {
			return errors.New("project_name is required")
		}
		if p.Stack == "" {
			return errors.New("stack is required")
		}
		return nil
	default:
		return errors.New("unknown ticket type: " + ticketType)
	}
}

// buildDeployment creates a Deployment record based on ticket type.
func buildDeployment(t *model.Ticket) *model.Deployment {
	d := &model.Deployment{
		TicketID:  t.ID,
		Namespace: "woship",
		AppName:   sanitizeName(t.Title, t.ID),
		Status:    model.DeployPending,
	}

	switch t.Type {
	case "docker_deploy":
		var p model.DockerDeployPayload
		if err := json.Unmarshal([]byte(t.Payload), &p); err != nil {
			return nil
		}
		d.ProviderID = p.ProviderID
		d.Image = p.Image
		if p.Domain != "" {
			d.Domain = &p.Domain
		}
	case "db_request":
		var p model.DbRequestPayload
		if err := json.Unmarshal([]byte(t.Payload), &p); err != nil {
			return nil
		}
		d.ProviderID = p.ProviderID
		d.Image = p.DbType + ":" + p.Version
		d.AppName = p.InstanceName
	case "dev_project":
		var p model.DevProjectPayload
		if err := json.Unmarshal([]byte(t.Payload), &p); err != nil {
			return nil
		}
		d.ProviderID = ""
		d.Image = p.Stack
		d.AppName = sanitizeName(p.ProjectName, t.ID)
	default:
		return nil
	}
	return d
}

// sanitizeName converts a title to a k8s-safe app name, appending a short ID suffix for uniqueness.
func sanitizeName(title, id string) string {
	out := make([]byte, 0, len(title))
	for i := 0; i < len(title) && i < 40; i++ {
		c := title[i]
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			out = append(out, c)
		} else if c >= 'A' && c <= 'Z' {
			out = append(out, c+32)
		} else if c == '-' || c == '.' {
			out = append(out, c)
		} else {
			if len(out) > 0 && out[len(out)-1] != '-' {
				out = append(out, '-')
			}
		}
	}
	s := string(out)
	for len(s) > 0 && s[0] == '-' {
		s = s[1:]
	}
	for len(s) > 0 && s[len(s)-1] == '-' {
		s = s[:len(s)-1]
	}

	suffix := id
	if len(suffix) > 8 {
		suffix = suffix[:8]
	}
	if s == "" {
		return "app-" + suffix
	}
	return s + "-" + suffix
}
