package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
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

// EnsureAdmin creates the default admin user if it doesn't exist.
// Returns the admin user and whether it was newly created.
func (r *UserRepo) EnsureAdmin(email, password, name string) (*model.User, bool, error) {
	existing, err := r.GetByEmail(email)
	if err == nil && existing != nil {
		return existing, false, nil
	}
	if err != nil && err.Error() != "sql: no rows in result set" {
		return nil, false, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, false, err
	}

	admin := &model.User{
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
		Role:         model.RoleAdmin,
	}
	if err := r.Create(admin); err != nil {
		return nil, false, err
	}
	return admin, true, nil
}
