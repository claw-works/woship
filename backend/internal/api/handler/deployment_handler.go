package handler

import (
	"net/http"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/claw-works/woship/internal/worker"
	"github.com/claw-works/woship/internal/worker/jobs"
	"github.com/labstack/echo/v4"
)

// DeploymentHandler handles deployment queries.
type DeploymentHandler struct {
	repo     *repo.DeploymentRepo
	runner   *worker.Runner
	tfBinary string
}

// NewDeploymentHandler creates a new DeploymentHandler.
func NewDeploymentHandler(r *repo.DeploymentRepo, runner *worker.Runner, tfBinary string) *DeploymentHandler {
	return &DeploymentHandler{repo: r, runner: runner, tfBinary: tfBinary}
}

// List handles GET /api/deployments.
func (h *DeploymentHandler) List(c echo.Context) error {
	deployments, err := h.repo.List()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, deployments)
}

// GetByID handles GET /api/deployments/:id.
func (h *DeploymentHandler) GetByID(c echo.Context) error {
	d, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deployment not found")
	}
	return c.JSON(http.StatusOK, d)
}

// Delete handles DELETE /api/deployments/:id.
func (h *DeploymentHandler) Delete(c echo.Context) error {
	d, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deployment not found")
	}
	if err := h.repo.UpdateStatus(d.ID, model.DeployStopped, "deleted by user"); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// Destroy handles POST /api/deployments/:id/destroy.
func (h *DeploymentHandler) Destroy(c echo.Context) error {
	d, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deployment not found")
	}
	if d.Status != model.DeployRunning {
		return echo.NewHTTPError(http.StatusConflict, "only running deployments can be destroyed")
	}

	h.repo.UpdateStatus(d.ID, model.DeployDestroying, "") //nolint:errcheck

	job := &jobs.TerraformDestroyJob{
		Deployment:    d,
		DeployRepo:    h.repo,
		WorkspaceBase: "terraform/workspaces",
		Binary:        h.tfBinary,
	}
	h.runner.Enqueue(d.TicketID, job)

	return c.JSON(http.StatusOK, map[string]string{"status": "destroying"})
}
