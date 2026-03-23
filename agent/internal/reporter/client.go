package reporter

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const maxResponseBytes = 1 << 20 // 1 MiB — prevents OOM from a runaway control plane response

// Client sends data to the Tiaki control plane.
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// TLSConfig holds optional TLS settings for the control plane connection.
type TLSConfig struct {
	SkipVerify bool
	CACertPath string
}

// NewClient creates a reporter client.
func NewClient(baseURL, apiKey string, tlsCfg TLSConfig) *Client {
	transport := buildTransport(tlsCfg)
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 60 * time.Second, Transport: transport},
	}
}

func buildTransport(cfg TLSConfig) http.RoundTripper {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	if cfg.SkipVerify {
		log.Println("[agent] WARNING: TLS certificate verification disabled (TLS_SKIP_VERIFY=true)")
		tlsConfig.InsecureSkipVerify = true //nolint:gosec // intentional, user-configured
	} else if cfg.CACertPath != "" {
		pem, err := os.ReadFile(cfg.CACertPath)
		if err != nil {
			log.Fatalf("[agent] failed to read CA cert %s: %v", cfg.CACertPath, err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			log.Fatalf("[agent] no valid certificates found in %s", cfg.CACertPath)
		}
		tlsConfig.RootCAs = pool
	}

	return &http.Transport{TLSClientConfig: tlsConfig}
}

// Heartbeat updates the agent's last_seen_at on the control plane.
func (c *Client) Heartbeat(ctx context.Context) error {
	return c.post(ctx, "/trpc/agents.heartbeat", nil, nil)
}

// SubmitReport sends container scan results to the control plane.
func (c *Client) SubmitReport(ctx context.Context, req SubmitReportRequest) error {
	return c.post(ctx, "/trpc/reports.submit", req, nil)
}

// PollCommands fetches pending deploy commands (short-poll).
func (c *Client) PollCommands(ctx context.Context) (*CommandsResponse, error) {
	var resp CommandsResponse
	if err := c.get(ctx, "/trpc/reports.getCommands", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// MarkDeployed notifies the control plane that a deploy completed successfully.
func (c *Client) MarkDeployed(ctx context.Context, updateResultID, log string) error {
	return c.post(ctx, "/trpc/updates.markDeployed", map[string]string{
		"id":  updateResultID,
		"log": log,
	}, nil)
}

// MarkFailed notifies the control plane that a deploy failed.
func (c *Client) MarkFailed(ctx context.Context, updateResultID, log string) error {
	return c.post(ctx, "/trpc/updates.markFailed", map[string]string{
		"id":  updateResultID,
		"log": log,
	}, nil)
}

// MarkRolledBack notifies the control plane that a rollback completed.
func (c *Client) MarkRolledBack(ctx context.Context, updateResultID, log string) error {
	return c.post(ctx, "/trpc/updates.markRolledBack", map[string]string{
		"id":  updateResultID,
		"log": log,
	}, nil)
}

// MarkRollbackFailed notifies the control plane that a rollback failed.
func (c *Client) MarkRollbackFailed(ctx context.Context, updateResultID, log string) error {
	return c.post(ctx, "/trpc/updates.markRollbackFailed", map[string]string{
		"id":  updateResultID,
		"log": log,
	}, nil)
}

// tRPC v11 batched response format: [{"result":{"data":{"json":<output>}}}]
type trpcBatchResponse []struct {
	Result struct {
		Data struct {
			JSON json.RawMessage `json:"json"`
		} `json:"data"`
	} `json:"result"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// trpcSingleResponse is the tRPC v11 path-based response envelope.
// Without a transformer, data is directly in result.data (no json sub-key).
type trpcSingleResponse struct {
	Result struct {
		Data json.RawMessage `json:"data"`
	} `json:"result"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// post sends a tRPC v11 path-based POST request.
// Format: POST /trpc/<path> with raw JSON body.
func (c *Client) post(ctx context.Context, path string, body, out any) error {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
		return fmt.Errorf("control plane returned %d: %s", resp.StatusCode, string(respBody))
	}

	if out != nil {
		var envelope trpcSingleResponse
		if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&envelope); err != nil {
			return err
		}
		if envelope.Error != nil {
			return fmt.Errorf("tRPC error: %s", envelope.Error.Message)
		}
		return json.Unmarshal(envelope.Result.Data, out)
	}

	return nil
}

// get sends a tRPC v11 path-based GET request (for queries).
func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
		return fmt.Errorf("control plane returned %d: %s", resp.StatusCode, string(body))
	}

	if out != nil {
		var envelope trpcSingleResponse
		if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&envelope); err != nil {
			return err
		}
		if envelope.Error != nil {
			return fmt.Errorf("tRPC error: %s", envelope.Error.Message)
		}
		return json.Unmarshal(envelope.Result.Data, out)
	}

	return nil
}
