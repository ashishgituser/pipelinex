import { Component, OnInit, Sanitizer } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectionService } from '../services/selection.service';
import { GitlabService } from '../services/gitlab.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="logs" *ngIf="job">
    <div class="log-head">
      <div class="left">
        <div class="job-title">{{ job.name }}</div>
        <div class="job-sub">job #{{ job.id }} · status: <strong>{{ job.status }}</strong></div>
      </div>
      <div class="actions">
        <button class="refresh" (click)="reload()">⟳ Refresh</button>
      </div>
    </div>

    <div *ngIf="loading" class="muted">Loading logs…</div>

    <div class="log-box" *ngIf="!loading">
      <pre [innerHTML]="formattedLog"></pre>
    </div>
  </section>
  `,
  styles: [`
    .logs { padding:18px; border-top:1px solid rgba(255,255,255,0.02); }
    .log-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .job-title { font-weight:800; color:#eaf4ff; font-size:1.1rem; }
    .job-sub { color:#9fb7d6; font-size:13px; }
    .log-box {
      background:#000d13;
      border-radius:8px;
      padding:14px;
      color:#cfeaf9;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size:13px;
      line-height:1.5em;
      max-height:65vh;
      overflow:auto;
      border:1px solid rgba(255,255,255,0.05);
      box-shadow:inset 0 0 10px rgba(0,0,0,0.3);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .muted { color:#8faac6; }
    .refresh {
      background:transparent;
      border:1px solid rgba(255,255,255,0.1);
      color:#9fb7d6;
      padding:6px 10px;
      border-radius:8px;
      cursor:pointer;
      transition:all .2s ease;
    }
    .refresh:hover {
      background:rgba(255,255,255,0.05);
      color:#eaf4ff;
    }

    /* log syntax styling */
    .log-timestamp { color:#8be9fd; }
    .log-info { color:#50fa7b; }
    .log-warn { color:#f1fa8c; }
    .log-error { color:#ff5555; font-weight:600; }
  `]
})
export class LogViewerComponent implements OnInit {
  job: any = null;
  log = '';
  formattedLog: SafeHtml = '';
  loading = false;

  constructor(
    private sel: SelectionService,
    private git: GitlabService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.sel.selectedJob$.subscribe(j => {
      this.job = j;
      if (j && this.sel.selectedProject$.value) {
        this.loadLog(this.sel.selectedProject$.value.id, j.id);
      } else {
        this.log = '';
        this.formattedLog = '';
      }
    });
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

        this.loading = false;
      },
      error: () => {
        this.log = 'Failed to load logs';
        this.formattedLog = this.log;
        this.loading = false;
      }
    });
  }

  reload() {
    if (this.job && this.sel.selectedProject$.value) {
      this.loadLog(this.sel.selectedProject$.value.id, this.job.id);
    }
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
