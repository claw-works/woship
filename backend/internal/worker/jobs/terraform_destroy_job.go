package jobs

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/terraform"
)

// TerraformDestroyJob runs terraform destroy on an existing workspace.
type TerraformDestroyJob struct {
	Deployment    *model.Deployment
	DeployRepo    DeploymentUpdater
	WorkspaceBase string
	Binary        string
}

func (j *TerraformDestroyJob) Execute(_ context.Context, logCh chan<- string) error {
	defer close(logCh)
	lc := newLogCollector(logCh)

	workdir := filepath.Join(j.WorkspaceBase, j.Deployment.TicketID)
	lc.send(fmt.Sprintf("🗑️  Destroying resources for %s...", j.Deployment.AppName))

	tf := terraform.NewExecutorWithBinary(workdir, j.Binary)

	if cfg := s3BackendConfig(j.Deployment.TicketID); cfg != nil {
		tf.SetBackendConfig(cfg)
	}

	lc.send("⚙️  Running terraform init...")
	if err := tf.Init(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform init failed: %v", err))
		j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, lc.all()) //nolint:errcheck
		return err
	}

	lc.send("🗑️  Running terraform destroy...")
	if err := tf.Destroy(lc.send); err != nil {
		lc.send(fmt.Sprintf("❌ terraform destroy failed: %v", err))
		j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployFailed, lc.all()) //nolint:errcheck
		return err
	}

	lc.send("✅ Resources destroyed")
	j.DeployRepo.UpdateStatus(j.Deployment.ID, model.DeployStopped, lc.all()) //nolint:errcheck
	return nil
}
