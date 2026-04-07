// Package aws provides a stub AWS CloudProvider implementation.
// Full implementation (EKS + Route53) is planned for Phase 1 M5.
package aws

import (
	"github.com/claw-works/woship/internal/provider"
)

// Config holds AWS provider configuration.
type Config struct {
	Region          string `json:"region"`
	ClusterName     string `json:"cluster_name"`
	KubeconfigPath  string `json:"kubeconfig_path"`
	HostedZoneID    string `json:"hosted_zone_id"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
}

// AWSProvider is the AWS implementation of CloudProvider (skeleton).
type AWSProvider struct {
	cfg Config
}

// New creates a new AWSProvider skeleton.
func New(cfg Config) *AWSProvider {
	return &AWSProvider{cfg: cfg}
}

// Verify AWSProvider implements CloudProvider at compile time.
var _ provider.CloudProvider = (*AWSProvider)(nil)

func (p *AWSProvider) DeployApp(spec provider.AppSpec) error {
	return nil // TODO: implement EKS deployment
}

func (p *AWSProvider) UpdateApp(spec provider.AppSpec) error {
	return nil // TODO: implement EKS update
}

func (p *AWSProvider) DeleteApp(namespace, name string) error {
	return nil // TODO: implement EKS delete
}

func (p *AWSProvider) GetStatus(namespace, name string) (provider.AppStatus, error) {
	return provider.AppStatus{}, nil // TODO: implement EKS status
}

func (p *AWSProvider) BindDomain(domain, target string) error {
	return nil // TODO: implement Route53 record upsert
}

func (p *AWSProvider) Test() error {
	return nil // TODO: implement connectivity test
}
