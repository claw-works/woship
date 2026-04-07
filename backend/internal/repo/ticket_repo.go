package repo

import (
	"fmt"

	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

// TicketRepo provides database operations for tickets.
type TicketRepo struct {
	db *sqlx.DB
}

// NewTicketRepo creates a new TicketRepo.
func NewTicketRepo(db *sqlx.DB) *TicketRepo {
	return &TicketRepo{db: db}
}

// Create inserts a new ticket and populates ID, CreatedAt, UpdatedAt.
func (r *TicketRepo) Create(t *model.Ticket) error {
	query := `
		INSERT INTO tickets (type, title, status, payload, created_by)
		VALUES (:type, :title, :status, :payload, :created_by)
		RETURNING id, created_at, updated_at`
	rows, err := r.db.NamedQuery(query, t)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	}
	return nil
}

// GetByID fetches a ticket by primary key.
func (r *TicketRepo) GetByID(id string) (*model.Ticket, error) {
	t := &model.Ticket{}
	return t, r.db.Get(t, `SELECT * FROM tickets WHERE id=$1`, id)
}

// List returns tickets with optional filters on createdBy and status.
func (r *TicketRepo) List(createdBy string, status string) ([]model.Ticket, error) {
	query := `SELECT * FROM tickets WHERE 1=1`
	args := []interface{}{}
	idx := 1
	if createdBy != "" {
		query += fmt.Sprintf(" AND created_by=$%d", idx)
		args = append(args, createdBy)
		idx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, status)
		idx++
	}
	query += " ORDER BY created_at DESC"
	tickets := []model.Ticket{}
	return tickets, r.db.Select(&tickets, query, args...)
}

// UpdateStatus updates a ticket's status and optionally its reviewer / reject reason.
func (r *TicketRepo) UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error {
	_, err := r.db.Exec(
		`UPDATE tickets SET status=$1, reviewed_by=$2, reject_reason=$3 WHERE id=$4`,
		status, reviewerID, rejectReason, id,
	)
	return err
}
