package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

// DeploymentRepo provides database operations for deployments.
type DeploymentRepo struct {
	db *sqlx.DB
}

// NewDeploymentRepo creates a new DeploymentRepo.
func NewDeploymentRepo(db *sqlx.DB) *DeploymentRepo {
	return &DeploymentRepo{db: db}
}

// Create inserts a new deployment and populates ID, CreatedAt, UpdatedAt.
func (r *DeploymentRepo) Create(d *model.Deployment) error {
	query := `
		INSERT INTO deployments (ticket_id, provider_id, namespace, app_name, image, domain, status)
		VALUES (:ticket_id, :provider_id, :namespace, :app_name, :image, :domain, :status)
		RETURNING id, created_at, updated_at`
	rows, err := r.db.NamedQuery(query, d)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
	}
	return nil
}

// GetByID fetches a deployment by primary key.
func (r *DeploymentRepo) GetByID(id string) (*model.Deployment, error) {
	d := &model.Deployment{}
	return d, r.db.Get(d, `SELECT * FROM deployments WHERE id=$1`, id)
}

// GetByTicketID fetches deployments associated with a ticket.
func (r *DeploymentRepo) GetByTicketID(ticketID string) ([]model.Deployment, error) {
	deployments := []model.Deployment{}
	return deployments, r.db.Select(&deployments, `SELECT * FROM deployments WHERE ticket_id=$1 ORDER BY created_at DESC`, ticketID)
}

// List returns all deployments ordered by creation time descending.
func (r *DeploymentRepo) List() ([]model.Deployment, error) {
	deployments := []model.Deployment{}
	return deployments, r.db.Select(&deployments, `SELECT * FROM deployments ORDER BY created_at DESC`)
}

// UpdateStatus sets the status and optionally appends logs for a deployment.
func (r *DeploymentRepo) UpdateStatus(id string, status model.DeploymentStatus, logs string) error {
	_, err := r.db.Exec(
		`UPDATE deployments SET status=$1, logs=$2 WHERE id=$3`,
		status, logs, id,
	)
	return err
}

// UpdateDriftStatus sets the drift_status for a deployment.
func (r *DeploymentRepo) UpdateDriftStatus(id string, driftStatus string) error {
	_, err := r.db.Exec(`UPDATE deployments SET drift_status=$1 WHERE id=$2`, driftStatus, id)
	return err
}

// ListRunning returns all deployments with status 'running'.
func (r *DeploymentRepo) ListRunning() ([]model.Deployment, error) {
	var deployments []model.Deployment
	return deployments, r.db.Select(&deployments, `SELECT * FROM deployments WHERE status='running'`)
}

// ExistsActive checks if an active deployment with the same namespace+app_name already exists.
func (r *DeploymentRepo) ExistsActive(namespace, appName string) (bool, error) {
	var exists bool
	err := r.db.Get(&exists,
		`SELECT EXISTS(SELECT 1 FROM deployments WHERE namespace=$1 AND app_name=$2 AND status != 'stopped')`,
		namespace, appName)
	return exists, err
}
