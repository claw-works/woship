package provider

// AppSpec describes the desired state of an application deployment.
type AppSpec struct {
	Name      string
	Namespace string
	Image     string
	Domain    string
	Port      int
	Replicas  int
	Env       map[string]string
	CPU       string
	Memory    string
}

// AppStatus represents the current state of a deployed application.
type AppStatus struct {
	Name      string
	Namespace string
	Status    string
	Domain    string
	Replicas  int
}

// CloudProvider defines the interface every cloud backend must implement.
type CloudProvider interface {
	// DeployApp creates or updates an application deployment.
	DeployApp(spec AppSpec) error
	// UpdateApp updates a running application deployment.
	UpdateApp(spec AppSpec) error
	// DeleteApp removes an application from the specified namespace.
	DeleteApp(namespace, name string) error
	// GetStatus returns the current status of an application.
	GetStatus(namespace, name string) (AppStatus, error)
	// BindDomain configures a DNS record pointing domain to target.
	BindDomain(domain, target string) error
	// Test verifies connectivity to the provider.
	Test() error
}
