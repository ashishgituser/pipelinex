import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectionService } from '../services/selection.service';
import { GitlabService } from '../services/gitlab.service';
import { StreamingLogService, StreamingResponse } from '../services/streaming-log.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="logs-summary">
    <div class="log-head">
      <div class="left" *ngIf="job">
        <div class="job-title">{{ job.name }}</div>
        <div class="job-sub">#{{ job.id }} · <span class="status" [ngClass]="job.status">{{ job.status }}</span></div>
      </div>
      <div class="left" *ngIf="!job">
        <div class="job-title">Log Summary</div>
        <div class="job-sub">Select a job to view logs</div>
      </div>
      <div class="actions" *ngIf="job">
        <button class="refresh" (click)="reload()" [disabled]="loading || isStreaming">
          <span *ngIf="!loading && !isStreaming">⟳</span>
          <span *ngIf="loading || isStreaming">…</span>
        </button>
        <button class="stream" (click)="startStreaming()" [disabled]="isStreaming || !job">
          <span *ngIf="!isStreaming">🔥</span>
          <span *ngIf="isStreaming">…</span>
        </button>
        <button class="expand" (click)="expandLogs()">⤢</button>
      </div>
    </div>

    <!-- Status indicator for streaming -->
    <div class="status-bar" *ngIf="statusMessage">
      <div class="status-indicator" [ngClass]="statusClass">
        {{ statusMessage }}
      </div>
    </div>

    <!-- Regular log summary (non-streaming) -->
    <div class="log-summary" *ngIf="job && !loading && !isStreaming && !streamingSummary">
      <div class="log-preview">
        <pre [innerHTML]="formattedLogSummary"></pre>
      </div>
    </div>

    <!-- Streaming log summary -->
    <div class="streaming-summary" *ngIf="job && (isStreaming || streamingSummary)">
      <div class="streaming-preview">
        <pre>{{ streamingSummary }}<span class="cursor" *ngIf="isStreaming">|</span></pre>
      </div>
    </div>

    <div *ngIf="loading" class="loading-state">
      <div class="spinner"></div>
      <div class="muted">Loading logs…</div>
    </div>

    <div *ngIf="errorMessage" class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ errorMessage }}</div>
    </div>

    <div *ngIf="!job" class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">Click on a job above to view its logs</div>
    </div>
  </section>
  `,
  styles: [`
    .logs-summary { 
      padding: 16px; 
      height: 100%; 
      display: flex; 
      flex-direction: column;
      overflow: hidden;
    }
    
    .log-head { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 12px;
      flex-shrink: 0;
    }
    
    .job-title { 
      font-weight: 700; 
      color: #eaf4ff; 
      font-size: 14px;
      margin-bottom: 2px;
    }
    
    .job-sub { 
      color: #9fb7d6; 
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .status {
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }
    
    .status.success { 
      background: #def6e8; 
      color: #176b3a; 
    }
    
    .status.failed { 
      background: #fdecec; 
      color: #9b2a2a; 
    }
    
    .status.running { 
      background: #fff7e6; 
      color: #a46e00; 
    }
    
    .actions {
      display: flex;
      gap: 6px;
    }
    
    .refresh, .stream, .expand {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.08);
      color: #9fb7d6;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 12px;
      min-width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .refresh:hover, .stream:hover, .expand:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.15);
      color: #eaf4ff;
    }
    
    .stream {
      border-color: rgba(255,165,0,0.3);
      color: #ffa500;
    }
    
    .stream:hover {
      background: rgba(255,165,0,0.1);
      border-color: rgba(255,165,0,0.6);
      color: #ffb533;
    }
    
    .refresh:disabled, .stream:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .status-bar {
      margin-bottom: 8px;
      flex-shrink: 0;
    }
    
    .status-indicator {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-indicator.loading {
      background: rgba(255,165,0,0.15);
      color: #ffa500;
      border: 1px solid rgba(255,165,0,0.3);
    }
    
    .status-indicator.complete {
      background: rgba(80,250,123,0.15);
      color: #50fa7b;
      border: 1px solid rgba(80,250,123,0.3);
    }
    
    .status-indicator.error {
      background: rgba(255,85,85,0.15);
      color: #ff5555;
      border: 1px solid rgba(255,85,85,0.3);
    }
    
    .log-summary, .streaming-summary {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .log-preview, .streaming-preview {
      flex: 1;
      background: #000d13;
      border-radius: 8px;
      padding: 12px;
      color: #cfeaf9;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 1.4;
      overflow: auto;
      border: 1px solid rgba(255,255,255,0.05);
      box-shadow: inset 0 0 8px rgba(0,0,0,0.4);
    }
    
    .streaming-preview {
      border-color: rgba(255,165,0,0.2);
      background: linear-gradient(180deg, #001318, #000d13);
    }
    
    .log-preview pre, .streaming-preview pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .cursor {
      color: #ffa500;
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    
    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top: 2px solid #1f6feb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .empty-state, .error-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #8faac6;
    }
    
    .empty-icon, .error-icon {
      font-size: 32px;
      opacity: 0.5;
    }
    
    .error-icon {
      color: #ff5555;
    }
    
    .empty-text, .error-text {
      font-size: 13px;
      text-align: center;
    }
    
    .error-text {
      color: #ff8888;
    }
    
    .muted { 
      color: #8faac6; 
      font-size: 12px;
    }

    /* Custom scrollbar */
    .log-preview::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    
    .log-preview::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.02);
      border-radius: 3px;
    }
    
    .log-preview::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
    }
    
    .log-preview::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.2);
    }

    /* Log syntax styling */
    .log-timestamp { color: #8be9fd; }
    .log-info { color: #50fa7b; }
    .log-warn { color: #f1fa8c; }
    .log-error { color: #ff5555; font-weight: 600; }
  `]
})
export class LogViewerComponent implements OnInit, OnDestroy {
  job: any = null;
  project: any = null;
  log = '';
  formattedLog: SafeHtml = '';
  formattedLogSummary: SafeHtml = '';
  streamingSummary = '';
  loading = false;
  isStreaming = false;
  statusMessage = '';
  statusClass = '';
  errorMessage = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private sel: SelectionService,
    private git: GitlabService,
    private streamingLogService: StreamingLogService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Subscribe to selected job changes
    this.subscriptions.push(
      this.sel.selectedJob$.subscribe(j => {
        this.job = j;
        this.resetState();
        if (j && this.project) {
          this.loadLog(this.project.id, j.id);
        }
      })
    );

    // Subscribe to selected project changes
    this.subscriptions.push(
      this.sel.selectedProject$.subscribe(p => {
        this.project = p;
        this.resetState();
        if (this.job && p) {
          this.loadLog(p.id, this.job.id);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadLog(projectId: number, jobId: number) {
    this.loading = true;
    this.git.getJobLog(projectId, jobId).subscribe({
      next: res => {
        // Handle both object and string responses
        const raw = typeof res.log === 'string' ? res.log : (res.log?.summary || JSON.stringify(res.log, null, 2));

        // Format and colorize
        this.log = raw;
        this.formattedLog = this.sanitizer.bypassSecurityTrustHtml(this.colorizeLog(raw));
        
        // Create summary version (first 20 lines and last 10 lines)
        const lines = raw.split('\n');
        let summary = '';
        if (lines.length > 30) {
          const firstLines = lines.slice(0, 20).join('\n');
          const lastLines = lines.slice(-10).join('\n');
          summary = `${firstLines}\n\n... (${lines.length - 30} lines omitted) ...\n\n${lastLines}`;
        } else {
          summary = raw;
        }
        this.formattedLogSummary = this.sanitizer.bypassSecurityTrustHtml(this.colorizeLog(summary));

        this.loading = false;
      },
      error: () => {
        this.log = 'Failed to load logs';
        this.formattedLog = this.log;
        this.formattedLogSummary = this.log;
        this.loading = false;
      }
    });
  }

  reload() {
    if (this.job && this.project) {
      this.loadLog(this.project.id, this.job.id);
    }
  }

  startStreaming() {
    if (!this.job || !this.project || this.isStreaming) return;

    this.resetStreamingState();
    this.isStreaming = true;
    this.statusMessage = 'Initializing streaming...';
    this.statusClass = 'loading';

    const streamSubscription = this.streamingLogService
      .streamLogSummary(this.project.id, this.job.id)
      .subscribe({
        next: (response: StreamingResponse) => {
          this.handleStreamingResponse(response);
        },
        error: (error) => {
          this.handleStreamingError(error);
        },
        complete: () => {
          this.isStreaming = false;
          this.statusMessage = 'Streaming complete';
          this.statusClass = 'complete';
        }
      });

    this.subscriptions.push(streamSubscription);
  }

  expandLogs() {
    // This could open logs in a modal or new tab
    // For now, we'll just scroll to top of the summary
    const logPreview = document.querySelector('.log-preview, .streaming-preview');
    if (logPreview) {
      logPreview.scrollTop = 0;
    }
  }

  private resetState() {
    this.log = '';
    this.formattedLog = '';
    this.formattedLogSummary = '';
    this.resetStreamingState();
  }

  private resetStreamingState() {
    this.streamingSummary = '';
    this.statusMessage = '';
    this.statusClass = '';
    this.errorMessage = '';
    this.isStreaming = false;
  }

  private handleStreamingResponse(response: StreamingResponse) {
    switch (response.type) {
      case 'status':
        this.statusMessage = response.message || 'Processing...';
        this.statusClass = 'loading';
        break;
        
      case 'token':
        // Append each token to build the summary
        this.streamingSummary += response.content || '';
        break;
        
      case 'complete':
        this.isStreaming = false;
        this.statusMessage = response.message || 'Complete';
        this.statusClass = 'complete';
        
        // If a complete summary is provided, use it
        if (response.summary) {
          this.streamingSummary = response.summary;
        }
        break;
        
      case 'error':
        this.handleStreamingError(response.message || 'Unknown error occurred');
        break;
    }
  }

  private handleStreamingError(error: any) {
    this.isStreaming = false;
    this.errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred during streaming';
    this.statusMessage = 'Streaming failed';
    this.statusClass = 'error';
  }

  /** Add color formatting for timestamps, INFO, WARN, ERROR */
  colorizeLog(log: string): string {
    return log
      .replace(/\n/g, '<br>')
      .replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/g, '<span class="log-timestamp">$1</span>')
      .replace(/\b(INFO|Success|Done)\b/gi, '<span class="log-info">$1</span>')
      .replace(/\b(WARN|Warning)\b/gi, '<span class="log-warn">$1</span>')
      .replace(/\b(ERROR|Fail|Exception)\b/gi, '<span class="log-error">$1</span>');
  }
}
