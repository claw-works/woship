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

// TerraformDbJob executes a database provisioning via Terraform.
type TerraformDbJob struct {
	Ticket        *model.Ticket
	Deployment    *model.Deployment
	TicketRepo    TicketUpdater
	DeployRepo    DeploymentUpdater
	TemplateDir   string
	WorkspaceBase string
	Binary        string
}

func (j *TerraformDbJob) Execute(ctx context.Context, logCh chan<- string) error {
	defer close(logCh)
	lc := newLogCollector(logCh)

	var payload model.DbRequestPayload
	if err := json.Unmarshal([]byte(j.Ticket.Payload), &payload); err != nil {
		lc.send(fmt.Sprintf("❌ Failed to parse payload: %v", err))
		j.fail(lc.all())
		return err
	}

	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDeploying, nil, nil) //nolint:errcheck

	workdir := filepath.Join(j.WorkspaceBase, j.Ticket.ID)
	lc.send(fmt.Sprintf("📁 Preparing workspace for %s %s...", payload.DbType, payload.Version))

	vars := map[string]interface{}{
		"instance_name":     payload.InstanceName,
		"db_type":           payload.DbType,
		"engine_version":    payload.Version,
		"storage_gb":        payload.StorageGB,
		"high_availability": payload.HighAvailability,
		"vpc_id":            os.Getenv("VPC_ID"),
		"subnet_ids":        strings.Split(os.Getenv("SUBNET_IDS"), ","),
		"allowed_cidr":      getenvDefault("ALLOWED_CIDR", "10.0.0.0/8"),
	}

	if err := terraform.PrepareWorkspace(j.TemplateDir, workdir, vars); err != nil {
		lc.send(fmt.Sprintf("❌ Failed to prepare workspace: %v", err))
		j.fail(lc.all())
		return err
	}

	tf := terraform.NewExecutorWithBinary(workdir, j.Binary)

	if cfg := s3BackendConfig(j.Ticket.ID); cfg != nil {
		tf.SetBackendConfig(cfg)
	}

	lc.send("⚙️  Running terraform init...")
	if err := tf.Init(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform init failed: %v", err))
		j.fail(lc.all())
		return err
	}

	lc.send(fmt.Sprintf("🗄️  Provisioning %s instance '%s'...", payload.DbType, payload.InstanceName))
	if err := tf.Apply(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform apply failed: %v", err))
		j.fail(lc.all())
		return err
	}

	outputs, err := tf.Output()
	if err != nil {
		lc.send(fmt.Sprintf("⚠️  Failed to read outputs: %v", err))
	} else {
		for k, v := range outputs {
			lc.send(fmt.Sprintf("  📤 %s = %s", k, v))
		}
	}

	lc.send("✅ Database provisioned")
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDone, nil, nil)              //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployRunning, lc.all()) //nolint:errcheck
	return nil
}

func (j *TerraformDbJob) fail(logs string) {
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil)       //nolint:errcheck
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, logs) //nolint:errcheck
}

func getenvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
