'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/data/FileUpload';
import { useRouter } from 'next/navigation';
import { connectDatabase } from '@/lib/api';

type Tab = 'upload' | 'database';

function parseConnectionUrl(url: string): {
  host: string; port: number; database: string; username: string; password: string; db_type: string;
} | null {
  try {
    // Formats supported:
    // postgresql://user:pass@host:5432/dbname
    // postgres://user:pass@host:5432/dbname?sslmode=require
    // mysql://user:pass@host:3306/dbname
    const match = url.match(
      /^(postgres(?:ql)?|mysql|mssql|sqlite):\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?\s]+)/i
    );
    if (!match) return null;

    const [, protocol, username, password, host, port, database] = match;
    const dbType = protocol.toLowerCase().startsWith('postgres') ? 'postgresql' : protocol.toLowerCase();
    const defaultPort = dbType === 'postgresql' ? 5432 : dbType === 'mysql' ? 3306 : 5432;

    return {
      host,
      port: port ? parseInt(port) : defaultPort,
      database,
      username: decodeURIComponent(username),
      password: decodeURIComponent(password),
      db_type: dbType,
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [dbUrl, setDbUrl] = useState('');
  const [dbConnecting, setDbConnecting] = useState(false);
  const [dbError, setDbError] = useState('');
  const [dbConnected, setDbConnected] = useState<any>(null);
  const router = useRouter();

  const handleUploadSuccess = (data: any) => {
    setUploadedData(data);
    if (data.session_id && typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
    }
    if (data.files && data.files.length > 0) {
      localStorage.setItem('activeFileId', data.files[0].file_id);
    }
  };

  const handleConnectDatabase = async () => {
    setDbError('');
    const parsed = parseConnectionUrl(dbUrl.trim());
    if (!parsed) {
      setDbError('Invalid URL. Use: postgresql://user:password@host:5432/database');
      return;
    }

    setDbConnecting(true);
    try {
      // Ensure we have a session ID
      let sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
      }

      const result = await connectDatabase(sessionId, parsed);
      if (result.success) {
        setDbConnected(result);
        if (result.connection_id) {
          localStorage.setItem('activeConnectionId', result.connection_id);
        }
      } else {
        setDbError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setDbError(err.message || 'Failed to connect');
    } finally {
      setDbConnecting(false);
    }
  };

  const handleLaunchAgent = () => {
    router.push('/agent');
  };

  const hasData = uploadedData || dbConnected;

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center">
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-subtle)] border border-[var(--border-color)] text-sm text-[var(--accent)] font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          AI-Powered Analysis
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Your AI{' '}
          <span className="gradient-text">Data Scientist</span>
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
          Upload a file or connect your database. Ask questions in plain English.
          Get instant analysis, visualizations, and ML insights.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="modern-card overflow-hidden">
          {/* Tabs */}
          {!hasData && (
            <div className="flex border-b border-[var(--border-color)]">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all border-b-2 ${
                  activeTab === 'upload'
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload File
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all border-b-2 ${
                  activeTab === 'database'
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                Connect Database
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-8">
            {hasData ? (
              /* ── Success State ── */
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  {dbConnected ? 'Database Connected' : 'Data Ready'}
                </h3>

                {/* Stats */}
                <div className="flex justify-center gap-6 mb-6 text-sm">
                  {dbConnected ? (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">
                          {dbConnected.tables_count || '—'}
                        </div>
                        <div className="text-[var(--text-tertiary)]">Tables</div>
                      </div>
                      <div className="w-px bg-[var(--border-color)]" />
                      <div className="text-center">
                        <div className="text-sm font-mono font-medium text-[var(--text-primary)] truncate max-w-[120px]">
                          {dbConnected.connection_id?.slice(0, 8) || 'Active'}
                        </div>
                        <div className="text-[var(--text-tertiary)]">Connection</div>
                      </div>
                    </>
                  ) : uploadedData?.files ? (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">{uploadedData.files.length}</div>
                        <div className="text-[var(--text-tertiary)]">Files</div>
                      </div>
                      <div className="w-px bg-[var(--border-color)]" />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">
                          {uploadedData.files.reduce((sum: number, f: any) => sum + f.rows, 0).toLocaleString()}
                        </div>
                        <div className="text-[var(--text-tertiary)]">Rows</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">{uploadedData?.rows?.toLocaleString()}</div>
                        <div className="text-[var(--text-tertiary)]">Rows</div>
                      </div>
                      <div className="w-px bg-[var(--border-color)]" />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-primary)]">{uploadedData?.columns}</div>
                        <div className="text-[var(--text-tertiary)]">Columns</div>
                      </div>
                    </>
                  )}
                </div>

                <button onClick={handleLaunchAgent} className="w-full btn btn-primary text-base py-3 animate-pulse-glow">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Launch Agent
                </button>
              </div>
            ) : activeTab === 'upload' ? (
              /* ── File Upload Tab ── */
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Upload Your Data</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">CSV, Excel, or JSON — up to 50MB</p>
                  </div>
                </div>
                <FileUpload onUploadSuccess={handleUploadSuccess} />
              </>
            ) : (
              /* ── Database Tab ── */
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Connect Database</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">PostgreSQL, MySQL, or MSSQL</p>
                  </div>
                </div>

                {/* URL Input */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Connection URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dbUrl}
                        onChange={(e) => { setDbUrl(e.target.value); setDbError(''); }}
                        placeholder="postgresql://user:password@host:5432/database"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all"
                        onKeyDown={(e) => { if (e.key === 'Enter' && dbUrl.trim()) handleConnectDatabase(); }}
                      />
                      {dbUrl && (
                        <button
                          onClick={() => { setDbUrl(''); setDbError(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {dbError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--error-bg)] text-sm">
                      <svg className="w-4 h-4 text-[var(--error)] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[var(--error)]">{dbError}</span>
                    </div>
                  )}

                  {/* URL format hints */}
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Supported formats</p>
                    <div className="space-y-1">
                      {[
                        'postgresql://user:pass@localhost:5432/mydb',
                        'mysql://user:pass@host:3306/mydb',
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setDbUrl(example)}
                          className="block w-full text-left text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors truncate"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleConnectDatabase}
                    disabled={!dbUrl.trim() || dbConnecting}
                    className="w-full btn btn-primary py-3 disabled:opacity-50"
                  >
                    {dbConnecting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Connect
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      {!hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-2xl w-full animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: '📊', title: 'Auto Analysis', desc: 'Get instant statistical summaries' },
            { icon: '📈', title: 'Smart Charts', desc: 'AI-generated visualizations' },
            { icon: '🤖', title: 'ML Models', desc: 'Train models with plain English' },
          ].map((card) => (
            <div
              key={card.title}
              className="modern-card p-4 text-center hover:border-[var(--accent)] transition-colors cursor-default"
            >
              <span className="text-2xl mb-2 block">{card.icon}</span>
              <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1">{card.title}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">{card.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
