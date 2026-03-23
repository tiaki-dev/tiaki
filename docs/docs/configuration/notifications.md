---
sidebar_position: 5
---

# Email Notifications

Tiaki can send email notifications when new container updates are detected and when deployments succeed or fail.

## Configuration

Set the following SMTP environment variables in your `.env` file:

```env title=".env"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=tiaki@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=tiaki@example.com
```

Restart the control plane after changing these values:

```bash
docker compose restart server
```

## Provider examples

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key
SMTP_FROM=tiaki@your-domain.com
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=tiaki@your-domain.com
```

### Gmail (App Password)

:::warning Use an App Password
Regular Gmail passwords don't work. You need to create an [App Password](https://support.google.com/accounts/answer/185833) with 2FA enabled on your account.
:::

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-address@gmail.com
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=tiaki@your-verified-domain.com
```

## Configuring notification recipients

Once SMTP is configured, set notification recipients in the Tiaki dashboard under **Settings → Notifications**.

You can configure:
- Email addresses to notify about new updates
- Email addresses to notify on deployment results (success/failure)

## Disabling notifications

Remove or comment out all `SMTP_*` variables to disable email notifications. Tiaki will continue to work normally without them.
