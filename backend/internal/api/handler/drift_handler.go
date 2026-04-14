package handler

import (
	"net/http"
	"path/filepath"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/claw-works/woship/internal/terraform"
	"github.com/labstack/echo/v4"
)

type DriftHandler struct {
	driftRepo     *repo.DriftRepo
	deployRepo    *repo.DeploymentRepo
	ticketRepo    *repo.TicketRepo
	workspaceBase string
	binary        string
}

func NewDriftHandler(driftRepo *repo.DriftRepo, deployRepo *repo.DeploymentRepo, ticketRepo *repo.TicketRepo, workspaceBase, binary string) *DriftHandler {
	return &DriftHandler{driftRepo: driftRepo, deployRepo: deployRepo, ticketRepo: ticketRepo, workspaceBase: workspaceBase, binary: binary}
}

// ListAll returns recent drift records.
func (h *DriftHandler) ListAll(c echo.Context) error {
	records, err := h.driftRepo.ListAll()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, records)
}

// ListByDeployment returns drift records for a specific deployment.
func (h *DriftHandler) ListByDeployment(c echo.Context) error {
	records, err := h.driftRepo.ListByDeployment(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, records)
}

// Remediate re-applies terraform to fix drift (manual trigger).
func (h *DriftHandler) Remediate(c echo.Context) error {
	d, err := h.deployRepo.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deployment not found")
	}

	workdir := filepath.Join(h.workspaceBase, d.TicketID)
	tf := terraform.NewExecutorWithBinary(workdir, h.binary)

	if err := tf.Apply(nil); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "terraform apply failed: "+err.Error())
	}

	// Mark drift resolved
	h.deployRepo.UpdateDriftStatus(d.ID, "clean") //nolint:errcheck

	// Resolve all open drift records for this deployment
	records, _ := h.driftRepo.ListByDeployment(d.ID)
	for _, r := range records {
		if r.Status == model.DriftDetected {
			h.driftRepo.Resolve(r.ID) //nolint:errcheck
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "remediated"})
}
