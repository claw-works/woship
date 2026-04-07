package handler

import (
	"net/http"

	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/provider"
	"github.com/claw-works/woship/internal/repo"
	"github.com/labstack/echo/v4"
)

// ProviderHandler handles cloud provider CRUD for admin users.
type ProviderHandler struct {
	repo     *repo.ProviderRepo
	registry *provider.Registry
}

// NewProviderHandler creates a new ProviderHandler.
func NewProviderHandler(r *repo.ProviderRepo, registry *provider.Registry) *ProviderHandler {
	return &ProviderHandler{repo: r, registry: registry}
}

// List handles GET /api/providers.
func (h *ProviderHandler) List(c echo.Context) error {
	providers, err := h.repo.List()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, providers)
}

type createProviderReq struct {
	Name   string          `json:"name"`
	Type   string          `json:"type"`
	Config model.RawJSON   `json:"config"`
}

// Create handles POST /api/providers.
func (h *ProviderHandler) Create(c echo.Context) error {
	var req createProviderReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if req.Name == "" || req.Type == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name and type are required")
	}
	if len(req.Config) == 0 {
		req.Config = model.RawJSON("{}")
	}
	p := &model.Provider{
		Name:    req.Name,
		Type:    req.Type,
		Config:  req.Config,
		Enabled: true,
	}
	if err := h.repo.Create(p); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, p)
}

type updateProviderReq struct {
	Name    string        `json:"name"`
	Config  model.RawJSON `json:"config"`
	Enabled *bool         `json:"enabled"`
}

// Update handles PUT /api/providers/:id.
func (h *ProviderHandler) Update(c echo.Context) error {
	id := c.Param("id")
	p, err := h.repo.GetByID(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "provider not found")
	}
	var req updateProviderReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if req.Name != "" {
		p.Name = req.Name
	}
	if len(req.Config) > 0 {
		p.Config = req.Config
	}
	if req.Enabled != nil {
		p.Enabled = *req.Enabled
	}
	if err := h.repo.Update(p); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, p)
}

// Delete handles DELETE /api/providers/:id.
func (h *ProviderHandler) Delete(c echo.Context) error {
	if err := h.repo.Delete(c.Param("id")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// Test handles GET /api/providers/:id/test.
func (h *ProviderHandler) Test(c echo.Context) error {
	id := c.Param("id")
	p, err := h.registry.Get(id)
	if err != nil {
		// Not in registry — check DB
		_, dbErr := h.repo.GetByID(id)
		if dbErr != nil {
			return echo.NewHTTPError(http.StatusNotFound, "provider not found")
		}
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "provider not initialized in registry")
	}
	if err := p.Test(); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
