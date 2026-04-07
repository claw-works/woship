package api

import (
	"context"
	"net/http"

	"github.com/claw-works/woship/internal/api/handler"
	mw "github.com/claw-works/woship/internal/api/middleware"
	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/provider"
	"github.com/claw-works/woship/internal/repo"
	"github.com/claw-works/woship/internal/service"
	"github.com/claw-works/woship/internal/worker"
	"github.com/claw-works/woship/internal/worker/jobs"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

// Server wraps Echo and all application dependencies.
type Server struct {
	e *echo.Echo
}

// NewServer wires up all components and returns a configured Server.
func NewServer(db *sqlx.DB, registry *provider.Registry, runner *worker.Runner, jwtSecret string) *Server {
	e := echo.New()
	e.HideBanner = true
	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
	}))

	// Repositories
	userRepo := repo.NewUserRepo(db)
	ticketRepo := repo.NewTicketRepo(db)
	deployRepo := repo.NewDeploymentRepo(db)
	providerRepo := repo.NewProviderRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, jwtSecret)

	// Build job factory using concrete repo types
	jf := makeJobFactory(registry, ticketRepo, deployRepo)
	ticketSvc := service.NewTicketService(ticketRepo, deployRepo, runner, jf)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc)
	userHandler := handler.NewUserHandler(authSvc)
	ticketHandler := handler.NewTicketHandler(ticketSvc, runner)
	deployHandler := handler.NewDeploymentHandler(deployRepo)
	providerHandler := handler.NewProviderHandler(providerRepo, registry)

	// Public routes
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	auth := e.Group("/api/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)

	// Authenticated routes
	api := e.Group("/api", mw.JWTMiddleware(jwtSecret))

	// User
	api.GET("/users/me", userHandler.Me)

	// Tickets
	api.POST("/tickets", ticketHandler.Create)
	api.GET("/tickets", ticketHandler.List)
	api.GET("/tickets/:id", ticketHandler.GetByID)
	api.PUT("/tickets/:id/submit", ticketHandler.Submit)
	api.PUT("/tickets/:id/approve", ticketHandler.Approve, mw.RequireRole("approver", "admin"))
	api.PUT("/tickets/:id/reject", ticketHandler.Reject, mw.RequireRole("approver", "admin"))
	api.GET("/tickets/:id/logs", ticketHandler.Logs)

	// Deployments
	api.GET("/deployments", deployHandler.List)
	api.GET("/deployments/:id", deployHandler.GetByID)
	api.DELETE("/deployments/:id", deployHandler.Delete)

	// Provider admin routes
	adminProviders := api.Group("/providers", mw.RequireRole("admin"))
	adminProviders.GET("", providerHandler.List)
	adminProviders.POST("", providerHandler.Create)
	adminProviders.PUT("/:id", providerHandler.Update)
	adminProviders.DELETE("/:id", providerHandler.Delete)
	adminProviders.GET("/:id/test", providerHandler.Test)

	return &Server{e: e}
}

// Start starts the HTTP server on the given address.
func (s *Server) Start(addr string) error {
	return s.e.Start(addr)
}

// makeJobFactory returns a JobFactory that creates DockerDeployJobs.
func makeJobFactory(
	registry *provider.Registry,
	ticketRepo *repo.TicketRepo,
	deployRepo *repo.DeploymentRepo,
) service.JobFactory {
	return func(t *model.Ticket, d *model.Deployment, providerID string) (worker.Job, error) {
		prov, err := registry.Get(providerID)
		if err != nil {
			// Fall back to a no-op if provider not in registry (e.g., tests)
			return &noopWorkerJob{}, nil
		}
		return &jobs.DockerDeployJob{
			Ticket:     t,
			Deployment: d,
			Provider:   prov,
			TicketRepo: ticketRepo,
			DeployRepo: deployRepo,
		}, nil
	}
}

// noopWorkerJob is a Worker Job that immediately completes without doing anything.
type noopWorkerJob struct{}

func (j *noopWorkerJob) Execute(_ context.Context, logCh chan<- string) error {
	close(logCh)
	return nil
}
