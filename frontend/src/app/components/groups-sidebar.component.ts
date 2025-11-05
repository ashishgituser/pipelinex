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
      <div *ngIf="loadingProjects" class="muted">Loading projects…</div>
      <ul class="projects-list">
        <li *ngFor="let p of projects" class="project-item" (click)="selectProject(p)" [class.active]="p.id === selectedProject?.id">
          <div class="proj-info">
            <div class="proj-name">{{ p.name }}</div>
            <div class="proj-path" *ngIf="p.path">{{ p.path }}</div>
          </div>
          <div class="proj-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8zM5 12.25v3.25a.25.25 0 0 0 .4.2l1.45-1.087a.25.25 0 0 1 .3 0L8.6 15.7a.25.25 0 0 0 .4-.2v-3.25a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25z"/>
            </svg>
          </div>
        </li>
      </ul>
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
    .projects-list { list-style:none; padding:0; margin:0; max-height:40vh; overflow:auto; }
    .project-item { 
      padding: 12px; 
      border-radius: 8px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      cursor: pointer; 
      margin-bottom: 8px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      transition: all 0.2s ease;
    }
    .project-item:hover { 
      background: rgba(255,255,255,0.08); 
      border-color: rgba(31,111,235,0.3);
      transform: translateX(4px);
    }
    .project-item.active { 
      background: rgba(31,111,235,0.14); 
      border-color: rgba(31,111,235,0.4);
      box-shadow: 0 4px 18px rgba(31,111,235,0.08); 
    }
    .proj-info { flex: 1; }
    .proj-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
    .proj-path { font-size: 11px; color: #95b0cc; opacity: 0.8; }
    .proj-icon { 
      color: #9fb7d6; 
      opacity: 0.6; 
      transition: opacity 0.2s ease;
    }
    .project-item:hover .proj-icon { opacity: 1; }
    .project-item.active .proj-icon { color: #1f6feb; opacity: 1; }
    .sidebar-footer { margin-top:auto; font-size:12px; color:#8faac6; }
    .muted { color:#6e8aa2; font-size:13px; }
  `]
})
export class GroupsSidebarComponent implements OnInit {
  groups: Group[] = [];
  projects: Project[] = [];
  selected: Group | null = null;
  selectedProject: Project | null = null;
  loadingGroups = false;
  loadingProjects = false;

  constructor(private git: GitlabService, private sel: SelectionService) {}

  ngOnInit(): void {
    this.loadGroups();
    this.sel.selectedGroup$.subscribe(g => this.selected = g);
    this.sel.projects$.subscribe(p => this.projects = p || []);
    this.sel.selectedProject$.subscribe(p => this.selectedProject = p);
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
    this.selectedProject = p;
    this.sel.selectedProject$.next(p);
  }
}
