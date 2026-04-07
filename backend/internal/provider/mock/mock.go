package mock

import (
	"fmt"
	"sync"
	"time"

	"github.com/claw-works/woship/internal/provider"
)

// MockProvider is an in-memory CloudProvider for local development and testing.
type MockProvider struct {
	mu   sync.Mutex
	apps map[string]provider.AppStatus // key: "namespace/name"
}

// New creates a new MockProvider.
func New() *MockProvider {
	return &MockProvider{
		apps: make(map[string]provider.AppStatus),
	}
}

// DeployApp simulates a deployment with a 2-second delay.
func (m *MockProvider) DeployApp(spec provider.AppSpec) error {
	time.Sleep(2 * time.Second)
	m.mu.Lock()
	defer m.mu.Unlock()
	key := fmt.Sprintf("%s/%s", spec.Namespace, spec.Name)
	m.apps[key] = provider.AppStatus{
		Name:      spec.Name,
		Namespace: spec.Namespace,
		Status:    "running",
		Domain:    spec.Domain,
		Replicas:  spec.Replicas,
	}
	return nil
}

// UpdateApp re-deploys the app (same as DeployApp for mock).
func (m *MockProvider) UpdateApp(spec provider.AppSpec) error {
	return m.DeployApp(spec)
}

// DeleteApp removes the app from the in-memory store.
func (m *MockProvider) DeleteApp(namespace, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.apps, fmt.Sprintf("%s/%s", namespace, name))
	return nil
}

// GetStatus returns the stored status for an app.
func (m *MockProvider) GetStatus(namespace, name string) (provider.AppStatus, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := fmt.Sprintf("%s/%s", namespace, name)
	if s, ok := m.apps[key]; ok {
		return s, nil
	}
	return provider.AppStatus{}, fmt.Errorf("mock: app %q not found", key)
}

// BindDomain is a no-op in the mock.
func (m *MockProvider) BindDomain(domain, target string) error {
	return nil
}

// Test always succeeds for the mock.
func (m *MockProvider) Test() error {
	return nil
}
