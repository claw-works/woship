package service

import (
	"errors"
	"time"

	"github.com/claw-works/woship/internal/model"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned when email/password do not match.
var ErrInvalidCredentials = errors.New("invalid credentials")

// UserReader is the read-side of the user repository needed by AuthService.
type UserReader interface {
	GetByEmail(email string) (*model.User, error)
	GetByID(id string) (*model.User, error)
}

// UserWriter is the write-side of the user repository needed by AuthService.
type UserWriter interface {
	Create(u *model.User) error
}

// UserRepository combines reader and writer for AuthService.
type UserRepository interface {
	UserReader
	UserWriter
}

// AuthService handles user registration and login.
type AuthService struct {
	repo      UserRepository
	jwtSecret string
}

// NewAuthService creates a new AuthService.
func NewAuthService(repo UserRepository, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, jwtSecret: jwtSecret}
}

// Register creates a new user with a bcrypt-hashed password.
func (s *AuthService) Register(email, password, name string) (*model.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	u := &model.User{
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
		Role:         model.RoleUser,
	}
	if err := s.repo.Create(u); err != nil {
		return nil, err
	}
	return u, nil
}

// Login verifies credentials and returns a signed JWT token.
func (s *AuthService) Login(email, password string) (string, error) {
	u, err := s.repo.GetByEmail(email)
	if err != nil {
		return "", ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}
	return s.generateJWT(u)
}

// GetUser returns a user by ID.
func (s *AuthService) GetUser(id string) (*model.User, error) {
	return s.repo.GetByID(id)
}

func (s *AuthService) generateJWT(u *model.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  u.ID,
		"role": string(u.Role),
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtSecret))
}
