package handler

import (
	"net/http"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/labstack/echo/v4"
)

// DeploymentHandler handles deployment queries.
type DeploymentHandler struct {
	repo *repo.DeploymentRepo
}

// NewDeploymentHandler creates a new DeploymentHandler.
func NewDeploymentHandler(r *repo.DeploymentRepo) *DeploymentHandler {
	return &DeploymentHandler{repo: r}
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
	// In a real implementation this would call provider.DeleteApp
	// For now we just mark the deployment as stopped.
	d, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deployment not found")
	}
	if err := h.repo.UpdateStatus(d.ID, model.DeployStopped, "deleted by user"); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
