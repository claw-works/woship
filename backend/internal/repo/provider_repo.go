package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

// ProviderRepo provides database operations for cloud providers.
type ProviderRepo struct {
	db *sqlx.DB
}

// NewProviderRepo creates a new ProviderRepo.
func NewProviderRepo(db *sqlx.DB) *ProviderRepo {
	return &ProviderRepo{db: db}
}

// Create inserts a new provider and populates ID and CreatedAt.
func (r *ProviderRepo) Create(p *model.Provider) error {
	query := `
		INSERT INTO providers (name, type, config, enabled)
		VALUES (:name, :type, :config, :enabled)
		RETURNING id, created_at`
	rows, err := r.db.NamedQuery(query, p)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&p.ID, &p.CreatedAt)
	}
	return nil
}

// GetByID fetches a provider by primary key.
func (r *ProviderRepo) GetByID(id string) (*model.Provider, error) {
	p := &model.Provider{}
	return p, r.db.Get(p, `SELECT * FROM providers WHERE id=$1`, id)
}

// List returns all providers ordered by creation time.
func (r *ProviderRepo) List() ([]model.Provider, error) {
	providers := []model.Provider{}
	return providers, r.db.Select(&providers, `SELECT * FROM providers ORDER BY created_at DESC`)
}

// Update modifies a provider's name, config, and enabled flag.
func (r *ProviderRepo) Update(p *model.Provider) error {
	_, err := r.db.NamedExec(
		`UPDATE providers SET name=:name, config=:config, enabled=:enabled WHERE id=:id`,
		p,
	)
	return err
}

// Delete removes a provider by ID.
func (r *ProviderRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM providers WHERE id=$1`, id)
	return err
}
