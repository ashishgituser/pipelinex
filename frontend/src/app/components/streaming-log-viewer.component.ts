// Angular component to display streaming log summary
// streaming-log.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StreamingLogService, StreamingResponse } from '../services/streaming-log.service';
import { SelectionService } from '../services/selection.service';

@Component({
  selector: 'app-streaming-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="streaming-log-container">
      <!-- Header Section -->
      <div class="stream-head">
        <div class="left" *ngIf="job">
          <div class="job-title">{{ job.name }} - AI Summary</div>
          <div class="job-sub">#{{ job.id }} · <span class="status" [class]="'status ' + job.status">{{ job.status }}</span></div>
        </div>
        <div class="left" *ngIf="!job">
          <div class="job-title">AI Log Analysis</div>
          <div class="job-sub">Select a job to generate AI summary</div>
        </div>
      </div>
      
      <!-- Streaming Content - Shows only when job is selected -->
      <div class="summary-content" *ngIf="job">
        <div class="streaming-text" [class.streaming]="isStreaming">
          <div class="formatted-summary" [innerHTML]="formattedSummary"></div>
          <span class="cursor" *ngIf="isStreaming">█</span>
        </div>
      </div>
      
      <!-- Empty State -->
      <div *ngIf="!job" class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-text">Select a job to see AI log analysis</div>
      </div>
    </section>
  `,
  styles: [`
    .streaming-log-container {
      padding: 16px;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: transparent;
    }
    
    .stream-head {
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
    
    .status.success { background: #def6e8; color: #176b3a; }
    .status.failed { background: #fdecec; color: #9b2a2a; }
    .status.running { background: #fff7e6; color: #a46e00; }
    

    
    .summary-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .streaming-text {
      flex: 1;
      background: linear-gradient(180deg, #001318, #000d13);
      border-radius: 8px;
      padding: 16px;
      color: #e0f7fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      overflow: auto;
      border: 1px solid rgba(76,175,80,0.2);
      box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
      position: relative;
    }
    
    .streaming-text.streaming {
      border-color: rgba(76,175,80,0.4);
      box-shadow: 0 0 20px rgba(76,175,80,0.1);
    }
    
    .formatted-summary {
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .cursor {
      color: #4caf50;
      font-weight: bold;
      animation: pulse 1.2s infinite;
      margin-left: 2px;
    }
    
    @keyframes pulse {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
    
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #8faac6;
    }
    
    .empty-icon {
      font-size: 32px;
      opacity: 0.7;
    }
    
    .empty-text {
      font-size: 13px;
      text-align: center;
      line-height: 1.5;
    }
    
    /* Custom scrollbar */
    .streaming-text::-webkit-scrollbar {
      width: 6px;
    }
    
    .streaming-text::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.02);
      border-radius: 3px;
    }
    
    .streaming-text::-webkit-scrollbar-thumb {
      background: rgba(76,175,80,0.3);
      border-radius: 3px;
    }
    
    .streaming-text::-webkit-scrollbar-thumb:hover {
      background: rgba(76,175,80,0.5);
    }

    /* Markdown-like formatting for LLM responses */
    .formatted-summary h1, .formatted-summary h2, .formatted-summary h3 {
      color: #4caf50;
      margin: 16px 0 8px 0;
      font-weight: 600;
    }
    
    .formatted-summary h1 { font-size: 16px; }
    .formatted-summary h2 { font-size: 15px; }
    .formatted-summary h3 { font-size: 14px; }
    
    .formatted-summary strong {
      color: #66bb6a;
      font-weight: 600;
    }
    
    .formatted-summary code {
      background: rgba(76,175,80,0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      color: #81c784;
    }
    
    .formatted-summary ul, .formatted-summary ol {
      margin: 8px 0;
      padding-left: 20px;
    }
    
    .formatted-summary li {
      margin: 4px 0;
    }
  `]
})
export class StreamingLogComponent implements OnInit, OnDestroy {
  job: any = null;
  project: any = null;
  summary = '';
  formattedSummary = '';
  isStreaming = false;
  errorMessage = '';
  canStream = false;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private streamingLogService: StreamingLogService,
    private selectionService: SelectionService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}
  
  ngOnInit() {
    // Subscribe to selected job changes - AUTO START STREAMING
    this.subscriptions.push(
      this.selectionService.selectedJob$.subscribe(job => {
        this.job = job;
        this.updateCanStream();
        if (!job) {
          this.clearSummary();
        } else if (this.project) {
          // AUTO-START streaming immediately when job is selected
          console.log('🚀 AUTO-STARTING stream for job:', job.name);
          this.autoStartStreaming();
        }
      })
    );

    // Subscribe to selected project changes  
    this.subscriptions.push(
      this.selectionService.selectedProject$.subscribe(project => {
        this.project = project;
        this.updateCanStream();
        // If we already have a job selected, start streaming
        if (this.job && project) {
          console.log('🚀 AUTO-STARTING stream for project change');
          this.autoStartStreaming();
        }
      })
    );
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  clearSummary() {
    if (this.isStreaming) return;
    
    this.summary = '';
    this.formattedSummary = '';
    this.errorMessage = '';
  }

  autoStartStreaming() {
    // Auto-start streaming without any UI indicators - just pure streaming
    if (this.isStreaming || !this.canStream) return;
    
    console.log('🚀 AUTO-START: Silent streaming for job:', this.job.name);
    
    // Clear previous content silently
    this.summary = '';
    this.formattedSummary = '';
    this.errorMessage = '';
    
    // Start streaming immediately - no loading states, no status messages
    this.isStreaming = true;
    
    // Use the aggressive real-time streaming for best results
    const streamSub = this.streamingLogService
      .streamLogSummaryRealTime(this.project.id, this.job.id)
      .subscribe({
        next: (response: StreamingResponse) => {
          // Only handle token responses - ignore status messages
          if (response.type === 'token') {
            this.summary += response.content || '';
            this.formattedSummary = this.formatSummaryText(this.summary);
            this.cdr.detectChanges();
            this.scrollToBottomImmediate();
          }
        },
        error: (error) => {
          console.error('🔥 AUTO-STREAM error:', error);
          this.isStreaming = false;
          this.cdr.detectChanges();
        },
        complete: () => {
          console.log('🔥 AUTO-STREAM completed');
          this.isStreaming = false;
          this.cdr.detectChanges();
        }
      });
    
    this.subscriptions.push(streamSub);
  }

  private updateCanStream() {
    this.canStream = !!(this.job && this.project);
  }

  private formatSummaryText(text: string): string {
    return text
      // Convert markdown-style headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      
      // Convert bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      
      // Convert inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Convert bullet points
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      
      // Convert numbered lists
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      
      // Convert line breaks
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom() {
    // Auto-scroll to bottom during streaming
    setTimeout(() => {
      const streamingText = document.querySelector('.streaming-text');
      if (streamingText) {
        streamingText.scrollTop = streamingText.scrollHeight;
      }
    }, 10);
  }

  private scrollToBottomImmediate() {
    // Immediate scroll without setTimeout delay
    const streamingText = document.querySelector('.streaming-text');
    if (streamingText) {
      streamingText.scrollTop = streamingText.scrollHeight;
      // Also use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        streamingText.scrollTop = streamingText.scrollHeight;
      });
    }
  }
}

// Usage in parent component:
// <app-streaming-log [projectId]="selectedProject" [jobId]="selectedJob"></app-streaming-log>