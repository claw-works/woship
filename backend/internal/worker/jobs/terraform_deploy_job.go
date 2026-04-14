package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/terraform"
)

// TerraformDeployJob executes a Docker deployment via Terraform.
type TerraformDeployJob struct {
	Ticket        *model.Ticket
	Deployment    *model.Deployment
	TicketRepo    TicketUpdater
	DeployRepo    DeploymentUpdater
	TemplateDir   string
	WorkspaceBase string
	Binary        string // "tofu" or "terraform"
}

func (j *TerraformDeployJob) Execute(ctx context.Context, logCh chan<- string) error {
	defer close(logCh)

	send := func(msg string) {
		select {
		case logCh <- msg:
		default:
		}
	}

	// Parse payload
	var payload model.DockerDeployPayload
	if err := json.Unmarshal([]byte(j.Ticket.Payload), &payload); err != nil {
		send(fmt.Sprintf("❌ Failed to parse payload: %v", err))
		j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil) //nolint:errcheck
		return err
	}

	// Mark deploying
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDeploying, nil, nil) //nolint:errcheck

	// Prepare workspace
	workdir := filepath.Join(j.WorkspaceBase, j.Ticket.ID)
	send("📁 Preparing Terraform workspace...")

	vars := map[string]interface{}{
		"app_name":  j.Deployment.AppName,
		"namespace": j.Deployment.Namespace,
		"image":     payload.Image,
		"port":      payload.Port,
		"replicas":  payload.Replicas,
		"domain":    payload.Domain,
		"cpu":       payload.Resources.CPU,
		"memory":    payload.Resources.Memory,
		"env":       payload.Env,
	}
	if vars["env"] == nil {
		vars["env"] = map[string]string{}
	}

	if err := terraform.PrepareWorkspace(j.TemplateDir, workdir, vars); err != nil {
		send(fmt.Sprintf("❌ Failed to prepare workspace: %v", err))
		j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil) //nolint:errcheck
		return err
	}

	tf := terraform.NewExecutorWithBinary(workdir, j.Binary)

	// Init
	send("⚙️  Running terraform init...")
	if err := tf.Init(send); err != nil {
		send(fmt.Sprintf("❌ terraform init failed: %v", err))
		j.fail(err.Error())
		return err
	}

	// Apply
	send("🚀 Running terraform apply...")
	if err := tf.Apply(send); err != nil {
		send(fmt.Sprintf("❌ terraform apply failed: %v", err))
		j.fail(err.Error())
		return err
	}

	// Read outputs
	outputs, err := tf.Output()
	if err != nil {
		send(fmt.Sprintf("⚠️  Failed to read outputs: %v", err))
	} else {
		for k, v := range outputs {
			send(fmt.Sprintf("  📤 %s = %s", k, v))
		}
	}

	send("✅ Deployment complete")
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDone, nil, nil)         //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployRunning, "✅ Done") //nolint:errcheck
	return nil
}

func (j *TerraformDeployJob) fail(msg string) {
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil)      //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, "❌ "+msg) //nolint:errcheck
}
