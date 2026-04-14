package terraform

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Executor wraps terraform/tofu CLI operations on a working directory.
type Executor struct {
	workdir string
	binary  string // "terraform" or "tofu"
}

// NewExecutor creates an Executor for the given working directory.
// binary defaults to "tofu" if empty.
func NewExecutor(workdir string) *Executor {
	return &Executor{workdir: workdir, binary: "tofu"}
}

// NewExecutorWithBinary creates an Executor with a specific CLI binary.
func NewExecutorWithBinary(workdir, binary string) *Executor {
	if binary == "" {
		binary = "tofu"
	}
	return &Executor{workdir: workdir, binary: binary}
}

// Init runs terraform init.
func (e *Executor) Init(logFn func(string)) error {
	return e.run(logFn, "init", "-no-color", "-input=false")
}

// Apply runs terraform apply with auto-approve.
func (e *Executor) Apply(logFn func(string)) error {
	return e.run(logFn, "apply", "-auto-approve", "-no-color", "-input=false")
}

// Plan runs terraform plan and returns whether drift was detected.
// Returns: hasDrift bool, planOutput string, err error.
func (e *Executor) Plan(logFn func(string)) (bool, string, error) {
	cmd := exec.Command(e.binary, "plan", "-detailed-exitcode", "-no-color", "-input=false")
	cmd.Dir = e.workdir

	out, err := cmd.CombinedOutput()
	output := string(out)

	if logFn != nil {
		for _, line := range splitLines(output) {
			logFn(line)
		}
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 2 {
				// exit code 2 = changes detected (drift)
				return true, output, nil
			}
		}
		return false, output, fmt.Errorf("terraform plan: %w", err)
	}
	// exit code 0 = no changes
	return false, output, nil
}

// RefreshOnly syncs the state file with actual cloud state without modifying resources.
func (e *Executor) RefreshOnly(logFn func(string)) error {
	return e.run(logFn, "apply", "-refresh-only", "-auto-approve", "-no-color", "-input=false")
}

// Destroy runs terraform destroy with auto-approve.
func (e *Executor) Destroy(logFn func(string)) error {
	return e.run(logFn, "destroy", "-auto-approve", "-no-color", "-input=false")
}

// Output returns terraform outputs as a map.
func (e *Executor) Output() (map[string]string, error) {
	cmd := exec.Command(e.binary, "output", "-json", "-no-color")
	cmd.Dir = e.workdir
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("terraform output: %w", err)
	}
	var raw map[string]struct {
		Value interface{} `json:"value"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, fmt.Errorf("parse output: %w", err)
	}
	result := make(map[string]string, len(raw))
	for k, v := range raw {
		result[k] = fmt.Sprintf("%v", v.Value)
	}
	return result, nil
}

// run executes a terraform subcommand, streaming stdout/stderr to logFn.
func (e *Executor) run(logFn func(string), args ...string) error {
	cmd := exec.Command(e.binary, args...)
	cmd.Dir = e.workdir

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = cmd.Stdout // merge stderr into stdout

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("terraform %s: %w", args[0], err)
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		if logFn != nil {
			logFn(scanner.Text())
		}
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("terraform %s: %w", args[0], err)
	}
	return nil
}

// PrepareWorkspace copies a template directory to a workspace and writes a .tfvars file.
func PrepareWorkspace(templateDir, workspaceDir string, vars map[string]interface{}) error {
	if err := copyDir(templateDir, workspaceDir); err != nil {
		return fmt.Errorf("copy template: %w", err)
	}
	return writeTfvars(filepath.Join(workspaceDir, "terraform.tfvars.json"), vars)
}

// CleanWorkspace removes a workspace directory.
func CleanWorkspace(workspaceDir string) error {
	return os.RemoveAll(workspaceDir)
}

func writeTfvars(path string, vars map[string]interface{}) error {
	data, err := json.MarshalIndent(vars, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		if err := copyFile(srcPath, dstPath); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func splitLines(s string) []string {
	var lines []string
	for _, line := range strings.Split(s, "\n") {
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}
