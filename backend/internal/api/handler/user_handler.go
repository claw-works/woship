package handler

import (
	"net/http"

	mw "github.com/claw-works/woship/internal/api/middleware"
	"github.com/claw-works/woship/internal/service"
	"github.com/labstack/echo/v4"
)

// UserHandler handles user-related requests.
type UserHandler struct {
	svc *service.AuthService
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(svc *service.AuthService) *UserHandler {
	return &UserHandler{svc: svc}
}

// Me handles GET /api/users/me — returns the authenticated user's profile.
func (h *UserHandler) Me(c echo.Context) error {
	id := mw.UserIDFromContext(c)
	user, err := h.svc.GetUser(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	return c.JSON(http.StatusOK, user)
}
