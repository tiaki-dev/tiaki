import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { Mail, CheckCircle, XCircle, Bell, Webhook } from 'lucide-react'

export default function SettingsPage() {
  const { data: settings } = trpc.settings.get.useQuery()
  const [testEmail, setTestEmail] = useState('')
  const [testEmailResult, setTestEmailResult] = useState<'success' | 'error' | null>(null)
  const [testNtfyResult, setTestNtfyResult] = useState<'success' | 'error' | null>(null)

  const sendTestMail = trpc.notifications.sendTestMail.useMutation({
    onSuccess: () => setTestEmailResult('success'),
    onError: () => setTestEmailResult('error'),
  })

  const sendTestNtfy = trpc.notifications.sendTestNtfy.useMutation({
    onSuccess: () => setTestNtfyResult('success'),
    onError: () => setTestNtfyResult('error'),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-medium">Notifications</h2>
        </div>

        {/* Email */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Email
          </h3>

          {settings?.smtp.configured ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              SMTP configured ({settings.smtp.host}:{settings.smtp.port})
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <XCircle className="w-4 h-4" />
              Not configured — set <code className="bg-muted px-1 rounded">SMTP_HOST</code> environment variable.
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="test@example.com"
              className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm"
              value={testEmail}
              onChange={(e) => { setTestEmail(e.target.value); setTestEmailResult(null) }}
            />
            <button
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
              disabled={!testEmail || sendTestMail.isPending}
              onClick={() => sendTestMail.mutate({ recipient: testEmail })}
            >
              {sendTestMail.isPending ? 'Sending…' : 'Send Test'}
            </button>
          </div>

          {testEmailResult === 'success' && <p className="text-sm text-green-400">Test email sent successfully!</p>}
          {testEmailResult === 'error' && <p className="text-sm text-destructive">{sendTestMail.error?.message ?? 'Failed to send'}</p>}
        </div>

        <div className="border-t border-border" />

        {/* ntfy */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            ntfy Push
          </h3>

          {settings?.ntfy.configured ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              Configured — {settings.ntfy.url}/{settings.ntfy.topic}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle className="w-4 h-4" />
                Not configured — set <code className="bg-muted px-1 rounded">NTFY_URL</code> and <code className="bg-muted px-1 rounded">NTFY_TOPIC</code>.
              </div>
            </div>
          )}

          <button
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
            disabled={!settings?.ntfy.configured || sendTestNtfy.isPending}
            onClick={() => { setTestNtfyResult(null); sendTestNtfy.mutate() }}
          >
            {sendTestNtfy.isPending ? 'Sending…' : 'Send Test Notification'}
          </button>

          {testNtfyResult === 'success' && <p className="text-sm text-green-400">Test notification sent!</p>}
          {testNtfyResult === 'error' && <p className="text-sm text-destructive">{sendTestNtfy.error?.message ?? 'Failed to send'}</p>}
        </div>

        <div className="border-t border-border" />

        {/* Webhook */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Webhook className="w-4 h-4 text-muted-foreground" />
            Webhook
          </h3>

          {settings?.webhook?.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                {settings.webhook.urls.length} URL{settings.webhook.urls.length !== 1 ? 's' : ''} configured
              </div>
              <ul className="space-y-1">
                {settings.webhook.urls.map((url) => (
                  <li key={url} className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded truncate">
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle className="w-4 h-4" />
                Not configured — set <code className="bg-muted px-1 rounded">WEBHOOK_URLS</code> (comma-separated).
              </div>
              <p className="text-xs text-muted-foreground">
                Tiaki POSTs <code className="bg-muted px-1 rounded">{'{"event":"updates.found",...}'}</code> when new pending updates are found.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scan Schedule */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-2">
        <h2 className="font-medium">Scan Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Current interval: <code className="bg-muted px-1 rounded">{settings?.scanInterval ?? '…'}</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Change via the SCAN_INTERVAL environment variable (cron syntax).
        </p>
      </div>

      {/* Container Exclusion */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <h2 className="font-medium">Container Exclusion</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground font-mono text-xs">Docker:</span>{' '}
            Add label <code className="bg-muted px-1 rounded">tiaki.enable=false</code> to any container to exclude it from monitoring.
          </p>
          <p>
            <span className="text-foreground font-mono text-xs">K8s pods:</span>{' '}
            Add annotation <code className="bg-muted px-1 rounded">tiaki.io/enable: "false"</code> to exclude a pod.
          </p>
          <p>
            <span className="text-foreground font-mono text-xs">K8s namespaces:</span>{' '}
            Set <code className="bg-muted px-1 rounded">EXCLUDE_NAMESPACES=kube-system,monitoring</code> on the agent to skip entire namespaces.
          </p>
        </div>
      </div>
    </div>
  )
}
