package drift

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/claw-works/woship/internal/terraform"
)

// Checker periodically scans running deployments for drift.
type Checker struct {
	deployRepo    *repo.DeploymentRepo
	driftRepo     *repo.DriftRepo
	workspaceBase string
	binary        string
	interval      time.Duration
	stop          chan struct{}
}

func NewChecker(deployRepo *repo.DeploymentRepo, driftRepo *repo.DriftRepo, workspaceBase, binary string, interval time.Duration) *Checker {
	if binary == "" {
		binary = "tofu"
	}
	return &Checker{
		deployRepo:    deployRepo,
		driftRepo:     driftRepo,
		workspaceBase: workspaceBase,
		binary:        binary,
		interval:      interval,
		stop:          make(chan struct{}),
	}
}

func (c *Checker) Start() {
	go c.loop()
	log.Printf("🔍 Drift checker started (interval: %s)", c.interval)
}

func (c *Checker) Stop() {
	close(c.stop)
}

func (c *Checker) loop() {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Run once on startup
	c.scan()

	for {
		select {
		case <-ticker.C:
			c.scan()
		case <-c.stop:
			return
		}
	}
}

func (c *Checker) scan() {
	deployments, err := c.deployRepo.ListRunning()
	if err != nil {
		log.Printf("drift: failed to list running deployments: %v", err)
		return
	}

	for _, d := range deployments {
		c.check(d)
	}
}

func (c *Checker) check(d model.Deployment) {
	workdir := filepath.Join(c.workspaceBase, d.TicketID)

	// Skip if workspace doesn't exist (e.g. noop jobs or cleaned up)
	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		return
	}

	tf := terraform.NewExecutorWithBinary(workdir, c.binary)

	hasDrift, planOutput, err := tf.Plan(nil)
	if err != nil {
		log.Printf("drift: plan failed for %s: %v", d.ID, err)
		return
	}

	if hasDrift {
		log.Printf("drift: detected on deployment %s (%s)", d.ID, d.AppName)

		// Record drift
		record := &model.DriftRecord{
			DeploymentID: d.ID,
			PlanOutput:   planOutput,
			Status:       model.DriftDetected,
		}
		if err := c.driftRepo.Create(record); err != nil {
			log.Printf("drift: failed to create record: %v", err)
		}

		// Mark deployment as drifted
		c.deployRepo.UpdateDriftStatus(d.ID, "drifted") //nolint:errcheck

		// Auto-sync state (refresh only, no resource changes)
		if err := tf.RefreshOnly(nil); err != nil {
			log.Printf("drift: refresh failed for %s: %v", d.ID, err)
		} else {
			log.Printf("drift: state synced for %s", d.ID)
		}
	} else {
		// Clear drift status if previously drifted
		if d.DriftStatus == "drifted" {
			c.deployRepo.UpdateDriftStatus(d.ID, "clean") //nolint:errcheck
		}
	}
}
