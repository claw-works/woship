package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/claw-works/woship/internal/api"
	"github.com/claw-works/woship/internal/db"
	"github.com/claw-works/woship/internal/drift"
	"github.com/claw-works/woship/internal/provider"
	mockprovider "github.com/claw-works/woship/internal/provider/mock"
	"github.com/claw-works/woship/internal/repo"
	"github.com/claw-works/woship/internal/worker"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env if present (ignore error if file is missing)
	_ = godotenv.Load()

	cfg := db.Config{
		Host:     getenv("DB_HOST", "localhost"),
		Port:     getenv("DB_PORT", "5432"),
		User:     getenv("DB_USER", "woship"),
		Password: getenv("DB_PASSWORD", "woship"),
		DBName:   getenv("DB_NAME", "woship"),
		SSLMode:  getenv("DB_SSLMODE", "disable"),
	}

	jwtSecret := getenv("JWT_SECRET", "super-secret-key-change-in-production")
	tfBinary := getenv("TF_BINARY", "tofu")
	port := getenv("PORT", "8080")

	// Connect to database
	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	log.Println("✅ Connected to database")

	// Run migrations
	if err := db.RunMigrations(database, cfg); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}
	log.Println("✅ Migrations applied")

	// Ensure default admin user exists
	userRepo := repo.NewUserRepo(database)
	adminEmail := getenv("DEFAULT_ADMIN_EMAIL", "admin@woship.local")
	adminPassword := getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
	if admin, created, err := userRepo.EnsureAdmin(adminEmail, adminPassword, "Admin"); err != nil {
		log.Fatalf("failed to ensure admin user: %v", err)
	} else if created {
		log.Printf("✅ Created default admin user: %s (password: %s) — CHANGE THIS PASSWORD IN PRODUCTION", admin.Email, adminPassword)
	} else {
		log.Printf("✅ Admin user already exists: %s", admin.Email)
	}

	// Build provider registry
	registry := provider.NewRegistry()

	// Register a mock provider for local development
	mockP := mockprovider.New()
	registry.Register("mock-default", mockP)

	// Start async worker pool (4 workers)
	runner := worker.NewRunner(4)

	// Start drift checker (every 10 minutes)
	deployRepo := repo.NewDeploymentRepo(database)
	driftRepo := repo.NewDriftRepo(database)
	driftChecker := drift.NewChecker(deployRepo, driftRepo, "terraform/workspaces", tfBinary, 10*time.Minute)
	driftChecker.Start()

	// Build and start the server
	srv := api.NewServer(database, registry, runner, jwtSecret, tfBinary)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 Starting Woship server on %s", addr)
	if err := srv.Start(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
