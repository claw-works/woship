package jobs

import "os"

// s3BackendConfig returns the S3 backend config for a ticket workspace.
// Returns nil if TF_STATE_BUCKET is not set (local backend fallback).
func s3BackendConfig(ticketID string) map[string]string {
	bucket := os.Getenv("TF_STATE_BUCKET")
	if bucket == "" {
		return nil
	}
	region := os.Getenv("TF_STATE_REGION")
	if region == "" {
		region = "us-east-1"
	}
	return map[string]string{
		"bucket": bucket,
		"key":    "workspaces/" + ticketID + "/terraform.tfstate",
		"region": region,
	}
}
