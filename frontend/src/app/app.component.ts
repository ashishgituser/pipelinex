import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupsSidebarComponent } from './components/groups-sidebar.component';
import { PipelinesGridComponent } from './components/pipelines-grid.component';
import { StagesPanelComponent } from './components/stages-panel.component';
import { LogViewerComponent } from './components/log-viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    GroupsSidebarComponent,
    PipelinesGridComponent,
    StagesPanelComponent,
    LogViewerComponent
  ],
  template: `
  <div class="app-shell">
    <app-groups-sidebar class="left"></app-groups-sidebar>

    <main class="right">
      <div class="top-row">
        <div class="breadcrumbs">Dashboard / Pipelines</div>
        <div class="spacer"></div>
        <div class="controls">
          <button class="ghost">Refresh All</button>
        </div>
      </div>

      <app-pipelines-grid></app-pipelines-grid>
      <app-stages-panel></app-stages-panel>
      <app-log-viewer></app-log-viewer>
    </main>
  </div>
  `,
  styles: [`
    .app-shell { display:flex; height:100vh; background: linear-gradient(180deg,#04111a,#00101a); color:#d5eaf7; }
    .left { flex: 0 0 320px; }
    .right { flex:1; overflow:auto; padding:18px; }
    .top-row { display:flex; gap:12px; align-items:center; margin-bottom:12px; }
    .breadcrumbs { color:#9fb7d6; font-weight:600; }
    .spacer { flex:1 }
    .ghost { background:transparent; border:1px solid rgba(255,255,255,0.03); padding:6px 10px; color:#9fb7d6; border-radius:8px; cursor:pointer; }
  `]
})
export class AppComponent {}
