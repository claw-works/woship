package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

// UserRepo provides database operations for users.
type UserRepo struct {
	db *sqlx.DB
}

// NewUserRepo creates a new UserRepo.
func NewUserRepo(db *sqlx.DB) *UserRepo {
	return &UserRepo{db: db}
}

// Create inserts a new user and populates ID and CreatedAt.
func (r *UserRepo) Create(u *model.User) error {
	query := `
		INSERT INTO users (email, password_hash, name, role)
		VALUES (:email, :password_hash, :name, :role)
		RETURNING id, created_at`
	rows, err := r.db.NamedQuery(query, u)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&u.ID, &u.CreatedAt)
	}
	return nil
}

// GetByID fetches a user by primary key.
func (r *UserRepo) GetByID(id string) (*model.User, error) {
	u := &model.User{}
	return u, r.db.Get(u, `SELECT * FROM users WHERE id=$1`, id)
}

// GetByEmail fetches a user by email address.
func (r *UserRepo) GetByEmail(email string) (*model.User, error) {
	u := &model.User{}
	return u, r.db.Get(u, `SELECT * FROM users WHERE email=$1`, email)
}
