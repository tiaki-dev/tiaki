---
sidebar_position: 1
---

# API Reference

The Tiaki REST API is used exclusively by Go agents to communicate with the control plane. It is **not** the API used by the browser dashboard (which uses tRPC internally).

## Base URL

```
/api/v1
```

## Authentication

All endpoints (except `POST /agents/register`) require a Bearer token:

```http
Authorization: Bearer <agent-api-key>
```

API keys are issued when an agent registers. They are shown **once** in the Tiaki dashboard and stored hashed (argon2) in the database.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/agents/register` | Register a new agent and receive an API key |
| `POST` | `/agents/heartbeat` | Update agent last-seen timestamp |
| `POST` | `/reports/submit` | Submit container scan results and detected updates |
| `GET` | `/reports/commands` | Long-poll for pending deployment commands (30s timeout) |
| `POST` | `/reports/commands/{commandId}/result` | Report the result of a deployment |

## OpenAPI specification

The full specification is defined in [`proto/api.yaml`](https://github.com/tiaki-dev/tiaki/blob/main/proto/api.yaml).

The interactive API reference below is auto-generated from that file.
