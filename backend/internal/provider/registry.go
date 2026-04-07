package provider

import "fmt"

// Registry maps provider IDs to CloudProvider instances.
type Registry struct {
	providers map[string]CloudProvider
}

// NewRegistry creates an empty Registry.
func NewRegistry() *Registry {
	return &Registry{providers: make(map[string]CloudProvider)}
}

// Register associates id with the given CloudProvider instance.
func (r *Registry) Register(id string, p CloudProvider) {
	r.providers[id] = p
}

// Get returns the CloudProvider for the given id or an error if not found.
func (r *Registry) Get(id string) (CloudProvider, error) {
	if p, ok := r.providers[id]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("provider %q not found in registry", id)
}

// All returns all registered providers.
func (r *Registry) All() map[string]CloudProvider {
	result := make(map[string]CloudProvider, len(r.providers))
	for k, v := range r.providers {
		result[k] = v
	}
	return result
}
