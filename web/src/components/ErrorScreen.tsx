import { AlertCircle } from 'lucide-react'

interface Props {
  error: string
  onRetry?: () => void
}

export default function ErrorScreen({ error, onRetry }: Props) {

  const isGASNotDeployed = error.includes('GAS not deployed');
  const isGASRestricted = error.includes('GAS access restricted');

  return (
    <div className="login-screen">
      <div style={{ textAlign: 'center', maxWidth: 500 }}>
        <AlertCircle size={48} style={{ color: '#EF4444', marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', marginBottom: 8 }}>Backend Configuration Error</h1>
        <p style={{ fontSize: 14, color: '#A5B4FC', marginBottom: 24 }}>{error}</p>

        {isGASNotDeployed && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 10 }}>Fix: Deploy Google Apps Script</div>
            <ol style={{ fontSize: 12, color: '#A5B4FC', margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Open terminal in the project root</li>
              <li>Run: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>./deploy.sh</code></li>
              <li>Follow the Google authentication prompts</li>
              <li>Copy the deployment URL into <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>VITE_API_URL</code> in <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>.env</code></li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}

        {isGASRestricted && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 10 }}>Fix: Update GAS Deployment Access</div>
            <ol style={{ fontSize: 12, color: '#A5B4FC', margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Go to <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#818CF8', textDecoration: 'underline' }}>script.google.com</a></li>
              <li>Select the "FinTracker" project</li>
              <li>Click <strong>Deploy</strong> → <strong>Manage deployments</strong></li>
              <li>Click the edit icon (pencil) on the deployment</li>
              <li>Set <strong>"Who has access"</strong> to <strong>"Anyone"</strong></li>
              <li>Click <strong>Update</strong> and refresh this page</li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: '#2563EB',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2563EB'}
            >
              🔄 Retry
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#FFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            🔁 Refresh Page
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#64748B', marginTop: 16 }}>
          Need more help? Check the browser console (F12) for detailed error logs
        </p>
      </div>
    </div>
  )
}
