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
        <div *ngFor="let job of s.jobs" class="job-line" (click)="openJob(job)">
          <div class="job-left">
            <div class="job-name">{{ job.name }}</div>
            <div class="job-meta">{{ job.started_at ? (job.started_at | date:'short') : '-' }}</div>
          </div>
          <div class="job-status" [ngClass]="job.status">{{ job.status }}</div>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [`
    .stages { padding: 18px; border-top: 1px solid rgba(255,255,255,0.02); }
    .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .title { font-weight:700; color:#eaf4ff; }
    .hint { color:#9fb7d6; font-size:13px; }
    .stages-row { display:flex; gap:12px; overflow:auto; padding-bottom:8px; }
    .stage-card { min-width:260px; background:linear-gradient(180deg,#061726,#021219); padding:12px; border-radius:8px; }
    .stage-name { font-weight:700; color:#9fb7d6; margin-bottom:8px; }
    .job-line { display:flex; justify-content:space-between; align-items:center; padding:8px; border-radius:6px; cursor:pointer; margin-bottom:6px; background: rgba(255,255,255,0.01); }
    .job-line:hover { background: rgba(255,255,255,0.02); transform: translateY(-2px); transition: all .12s ease; }
    .job-name { font-weight:600; color:#d7eaf8; }
    .job-meta { font-size:12px; color:#8faac6; }
    .job-status { padding:6px 8px; border-radius:8px; font-weight:700; font-size:12px; }
    .job-status.success { background:#def6e8; color:#176b3a; }
    .job-status.failed { background:#fdecec; color:#9b2a2a; }
    .job-status.running { background:#fff7e6; color:#a46e00; }
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
