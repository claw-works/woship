package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/provider"
)

// TicketUpdater is the minimal interface needed to update ticket status.
type TicketUpdater interface {
	UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error
}

// DeploymentUpdater is the minimal interface needed to update deployment status.
type DeploymentUpdater interface {
	UpdateStatus(id string, status model.DeploymentStatus, logs string) error
}

// DockerDeployJob executes a Docker deployment for an approved ticket.
type DockerDeployJob struct {
	Ticket     *model.Ticket
	Deployment *model.Deployment
	Provider   provider.CloudProvider
	TicketRepo TicketUpdater
	DeployRepo DeploymentUpdater
}

// Execute runs the deployment and sends log lines to logCh, closing it when done.
func (j *DockerDeployJob) Execute(ctx context.Context, logCh chan<- string) error {
	defer close(logCh)

	send := func(msg string) {
		select {
		case logCh <- msg:
		default:
		}
	}

	send("🚀 Starting deployment...")

	var payload model.DockerDeployPayload
	if err := json.Unmarshal([]byte(j.Ticket.Payload), &payload); err != nil {
		send(fmt.Sprintf("❌ Failed to parse payload: %v", err))
		j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil) //nolint:errcheck
		return err
	}

	// Mark ticket as deploying
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDeploying, nil, nil) //nolint:errcheck

	spec := provider.AppSpec{
		Name:      j.Deployment.AppName,
		Namespace: j.Deployment.Namespace,
		Image:     payload.Image,
		Port:      payload.Port,
		Replicas:  payload.Replicas,
		Domain:    payload.Domain,
		Env:       payload.Env,
		CPU:       payload.Resources.CPU,
		Memory:    payload.Resources.Memory,
	}

	send(fmt.Sprintf("⚙️  Deploying image %s to namespace %s...", spec.Image, spec.Namespace))

	if err := j.Provider.DeployApp(spec); err != nil {
		errMsg := fmt.Sprintf("❌ Failed: %v", err)
		send(errMsg)
		j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil)    //nolint:errcheck
		j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, errMsg)  //nolint:errcheck
		return err
	}

	if payload.Domain != "" {
		send(fmt.Sprintf("🌐 Binding domain %s...", payload.Domain))
		if err := j.Provider.BindDomain(payload.Domain, ""); err != nil {
			send(fmt.Sprintf("⚠️  Domain binding failed (non-fatal): %v", err))
		}
	}

	send("✅ Done")
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDone, nil, nil)         //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployRunning, "✅ Done") //nolint:errcheck
	return nil
}
