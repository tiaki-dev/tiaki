# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Tiaki seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **flo@tiaki.dev**.

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Preferred Languages

We prefer all communications to be in English or German.

## Security Update Process

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported releases
4. Release new security fix versions as soon as possible

## Security-Related Configuration

### Agent Security

- **API Keys**: Store agent API keys securely using environment variables or secrets management systems
- **Docker Socket**: The Docker agent requires access to the Docker socket (`/var/run/docker.sock`). This grants significant privileges - ensure the agent runs in a trusted environment
- **Kubernetes RBAC**: The Kubernetes agent requires appropriate RBAC permissions. Follow the principle of least privilege
- **Network Access**: Agents need outbound HTTPS access to container registries and the control plane

### Control Plane Security

- **JWT Secret**: Use a strong, randomly generated `JWT_SECRET` in production
- **Database**: Use strong passwords and restrict database access to the control plane only
- **HTTPS**: Always use HTTPS in production with valid TLS certificates
- **Environment Variables**: Never commit `.env` files or secrets to version control
- **SMTP Credentials**: Store email credentials securely

### Container Registry Credentials

- **Private Registries**: If using private registries, store credentials securely
- **Credential Rotation**: Regularly rotate registry credentials
- **Least Privilege**: Use read-only credentials where possible

## Known Security Considerations

### Docker Agent

- Requires access to Docker socket (privileged operation)
- Can execute docker-compose commands (can modify running containers)
- Has access to docker-compose.yml files (may contain sensitive configuration)

### Kubernetes Agent

- Requires RBAC permissions to read and update Deployments/StatefulSets
- Can modify Kubernetes resources in configured namespaces

### Control Plane

- Stores agent API keys (hashed)
- Stores container registry credentials (encrypted)
- Executes deployment commands via agents

## Security Best Practices

1. **Network Segmentation**: Run agents in isolated network segments
2. **Audit Logging**: Enable and monitor audit logs for all deployments
3. **Access Control**: Limit control plane access to authorized users only
4. **Regular Updates**: Keep Tiaki and all dependencies up to date
5. **Vulnerability Scanning**: Enable Trivy integration for container scanning
6. **Backup**: Regularly backup the control plane database
7. **Monitoring**: Monitor agent and control plane logs for suspicious activity

## Disclosure Policy

When we receive a security bug report, we will:

- Confirm the receipt of your vulnerability report
- Provide an estimated timeline for a fix
- Notify you when the vulnerability is fixed
- Credit you in the security advisory (if desired)

We ask that you:

- Give us reasonable time to fix the vulnerability before public disclosure
- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Do not exploit the vulnerability beyond what is necessary to demonstrate it

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or open an issue.
