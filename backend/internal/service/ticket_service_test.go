package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/service"
	"github.com/claw-works/woship/internal/worker"
	"github.com/stretchr/testify/require"
)

// ---- mock ticket repository ----

type mockTicketRepo struct {
	tickets map[string]*model.Ticket
	nextID  int
}

func newMockTicketRepo() *mockTicketRepo {
	return &mockTicketRepo{tickets: make(map[string]*model.Ticket)}
}

func (m *mockTicketRepo) Create(t *model.Ticket) error {
	m.nextID++
	t.ID = fmt.Sprintf("ticket-%d", m.nextID)
	cp := *t
	m.tickets[t.ID] = &cp
	return nil
}

func (m *mockTicketRepo) GetByID(id string) (*model.Ticket, error) {
	t, ok := m.tickets[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cp := *t
	return &cp, nil
}

func (m *mockTicketRepo) List(createdBy, status string) ([]model.Ticket, error) {
	var result []model.Ticket
	for _, t := range m.tickets {
		if createdBy != "" && t.CreatedBy != createdBy {
			continue
		}
		if status != "" && string(t.Status) != status {
			continue
		}
		result = append(result, *t)
	}
	return result, nil
}

func (m *mockTicketRepo) UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error {
	t, ok := m.tickets[id]
	if !ok {
		return errors.New("not found")
	}
	t.Status = status
	t.ReviewedBy = reviewerID
	t.RejectReason = rejectReason
	return nil
}

// ---- mock deployment repository ----

type mockDeployRepo struct {
	deployments map[string]*model.Deployment
	nextID      int
}

func newMockDeployRepo() *mockDeployRepo {
	return &mockDeployRepo{deployments: make(map[string]*model.Deployment)}
}

func (m *mockDeployRepo) Create(d *model.Deployment) error {
	m.nextID++
	d.ID = fmt.Sprintf("deploy-%d", m.nextID)
	cp := *d
	m.deployments[d.ID] = &cp
	return nil
}

func (m *mockDeployRepo) GetByID(id string) (*model.Deployment, error) {
	d, ok := m.deployments[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cp := *d
	return &cp, nil
}

func (m *mockDeployRepo) GetByTicketID(ticketID string) ([]model.Deployment, error) {
	return nil, nil
}

func (m *mockDeployRepo) List() ([]model.Deployment, error) {
	return nil, nil
}

func (m *mockDeployRepo) UpdateStatus(id string, status model.DeploymentStatus, logs string) error {
	return nil
}

func (m *mockDeployRepo) ExistsActive(namespace, appName string) (bool, error) {
	for _, d := range m.deployments {
		if d.Namespace == namespace && d.AppName == appName && d.Status != model.DeployStopped {
			return true, nil
		}
	}
	return false, nil
}

// ---- mock worker ----

type mockWorker struct {
	enqueued []string
}

func (w *mockWorker) Enqueue(ticketID string, _ worker.Job) {
	w.enqueued = append(w.enqueued, ticketID)
}

// ---- mock job for tests ----

type noopJob struct{}

func (j *noopJob) Execute(_ context.Context, logCh chan<- string) error {
	close(logCh)
	return nil
}

func noopJobFactory(_ *model.Ticket, _ *model.Deployment, _ string) (worker.Job, error) {
	return &noopJob{}, nil
}

// ---- helper ----

func validDockerPayload(providerID string) json.RawMessage {
	p := model.DockerDeployPayload{
		Image:      "nginx:latest",
		Port:       80,
		Domain:     "test.example.com",
		Replicas:   1,
		ProviderID: providerID,
		Resources:  model.ResourceSpec{CPU: "100m", Memory: "128Mi"},
	}
	b, _ := json.Marshal(p)
	return b
}

// ---- tests ----

func TestTicketService_Create_DockerDeploy(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, err := svc.Create("user-1", "Test Deploy", "docker_deploy", validDockerPayload("provider-1"))
	require.NoError(t, err)
	require.NotEmpty(t, ticket.ID)
	require.Equal(t, model.TicketDraft, ticket.Status)
}

func TestTicketService_Create_InvalidPayload_MissingImage(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	bad := json.RawMessage(`{"domain":"test.example.com","provider_id":"p1"}`)
	_, err := svc.Create("user-1", "Bad Ticket", "docker_deploy", bad)
	require.ErrorIs(t, err, service.ErrInvalidPayload)
}

func TestTicketService_Create_UnknownType(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	_, err := svc.Create("user-1", "Unknown", "unknown_type", json.RawMessage(`{}`))
	require.ErrorIs(t, err, service.ErrInvalidPayload)
}

func TestTicketService_Submit_ChangesDraftToPending(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	err := svc.Submit(ticket.ID, "user-1")
	require.NoError(t, err)

	updated, _ := svc.GetByID(ticket.ID)
	require.Equal(t, model.TicketPending, updated.Status)
}

func TestTicketService_Submit_AlreadyPending(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Submit(ticket.ID, "user-1")
	require.ErrorIs(t, err, service.ErrInvalidTransition)
}

func TestTicketService_Submit_WrongOwner(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	err := svc.Submit(ticket.ID, "user-2")
	require.ErrorIs(t, err, service.ErrForbidden)
}

func TestTicketService_Approve_ByApprover(t *testing.T) {
	repo := newMockTicketRepo()
	w := &mockWorker{}
	svc := service.NewTicketService(repo, newMockDeployRepo(), w, noopJobFactory)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Approve(ticket.ID, "approver-1", model.RoleApprover)
	require.NoError(t, err)

	updated, _ := svc.GetByID(ticket.ID)
	require.Equal(t, model.TicketApproved, updated.Status)
}

func TestTicketService_Approve_ByAdmin(t *testing.T) {
	repo := newMockTicketRepo()
	w := &mockWorker{}
	svc := service.NewTicketService(repo, newMockDeployRepo(), w, noopJobFactory)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Approve(ticket.ID, "admin-1", model.RoleAdmin)
	require.NoError(t, err)
}

func TestTicketService_Approve_ByUser_Forbidden(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Approve(ticket.ID, "user-2", model.RoleUser)
	require.ErrorIs(t, err, service.ErrForbidden)
}

func TestTicketService_Approve_NotPending(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	// Still draft, not submitted

	err := svc.Approve(ticket.ID, "approver-1", model.RoleApprover)
	require.ErrorIs(t, err, service.ErrInvalidTransition)
}

func TestTicketService_Reject_WithReason(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Reject(ticket.ID, "approver-1", "image not allowed", model.RoleApprover)
	require.NoError(t, err)

	updated, _ := svc.GetByID(ticket.ID)
	require.Equal(t, model.TicketRejected, updated.Status)
	require.NotNil(t, updated.RejectReason)
	require.Equal(t, "image not allowed", *updated.RejectReason)
}

func TestTicketService_Reject_ByUser_Forbidden(t *testing.T) {
	repo := newMockTicketRepo()
	svc := service.NewTicketService(repo, newMockDeployRepo(), nil, nil)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck

	err := svc.Reject(ticket.ID, "user-2", "nope", model.RoleUser)
	require.ErrorIs(t, err, service.ErrForbidden)
}

func TestTicketService_Approve_EnqueuesJob(t *testing.T) {
	repo := newMockTicketRepo()
	w := &mockWorker{}
	svc := service.NewTicketService(repo, newMockDeployRepo(), w, noopJobFactory)

	ticket, _ := svc.Create("user-1", "Test", "docker_deploy", validDockerPayload("p1"))
	svc.Submit(ticket.ID, "user-1") //nolint:errcheck
	svc.Approve(ticket.ID, "approver-1", model.RoleApprover) //nolint:errcheck

	require.Contains(t, w.enqueued, ticket.ID)
}
