package worker

import "context"

// Job is the interface that all async deployment jobs must implement.
type Job interface {
	// Execute runs the job, sending log lines to logCh.
	// The job should close logCh when finished.
	Execute(ctx context.Context, logCh chan<- string) error
}
