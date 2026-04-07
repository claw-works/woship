package model

import "time"

// Role represents user permission level.
type Role string

const (
	RoleAdmin    Role = "admin"
	RoleApprover Role = "approver"
	RoleUser     Role = "user"
)

// User is the database model for a woship user.
type User struct {
	ID           string    `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Name         string    `db:"name" json:"name"`
	Role         Role      `db:"role" json:"role"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}
