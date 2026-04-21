package worker

import (
	"context"
	"sync"
)

// entry holds job state and captured log lines for a ticket.
type entry struct {
	logs []string
	done bool
	mu   sync.Mutex
}

// Runner is a goroutine-pool based async job executor.
type Runner struct {
	queue chan jobItem
	jobs  map[string]*entry
	mu    sync.Mutex
}

type jobItem struct {
	ticketID string
	job      Job
}

// NewRunner creates a Runner with the given concurrency.
func NewRunner(concurrency int) *Runner {
	r := &Runner{
		queue: make(chan jobItem, 256),
		jobs:  make(map[string]*entry),
	}
	for i := 0; i < concurrency; i++ {
		go r.work()
	}
	return r
}

// Enqueue adds a job for execution and associates logs with ticketID.
func (r *Runner) Enqueue(ticketID string, job Job) {
	r.mu.Lock()
	r.jobs[ticketID] = &entry{}
	r.mu.Unlock()
	r.queue <- jobItem{ticketID: ticketID, job: job}
}

// GetLogs returns all log lines collected so far for a ticket.
func (r *Runner) GetLogs(ticketID string) []string {
	r.mu.Lock()
	e, ok := r.jobs[ticketID]
	r.mu.Unlock()
	if !ok {
		return nil
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	cp := make([]string, len(e.logs))
	copy(cp, e.logs)
	return cp
}

// IsDone reports whether the job for ticketID has finished.
func (r *Runner) IsDone(ticketID string) bool {
	r.mu.Lock()
	e, ok := r.jobs[ticketID]
	r.mu.Unlock()
	if !ok {
		return true
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.done
}

func (r *Runner) work() {
	for item := range r.queue {
		logCh := make(chan string, 4096)
		go r.collect(item.ticketID, logCh)
		item.job.Execute(context.Background(), logCh) //nolint:errcheck
	}
}

func (r *Runner) collect(ticketID string, logCh <-chan string) {
	r.mu.Lock()
	e := r.jobs[ticketID]
	r.mu.Unlock()

	for line := range logCh {
		e.mu.Lock()
		e.logs = append(e.logs, line)
		e.mu.Unlock()
	}

	e.mu.Lock()
	e.done = true
	e.mu.Unlock()
}
