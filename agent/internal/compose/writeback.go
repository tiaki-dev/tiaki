// Package compose provides utilities for reading and updating docker-compose files.
package compose

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// ValidatePath checks that composeFile is an absolute path that resides under one of
// the allowedDirs. This prevents a compromised control plane from sending a path like
// "/etc/passwd" or "../../sensitive.yml" to the agent.
// If allowedDirs is empty the check is skipped (backwards-compatible default).
func ValidatePath(composeFile string, allowedDirs []string) error {
	if len(allowedDirs) == 0 {
		// COMPOSE_PATHS not set — write-back is unrestricted.
		// Set COMPOSE_PATHS to limit which directories the agent may modify.
		log.Printf("[compose] WARNING: COMPOSE_PATHS not set, accepting path %q without validation", composeFile)
		return nil
	}
	abs, err := filepath.Abs(composeFile)
	if err != nil {
		return fmt.Errorf("invalid compose file path: %w", err)
	}
	for _, dir := range allowedDirs {
		absDir, err := filepath.Abs(dir)
		if err != nil {
			continue
		}
		if strings.HasPrefix(abs, absDir+string(filepath.Separator)) || abs == absDir {
			return nil
		}
	}
	return fmt.Errorf("compose file %q is outside allowed directories", composeFile)
}

// UpdateServiceImage rewrites the image tag for a named service in a compose file.
// The file is updated atomically (write to temp + rename). Preserves YAML formatting
// and comments outside the modified node as much as yaml.v3 allows.
func UpdateServiceImage(composeFile, service, newImage string) error {
	data, err := os.ReadFile(composeFile)
	if err != nil {
		return fmt.Errorf("read compose file: %w", err)
	}

	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return fmt.Errorf("parse compose file: %w", err)
	}

	if len(doc.Content) == 0 {
		return fmt.Errorf("empty compose document")
	}

	root := doc.Content[0] // mapping node
	if err := setServiceImage(root, service, newImage); err != nil {
		return err
	}

	updated, err := yaml.Marshal(&doc)
	if err != nil {
		return fmt.Errorf("marshal compose file: %w", err)
	}

	// Atomic write via temp file + rename
	tmp := composeFile + ".tiaki.tmp"
	if err := os.WriteFile(tmp, updated, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, composeFile); err != nil {
		os.Remove(tmp) //nolint:errcheck
		return fmt.Errorf("rename temp file: %w", err)
	}

	return nil
}

// setServiceImage navigates the YAML node tree to find services.<service>.image
// and updates its value to newImage.
func setServiceImage(root *yaml.Node, service, newImage string) error {
	// Find "services" key
	servicesNode := mappingValue(root, "services")
	if servicesNode == nil {
		return fmt.Errorf("compose file has no 'services' section")
	}

	// Find the specific service
	serviceNode := mappingValue(servicesNode, service)
	if serviceNode == nil {
		return fmt.Errorf("service %q not found in compose file", service)
	}

	// Find "image" key inside the service
	imageNode := mappingValueNode(serviceNode, "image")
	if imageNode == nil {
		// No image key — could be a build-only service
		return fmt.Errorf("service %q has no 'image' field", service)
	}

	imageNode.Value = newImage
	return nil
}

// mappingValue returns the value node for a given key in a YAML mapping node.
func mappingValue(mapping *yaml.Node, key string) *yaml.Node {
	if mapping.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value == key {
			return mapping.Content[i+1]
		}
	}
	return nil
}

// mappingValueNode returns the value node (not a copy) so callers can mutate it.
func mappingValueNode(mapping *yaml.Node, key string) *yaml.Node {
	return mappingValue(mapping, key)
}
