package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/terraform"
)

// TicketUpdater is the subset of TicketRepo needed by jobs.
type TicketUpdater interface {
	UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error
}

// DeploymentUpdater is the subset of DeploymentRepo needed by jobs.
type DeploymentUpdater interface {
	UpdateStatus(id string, status model.DeploymentStatus, logs string) error
}

// logCollector wraps logCh to also collect all lines for persistence.
type logCollector struct {
	ch    chan<- string
	lines []string
}

func newLogCollector(ch chan<- string) *logCollector {
	return &logCollector{ch: ch}
}

func (lc *logCollector) send(msg string) {
	lc.lines = append(lc.lines, msg)
	lc.ch <- msg
}

func (lc *logCollector) all() string {
	return strings.Join(lc.lines, "\n")
}
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
	lc := newLogCollector(logCh)

	// Parse payload
	var payload model.DockerDeployPayload
	if err := json.Unmarshal([]byte(j.Ticket.Payload), &payload); err != nil {
		lc.send(fmt.Sprintf("❌ Failed to parse payload: %v", err))
		j.fail(lc.all())
		return err
	}

	// Mark deploying
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDeploying, nil, nil) //nolint:errcheck

	// Prepare workspace
	workdir := filepath.Join(j.WorkspaceBase, j.Ticket.ID)
	lc.send("📁 Preparing Terraform workspace...")

	env := payload.Env
	if env == nil {
		env = map[string]string{}
	}

	vars := map[string]interface{}{
		"app_name":    j.Deployment.AppName,
		"namespace":   j.Deployment.Namespace,
		"image":       payload.Image,
		"port":        payload.Port,
		"replicas":    payload.Replicas,
		"domain":      payload.Domain,
		"cpu":         payload.Resources.CPU,
		"memory":      payload.Resources.Memory,
		"env":         env,
		"zone_domain":  os.Getenv("ROUTE53_ZONE_DOMAIN"),
		"cluster_name": os.Getenv("EKS_CLUSTER_NAME"),
	}
	if err := terraform.PrepareWorkspace(j.TemplateDir, workdir, vars); err != nil {
		lc.send(fmt.Sprintf("❌ Failed to prepare workspace: %v", err))
		j.fail(lc.all())
		return err
	}

	tf := terraform.NewExecutorWithBinary(workdir, j.Binary)

	// S3 backend
	if cfg := s3BackendConfig(j.Ticket.ID); cfg != nil {
		tf.SetBackendConfig(cfg)
	}

	// Init
	lc.send("⚙️  Running terraform init...")
	if err := tf.Init(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform init failed: %v", err))
		j.fail(lc.all())
		return err
	}

	// Apply
	lc.send("🚀 Running terraform apply...")
	if err := tf.Apply(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform apply failed: %v", err))
		j.fail(lc.all())
		return err
	}

	// Read outputs
	outputs, err := tf.Output()
	if err != nil {
		lc.send(fmt.Sprintf("⚠️  Failed to read outputs: %v", err))
	} else {
		for k, v := range outputs {
			lc.send(fmt.Sprintf("  📤 %s = %s", k, v))
		}
	}

	lc.send("✅ Deployment complete")
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDone, nil, nil)              //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployRunning, lc.all()) //nolint:errcheck
	return nil
}

func (j *TerraformDeployJob) fail(logs string) {
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil)       //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, logs) //nolint:errcheck
}
