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
func NewServer(db *sqlx.DB, registry *provider.Registry, runner *worker.Runner, jwtSecret, tfBinary string) *Server {
	e := echo.New()
	e.HideBanner = true
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
	jf := makeJobFactory(registry, ticketRepo, deployRepo, tfBinary)
	ticketSvc := service.NewTicketService(ticketRepo, deployRepo, runner, jf)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc)
	userHandler := handler.NewUserHandler(authSvc)
	ticketHandler := handler.NewTicketHandler(ticketSvc, runner)
	deployHandler := handler.NewDeploymentHandler(deployRepo, runner, tfBinary)
	providerHandler := handler.NewProviderHandler(providerRepo, registry)
	driftHandler := handler.NewDriftHandler(repo.NewDriftRepo(db), deployRepo, ticketRepo, "terraform/workspaces", tfBinary)

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
	api.POST("/deployments/:id/destroy", deployHandler.Destroy, mw.RequireRole("admin"))

	// Drift
	api.GET("/drift", driftHandler.ListAll)
	api.GET("/deployments/:id/drift", driftHandler.ListByDeployment)
	api.POST("/deployments/:id/remediate", driftHandler.Remediate, mw.RequireRole("admin"))

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

// ServeStaticFrontend serves the frontend SPA from the given directory.
// Must be called after all API routes are registered.
func (s *Server) ServeStaticFrontend(dir string) {
	// Serve static files
	s.e.Static("/", dir)

	// SPA fallback: non-API routes return index.html
	s.e.GET("/*", func(c echo.Context) error {
		return c.File(dir + "/index.html")
	})
}

// makeJobFactory returns a JobFactory that creates TerraformDeployJobs.
func makeJobFactory(
	registry *provider.Registry,
	ticketRepo *repo.TicketRepo,
	deployRepo *repo.DeploymentRepo,
	tfBinary string,
) service.JobFactory {
	return func(t *model.Ticket, d *model.Deployment, providerID string) (worker.Job, error) {
		switch t.Type {
		case "docker_deploy":
			return &jobs.TerraformDeployJob{
				Ticket:        t,
				Deployment:    d,
				TicketRepo:    ticketRepo,
				DeployRepo:    deployRepo,
				TemplateDir:   "terraform/templates/docker_deploy",
				WorkspaceBase: "terraform/workspaces",
				Binary:        tfBinary,
			}, nil
		case "db_request":
			return &jobs.TerraformDbJob{
				Ticket:        t,
				Deployment:    d,
				TicketRepo:    ticketRepo,
				DeployRepo:    deployRepo,
				TemplateDir:   "terraform/templates/db_request",
				WorkspaceBase: "terraform/workspaces",
				Binary:        tfBinary,
			}, nil
		default:
			return &noopWorkerJob{}, nil
		}
	}
}

// noopWorkerJob is a Worker Job that immediately completes without doing anything.
type noopWorkerJob struct{}

func (j *noopWorkerJob) Execute(_ context.Context, logCh chan<- string) error {
	close(logCh)
	return nil
}
