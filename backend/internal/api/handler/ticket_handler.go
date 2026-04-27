package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	mw "github.com/claw-works/woship/internal/api/middleware"
	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/service"
	"github.com/claw-works/woship/internal/worker"
	"github.com/labstack/echo/v4"
)

// TicketHandler handles ticket lifecycle requests.
type TicketHandler struct {
	svc    *service.TicketService
	runner *worker.Runner
	deployRepo DeploymentRepo
}

// DeploymentRepo is the subset needed by TicketHandler for deploy logs.
type DeploymentRepo interface {
	GetByTicketID(ticketID string) ([]model.Deployment, error)
}

// NewTicketHandler creates a new TicketHandler.
func NewTicketHandler(svc *service.TicketService, runner *worker.Runner, deployRepo DeploymentRepo) *TicketHandler {
	return &TicketHandler{svc: svc, runner: runner, deployRepo: deployRepo}
}

type createTicketReq struct {
	Type    string          `json:"type"`
	Title   string          `json:"title"`
	Payload json.RawMessage `json:"payload"`
}

// Create handles POST /api/tickets.
func (h *TicketHandler) Create(c echo.Context) error {
	var req createTicketReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if req.Type == "" || req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "type and title are required")
	}
	userID := mw.UserIDFromContext(c)
	ticket, err := h.svc.Create(userID, req.Title, req.Type, req.Payload)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, ticket)
}

// List handles GET /api/tickets.
func (h *TicketHandler) List(c echo.Context) error {
	userID := mw.UserIDFromContext(c)
	role := mw.RoleFromContext(c)
	status := c.QueryParam("status")

	// Admins and approvers see all tickets; regular users see only their own.
	createdBy := userID
	if role == string(model.RoleAdmin) || role == string(model.RoleApprover) {
		createdBy = ""
	}

	tickets, err := h.svc.List(createdBy, status)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, tickets)
}

// GetByID handles GET /api/tickets/:id.
func (h *TicketHandler) GetByID(c echo.Context) error {
	ticket, err := h.svc.GetByID(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
	}
	return c.JSON(http.StatusOK, ticket)
}

// Submit handles PUT /api/tickets/:id/submit.
func (h *TicketHandler) Submit(c echo.Context) error {
	userID := mw.UserIDFromContext(c)
	err := h.svc.Submit(c.Param("id"), userID)
	if err != nil {
		return ticketServiceError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "submitted"})
}

// Approve handles PUT /api/tickets/:id/approve.
func (h *TicketHandler) Approve(c echo.Context) error {
	userID := mw.UserIDFromContext(c)
	role := model.Role(mw.RoleFromContext(c))
	err := h.svc.Approve(c.Param("id"), userID, role)
	if err != nil {
		return ticketServiceError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "approved"})
}

type rejectReq struct {
	Reason string `json:"reason"`
}

// Retry handles PUT /api/tickets/:id/retry.
func (h *TicketHandler) Retry(c echo.Context) error {
	userID := mw.UserIDFromContext(c)
	role := model.Role(mw.RoleFromContext(c))
	err := h.svc.Retry(c.Param("id"), userID, role)
	if err != nil {
		return ticketServiceError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "retrying"})
}

// Reject handles PUT /api/tickets/:id/reject.
func (h *TicketHandler) Reject(c echo.Context) error {
	var req rejectReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	userID := mw.UserIDFromContext(c)
	role := model.Role(mw.RoleFromContext(c))
	err := h.svc.Reject(c.Param("id"), userID, req.Reason, role)
	if err != nil {
		return ticketServiceError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "rejected"})
}

// Logs handles GET /api/tickets/:id/logs via SSE.
func (h *TicketHandler) Logs(c echo.Context) error {
	ticketID := c.Param("id")

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().WriteHeader(http.StatusOK)

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	sent := 0
	for {
		select {
		case <-c.Request().Context().Done():
			return nil
		case <-ticker.C:
			logs := h.runner.GetLogs(ticketID)
			for sent < len(logs) {
				fmt.Fprintf(c.Response(), "data: %s\n\n", logs[sent])
				sent++
			}
			c.Response().Flush()
			if h.runner.IsDone(ticketID) && sent >= len(logs) {
				fmt.Fprintf(c.Response(), "data: __DONE__\n\n")
				c.Response().Flush()
				return nil
			}
		}
	}
}

// DeployLogs handles GET /api/tickets/:id/deploy-logs — returns persisted logs from deployment.
func (h *TicketHandler) DeployLogs(c echo.Context) error {
	deps, err := h.deployRepo.GetByTicketID(c.Param("id"))
	if err != nil || len(deps) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "no deployment found")
	}
	logs := ""
	if deps[0].Logs != nil {
		logs = *deps[0].Logs
	}
	return c.JSON(http.StatusOK, map[string]string{"logs": logs})
}

// ticketServiceError maps service errors to HTTP errors.
func ticketServiceError(err error) *echo.HTTPError {
	switch err {
	case service.ErrForbidden:
		return echo.NewHTTPError(http.StatusForbidden, err.Error())
	case service.ErrInvalidTransition:
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case service.ErrInvalidPayload:
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	default:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
}
