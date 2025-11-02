import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GitlabService } from '../services/gitlab.service';
import { SelectionService } from '../services/selection.service';
import { Group, Project } from '../models/gitlab';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-groups-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">PX</div>
      <div class="title">PipelineX</div>
    </div>

    <section class="groups">
      <h4>Groups</h4>
      <div *ngIf="loadingGroups" class="muted">Loading groups…</div>
      <ul>
        <li *ngFor="let g of groups" (click)="selectGroup(g)" [class.active]="g.id === selected?.id">
          <div class="g-name">{{ g.name }}</div>
          <div class="g-id">#{{
            g.id
          }}</div>
        </li>
      </ul>
    </section>

    <section class="projects" *ngIf="projects?.length">
      <h4>Projects</h4>
      <div class="proj-slider">
        <div *ngFor="let p of projects" class="proj-card" (click)="selectProject(p)">
          <div class="proj-name">{{ p.name }}</div>
        </div>
      </div>
    </section>

    <footer class="sidebar-footer">
      <div class="small">Connected to GitLab</div>
    </footer>
  </aside>
  `,
  styles: [`
    .sidebar {
      width: 320px;
      background: linear-gradient(180deg,#0f1724 0%, #08111a 100%);
      color: #dce7f2;
      height: 100vh;
      padding: 20px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .brand { display:flex; gap:12px; align-items:center;}
    .logo { width:48px; height:48px; border-radius:10px; background:#1f6feb; display:flex;align-items:center;justify-content:center;font-weight:700;color:white;}
    .title { font-weight:700; font-size:18px; }
    .groups h4, .projects h4 { margin: 0 0 8px 0; color:#9fb7d6; font-size:13px; }
    ul { list-style:none; padding:0; margin:0; max-height:40vh; overflow:auto; }
    li { padding:8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:6px;}
    li:hover { background: rgba(255,255,255,0.02); }
    li.active { background: rgba(31,111,235,0.14); box-shadow: 0 4px 18px rgba(31,111,235,0.08); }
    .g-name { font-weight:600; }
    .g-id { font-size:12px; color:#95b0cc; }
    .proj-slider { display:flex; gap:10px; overflow:auto; padding-bottom:6px; }
    .proj-card { min-width:180px; padding:10px; border-radius:8px; background: rgba(255,255,255,0.02); cursor:pointer; }
    .proj-card:hover { transform: translateY(-4px); transition: all .18s ease; box-shadow:0 6px 20px rgba(2,6,23,0.6); }
    .sidebar-footer { margin-top:auto; font-size:12px; color:#8faac6; }
    .muted { color:#6e8aa2; font-size:13px; }
  `]
})
export class GroupsSidebarComponent implements OnInit {
  groups: Group[] = [];
  projects: Project[] = [];
  selected: Group | null = null;
  loadingGroups = false;
  loadingProjects = false;

  constructor(private git: GitlabService, private sel: SelectionService) {}

  ngOnInit(): void {
    this.loadGroups();
    this.sel.selectedGroup$.subscribe(g => this.selected = g);
    this.sel.projects$.subscribe(p => this.projects = p || []);
  }

  loadGroups() {
    this.loadingGroups = true;
    this.git.listGroups().subscribe({
      next: g => {
        this.groups = g;
        this.sel.groups$.next(g);
        this.loadingGroups = false;
      },
      error: () => { this.loadingGroups = false; }
    });
  }

  selectGroup(g: Group) {
    this.sel.selectedGroup$.next(g);
    this.selected = g;
    this.loadProjects(g.id);
  }

  loadProjects(groupId: number) {
    this.loadingProjects = true;
    this.git.listProjects(groupId).subscribe({
      next: p => {
        this.sel.projects$.next(p);
        this.loadingProjects = false;
      },
      error: () => { this.loadingProjects = false; }
    });
  }

  selectProject(p: Project) {
    this.sel.selectedProject$.next(p);
  }
}
