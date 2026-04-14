package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

type DriftRepo struct {
	db *sqlx.DB
}

func NewDriftRepo(db *sqlx.DB) *DriftRepo {
	return &DriftRepo{db: db}
}

func (r *DriftRepo) Create(d *model.DriftRecord) error {
	query := `INSERT INTO drift_records (deployment_id, plan_output, status)
		VALUES (:deployment_id, :plan_output, :status)
		RETURNING id, created_at`
	rows, err := r.db.NamedQuery(query, d)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&d.ID, &d.CreatedAt)
	}
	return nil
}

func (r *DriftRepo) ListByDeployment(deploymentID string) ([]model.DriftRecord, error) {
	var records []model.DriftRecord
	return records, r.db.Select(&records,
		`SELECT * FROM drift_records WHERE deployment_id=$1 ORDER BY created_at DESC`, deploymentID)
}

func (r *DriftRepo) ListAll() ([]model.DriftRecord, error) {
	var records []model.DriftRecord
	return records, r.db.Select(&records,
		`SELECT * FROM drift_records ORDER BY created_at DESC LIMIT 100`)
}

func (r *DriftRepo) Resolve(id string) error {
	_, err := r.db.Exec(
		`UPDATE drift_records SET status='resolved', resolved_at=NOW() WHERE id=$1`, id)
	return err
}
