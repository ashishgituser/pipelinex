import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectionService } from '../services/selection.service';
import { Job } from '../models/gitlab';

@Component({
  selector: 'app-stages-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="stages" *ngIf="pipelineName">
    <div class="head">
      <div class="title">Stages — {{pipelineName}}</div>
      <div class="hint">Click a job to view logs</div>
    </div>

    <div class="stages-row">
      <div *ngFor="let s of stagesList" class="stage-card">
        <div class="stage-name">{{ s.name }}</div>
        <div class="jobs-container">
          <div *ngFor="let job of s.jobs" class="job-line" (click)="openJob(job)">
            <div class="job-left">
              <div class="job-name">{{ job.name }}</div>
              <div class="job-meta">{{ job.started_at ? (job.started_at | date:'short') : '-' }}</div>
            </div>
            <div class="job-status" [ngClass]="job.status">{{ job.status }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [`
    .stages { 
      padding: 16px; 
      height: 100%; 
      display: flex; 
      flex-direction: column;
      overflow: hidden;
    }
    
    .head { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 16px;
      flex-shrink: 0;
    }
    
    .title { 
      font-weight: 700; 
      color: #eaf4ff; 
      font-size: 15px;
    }
    
    .hint { 
      color: #9fb7d6; 
      font-size: 12px; 
    }
    
    .stages-row { 
      display: flex; 
      gap: 12px; 
      overflow: auto; 
      flex: 1;
      padding-bottom: 8px;
      min-height: 0;
    }
    
    .stage-card { 
      min-width: 240px; 
      max-width: 280px;
      background: linear-gradient(180deg, #061726, #021219); 
      padding: 14px; 
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.05);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      max-height: 100%;
      overflow: hidden;
    }
    
    .stage-name { 
      font-weight: 700; 
      color: #9fb7d6; 
      margin-bottom: 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }
    
    .jobs-container {
      flex: 1;
      overflow-y: auto;
      margin: -2px;
      padding: 2px;
    }
    
    .job-line { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      padding: 10px; 
      border-radius: 8px; 
      cursor: pointer; 
      margin-bottom: 8px; 
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.03);
      transition: all 0.2s ease;
    }
    
    .job-line:hover { 
      background: rgba(255,255,255,0.06); 
      transform: translateY(-2px); 
      border-color: rgba(31,111,235,0.2);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .job-left {
      flex: 1;
      min-width: 0;
    }
    
    .job-name { 
      font-weight: 600; 
      color: #d7eaf8; 
      font-size: 13px;
      margin-bottom: 3px;
      word-break: break-word;
    }
    
    .job-meta { 
      font-size: 11px; 
      color: #8faac6; 
    }
    
    .job-status { 
      padding: 4px 8px; 
      border-radius: 6px; 
      font-weight: 600; 
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
      margin-left: 8px;
    }
    
    .job-status.success { 
      background: #def6e8; 
      color: #176b3a; 
    }
    
    .job-status.failed { 
      background: #fdecec; 
      color: #9b2a2a; 
    }
    
    .job-status.running { 
      background: #fff7e6; 
      color: #a46e00; 
    }
    
    /* Custom scrollbar for stages */
    .stages-row::-webkit-scrollbar,
    .jobs-container::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    
    .stages-row::-webkit-scrollbar-track,
    .jobs-container::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.02);
      border-radius: 3px;
    }
    
    .stages-row::-webkit-scrollbar-thumb,
    .jobs-container::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
    }
    
    .stages-row::-webkit-scrollbar-thumb:hover,
    .jobs-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.2);
    }
  `]
})
export class StagesPanelComponent implements OnInit {
  stagesList: { name: string; jobs: Job[] }[] = [];
  pipelineName?: string | null;

  constructor(private sel: SelectionService) {}

  ngOnInit(): void {
    this.sel.selectedPipeline$.subscribe(p => {
      this.pipelineName = p?.ref || (p ? `#${p.id}` : undefined);
    });
    this.sel.stages$.subscribe(map => {
      if (!map) { this.stagesList = []; return; }
      this.stagesList = Object.keys(map).map(k => ({ name: k, jobs: map[k] }));
    });
  }

  openJob(job: Job) {
    this.sel.selectedJob$.next(job);
  }
}
