package main

import (
	"log"
	"os"

	"github.com/claw-works/woship/internal/db"
	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()

	cfg := db.Config{
		Host:     getenv("DB_HOST", "localhost"),
		Port:     getenv("DB_PORT", "5432"),
		User:     getenv("DB_USER", "woship"),
		Password: getenv("DB_PASSWORD", "woship"),
		DBName:   getenv("DB_NAME", "woship"),
		SSLMode:  getenv("DB_SSLMODE", "disable"),
	}

	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	userRepo := repo.NewUserRepo(database)

	adminEmail := "admin@woship.local"
	adminPassword := "admin123"

	// Check if admin already exists
	existing, _ := userRepo.GetByEmail(adminEmail)
	if existing != nil {
		log.Printf("ℹ️  Admin user already exists: %s", adminEmail)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}

	admin := &model.User{
		Email:        adminEmail,
		PasswordHash: string(hash),
		Name:         "Admin",
		Role:         model.RoleAdmin,
	}
	if err := userRepo.Create(admin); err != nil {
		log.Fatalf("failed to create admin user: %v", err)
	}
	log.Printf("✅ Created admin user: %s (password: %s)", adminEmail, adminPassword)
}

func getenv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
