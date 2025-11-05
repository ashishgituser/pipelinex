import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectionService } from '../services/selection.service';
import { GitlabService } from '../services/gitlab.service';
import { Pipeline } from '../models/gitlab';

@Component({
  selector: 'app-pipelines-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="pipelines">
    <div class="header">
      <div class="title">Pipelines</div>
      <div class="meta" *ngIf="projectName">Project: <strong>{{projectName}}</strong></div>
    </div>

    <div *ngIf="loading" class="muted">Loading pipelines…</div>

    <div class="grid">
      <article *ngFor="let p of pipelines" class="card" (click)="openPipeline(p)">
        <div class="card-top">
          <div class="id">#{{p.id}}</div>
          <div class="status" [ngClass]="p.status">{{ p.status }}</div>
        </div>
        <div class="card-body">
          <div class="ref">{{ p.ref || '—' }}</div>
          <div class="sha">{{ p.sha ? (p.sha | slice:0:7) : '—' }}</div>
        </div>
        <div class="card-foot">
          <button class="small-btn" (click)="openPipeline(p); $event.stopPropagation()">Open</button>
        </div>
      </article>
    </div>
  </section>
  `,
  styles: [`
    .pipelines { 
      height: 100%; 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
    }
    
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 16px;
      flex-shrink: 0;
    }
    
    .title { 
      font-size: 16px; 
      font-weight: 700; 
      color: #eaf4ff; 
    }
    
    .meta { 
      color: #9fb7d6; 
      font-size: 12px; 
    }
    
    .grid { 
      display: flex; 
      flex-direction: column; 
      gap: 10px; 
      overflow-y: auto; 
      flex: 1;
      padding-right: 4px;
    }
    
    .card { 
      background: linear-gradient(180deg, #071826, #02121a); 
      border-radius: 10px; 
      padding: 12px; 
      cursor: pointer; 
      border: 1px solid rgba(255,255,255,0.04); 
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    
    .card:hover { 
      transform: translateX(-4px); 
      box-shadow: 0 8px 25px rgba(0,0,0,0.4);
      border-color: rgba(31,111,235,0.3);
    }
    
    .card-top { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 8px; 
    }
    
    .id { 
      color: #8fb7d6; 
      font-weight: 700; 
      font-size: 14px;
    }
    
    .status { 
      padding: 4px 8px; 
      border-radius: 6px; 
      font-weight: 600; 
      font-size: 11px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status.success { 
      background: #e7f9ee; 
      color: #0a7b3b; 
    }
    
    .status.failed { 
      background: #fdecec; 
      color: #a12a2a; 
    }
    
    .status.running { 
      background: #fff7e6; 
      color: #a46e00; 
    }
    
    .card-body { 
      color: #b7d7ef; 
      font-size: 12px;
      margin-bottom: 8px;
    }
    
    .ref {
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .sha {
      color: #95b0cc;
      font-family: monospace;
    }
    
    .card-foot { 
      display: flex; 
      justify-content: flex-end; 
    }
    
    .small-btn { 
      background: transparent; 
      border: 1px solid rgba(255,255,255,0.08); 
      color: #9fb7d6; 
      padding: 4px 8px; 
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 11px;
      transition: all 0.2s ease;
    }
    
    .small-btn:hover {
      background: rgba(31,111,235,0.1);
      border-color: rgba(31,111,235,0.4);
      color: #eaf4ff;
    }
    
    .muted { 
      color: #8faac6; 
      font-size: 13px; 
      padding: 20px; 
      text-align: center; 
    }
  `]
})
export class PipelinesGridComponent implements OnInit {
  pipelines: Pipeline[] = [];
  loading = false;
  projectName?: string | null;

  constructor(private sel: SelectionService, private git: GitlabService) {}

  ngOnInit(): void {
    this.sel.selectedProject$.subscribe(p => {
      if (p) {
        this.projectName = p.name;
        this.loadPipelines(p.id);
      } else {
        this.pipelines = [];
        this.projectName = undefined;
      }
    });
  }

  loadPipelines(projectId: number) {
    this.loading = true;
    this.git.listPipelines(projectId).subscribe({
      next: data => { this.pipelines = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openPipeline(p: Pipeline) {
    this.sel.selectedPipeline$.next(p);
    // load stages immediately
    if (this.sel.selectedProject$.value) {
      this.git.getPipelineStages(this.sel.selectedProject$.value!.id, p.id).subscribe({
        next: st => this.sel.stages$.next(st),
        error: () => {}
      });
    }
  }
}
