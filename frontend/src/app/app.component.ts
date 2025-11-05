import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupsSidebarComponent } from './components/groups-sidebar.component';
import { PipelinesGridComponent } from './components/pipelines-grid.component';
import { StagesPanelComponent } from './components/stages-panel.component';
import { LogViewerComponent } from './components/log-viewer.component';
import { StreamingLogComponent } from './components/streaming-log-viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    GroupsSidebarComponent,
    PipelinesGridComponent,
    StagesPanelComponent,
    LogViewerComponent,
    StreamingLogComponent,
  ],
  template: `
  <div class="app-shell">
    <!-- Left Column: Groups & Projects -->
    <aside class="left-column">
      <app-groups-sidebar></app-groups-sidebar>
    </aside>

    <!-- Middle Column: Stages & Log Summary -->
    <main class="middle-column">
      <div class="top-row">
        <div class="breadcrumbs">Dashboard / Stages & Logs</div>
        <div class="spacer"></div>
        <div class="controls">
          <button class="ghost">⟳ Refresh</button>
        </div>
      </div>

      <div class="middle-content">
        <div class="stages-section">
          <app-stages-panel></app-stages-panel>
        </div>
        
        <div class="logs-summary-section">
          <app-streaming-log></app-streaming-log>
        </div>
      </div>
    </main>

    <!-- Right Column: Pipelines Grid -->
    <aside class="right-column">
      <div class="top-row">
        <div class="breadcrumbs">Pipelines</div>
        <div class="spacer"></div>
        <div class="controls">
          <button class="ghost">Filter</button>
        </div>
      </div>
      
      <div class="pipelines-section">
        <app-pipelines-grid></app-pipelines-grid>
      </div>
    </aside>
  </div>
  `,
  styles: [`
    .app-shell { 
      display: grid; 
      grid-template-columns: 320px minmax(400px, 1fr) 360px; 
      height: 100vh; 
      background: linear-gradient(180deg,#04111a,#00101a); 
      color: #d5eaf7; 
      gap: 0;
      min-width: 1080px;
    }
    
    .left-column { 
      background: linear-gradient(180deg,#0f1724 0%, #08111a 100%);
      border-right: 1px solid rgba(255,255,255,0.05);
    }
    
    .middle-column { 
      display: flex; 
      flex-direction: column; 
      overflow: hidden;
      padding: 18px;
      border-right: 1px solid rgba(255,255,255,0.05);
    }
    
    .right-column { 
      display: flex; 
      flex-direction: column; 
      overflow: hidden;
      padding: 18px;
      background: linear-gradient(180deg,#051218 0%, #020e15 100%);
    }
    
    .middle-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      gap: 16px;
    }
    
    .stages-section {
      flex: 1;
      min-height: 300px;
      overflow: hidden;
      background: rgba(255,255,255,0.01);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.03);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    
    .logs-summary-section {
      flex: 0 0 240px;
      overflow: hidden;
      background: rgba(255,255,255,0.01);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.03);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    
    .pipelines-section {
      flex: 1;
      overflow: auto;
    }
    
    .top-row { 
      display: flex; 
      gap: 12px; 
      align-items: center; 
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .breadcrumbs { 
      color: #9fb7d6; 
      font-weight: 600; 
      font-size: 14px;
    }
    
    .spacer { flex: 1; }
    
    .ghost { 
      background: transparent; 
      border: 1px solid rgba(255,255,255,0.08); 
      padding: 6px 12px; 
      color: #9fb7d6; 
      border-radius: 8px; 
      cursor: pointer; 
      transition: all 0.2s ease;
      font-size: 13px;
    }
    
    .ghost:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.15);
      color: #eaf4ff;
    }
  `]
})
export class AppComponent {}
