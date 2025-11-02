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
    .pipelines { padding:18px; }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .title { font-size:18px; font-weight:700; color:#eaf4ff; }
    .meta { color:#9fb7d6; font-size:13px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
    .card { background: linear-gradient(180deg,#071826,#02121a); border-radius:10px; padding:12px; cursor:pointer; border:1px solid rgba(255,255,255,0.02); transition:transform .12s ease, box-shadow .12s ease; }
    .card:hover { transform: translateY(-6px); box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
    .card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .id { color:#8fb7d6; font-weight:700; }
    .status { padding:6px 8px; border-radius:8px; font-weight:700; font-size:12px; text-transform:capitalize; }
    .status.success { background:#e7f9ee; color:#0a7b3b; }
    .status.failed { background:#fdecec; color:#a12a2a; }
    .status.running { background:#fff7e6; color:#a46e00; }
    .card-body { color:#b7d7ef; display:flex; justify-content:space-between; font-size:13px; }
    .card-foot { margin-top:12px; display:flex; justify-content:flex-end; }
    .small-btn { background:transparent; border:1px solid rgba(255,255,255,0.06); color:#9fb7d6; padding:6px 10px; border-radius:8px; cursor:pointer; }
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
