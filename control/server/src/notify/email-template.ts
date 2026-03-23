/**
 * HTML email templates for Tiaki notifications
 */

/** Escape HTML special characters to prevent XSS via injected content */
function esc(value: string | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface UpdateEmailData {
  updates: Array<{
    containerName: string
    image: string
    currentTag: string
    latestTag: string
    agentName: string
    vulnerabilities: number | undefined
    releaseNotes: string | undefined
  }>
  controlPlaneUrl: string
}

export function renderUpdateNotificationEmail(data: UpdateEmailData): string {
  const updateRows = data.updates
    .map(
      (u) => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">
          ${esc(u.containerName)}
        </div>
        <div style="font-size: 13px; color: #6b7280; font-family: 'Courier New', monospace;">
          ${esc(u.image)}
        </div>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 8px;">
          <span style="font-family: 'Courier New', monospace; color: #6b7280; font-size: 14px;">
            ${esc(u.currentTag)}
          </span>
          <span style="color: #9ca3af;">→</span>
          <span style="font-family: 'Courier New', monospace; color: #059669; font-weight: 600; font-size: 14px;">
            ${esc(u.latestTag)}
          </span>
        </div>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-size: 14px; color: #6b7280;">
          ${esc(u.agentName)}
        </div>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${u.vulnerabilities !== undefined
          ? u.vulnerabilities > 0
            ? `<span style="display: inline-block; padding: 4px 12px; background: #fef2f2; color: #dc2626; border-radius: 12px; font-size: 12px; font-weight: 600;">
                  ${u.vulnerabilities} vuln${u.vulnerabilities > 1 ? 's' : ''}
                </span>`
            : `<span style="display: inline-block; padding: 4px 12px; background: #f0fdf4; color: #16a34a; border-radius: 12px; font-size: 12px; font-weight: 600;">
                  Clean
                </span>`
          : '<span style="color: #9ca3af; font-size: 13px;">—</span>'
        }
      </td>
    </tr>
    ${u.releaseNotes
          ? `
    <tr>
      <td colspan="4" style="padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
          <strong style="color: #374151;">Release Notes:</strong><br/>
          ${esc(u.releaseNotes)}
        </div>
      </td>
    </tr>
    `
          : ''
        }
  `,
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiaki: Container Updates Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <table role="presentation">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle;">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #5B8DEF 0%, #60A5FA 100%); border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; box-shadow: 0 2px 4px rgba(91, 141, 239, 0.3);">
                            <span style="color: white; font-size: 22px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">T</span>
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                            Tiaki
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">
                ${data.updates.length} Container Update${data.updates.length > 1 ? 's' : ''} Available
              </h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.5;">
                New versions are available for your containers. Review and approve updates in your Tiaki dashboard.
              </p>

              <!-- Updates Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                      Container
                    </th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                      Version
                    </th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                      Host
                    </th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                      Security
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${updateRows}
                </tbody>
              </table>

              <!-- CTA Button -->
              <div style="margin-top: 32px; text-align: center;">
                <a href="${esc(data.controlPlaneUrl)}/updates" 
                   style="display: inline-block; padding: 12px 32px; background: #5B8DEF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Review Updates
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                You're receiving this email because you have email notifications enabled in Tiaki.
                <br/>
                <a href="${esc(data.controlPlaneUrl)}/settings" style="color: #5B8DEF; text-decoration: none;">
                  Manage notification preferences
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function renderTestEmail(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiaki: Test Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; background: #5B8DEF; border-radius: 6px; display: inline-block; text-align: center; line-height: 32px;">
                      <span style="color: white; font-size: 20px; font-weight: bold;">T</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                      Tiaki
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <div style="text-align: center; padding: 24px 0;">
                <div style="display: inline-block; padding: 16px; background: #f0fdf4; border-radius: 50%; margin-bottom: 16px;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">
                  SMTP Configuration Successful
                </h2>
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  Your Tiaki email notifications are working correctly. You'll receive updates about container changes at this address.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                This is a test email from Tiaki
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
