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
    <!-- Left Sidebar -->
    <aside class="left-column">
      <app-groups-sidebar></app-groups-sidebar>
    </aside>

    <!-- Middle Column -->
    <main class="middle-column">
      <div class="top-row">
        <div class="breadcrumbs">Dashboard / Log Summary</div>
        <div class="spacer"></div>
        <button class="ghost">⟳ Refresh</button>
      </div>

      <div class="middle-content">
        <div class="logs-summary-section">
          <app-streaming-log></app-streaming-log>
        </div>

        <div class="stages-section">
          <app-stages-panel></app-stages-panel>
        </div>
      </div>
    </main>

    <!-- Right Sidebar -->
    <aside class="right-column">
      <div class="top-row">
        <div class="breadcrumbs">Pipelines</div>
        <div class="spacer"></div>
        <button class="ghost">Filter</button>
      </div>
      <div class="pipelines-section">
        <app-pipelines-grid></app-pipelines-grid>
      </div>
    </aside>
  </div>
  `,
  styles: [`
    /* --- LAYOUT GRID --- */
    .app-shell {
      display: grid;
      grid-template-columns: 300px minmax(600px, 1fr) 340px;
      height: 100vh;
      background: radial-gradient(circle at top left, #06121c, #000e18);
      color: #d8e7f9;
      overflow: hidden;
    }

    /* --- LEFT COLUMN --- */
    .left-column {
      background: linear-gradient(180deg,#0b1a27 0%, #08121d 100%);
      border-right: 1px solid rgba(255,255,255,0.05);
    }

    /* --- RIGHT COLUMN --- */
    .right-column {
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg,#071620 0%, #020d15 100%);
      border-left: 1px solid rgba(255,255,255,0.05);
      padding: 16px;
    }

    /* --- MIDDLE COLUMN --- */
    .middle-column {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 16px 20px;
    }

    .top-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 8px;
    }

    .breadcrumbs {
      font-size: 15px;
      font-weight: 600;
      color: #99b7e2;
      letter-spacing: 0.3px;
    }

    .spacer { flex: 1; }

    .ghost {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      color: #a7c8ee;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ghost:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.2);
      color: #fff;
    }

    /* --- MIDDLE CONTENT --- */
    .middle-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 18px;
      overflow: hidden;
    }

    /* Give logs more height priority */
    .logs-summary-section {
      flex: 0 0 65%;
      background: rgba(255,255,255,0.02);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.04);
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      overflow: hidden;
      position: relative;
    }

    /* Add a gradient top bar for visual polish */
    .logs-summary-section::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      height: 6px;
      width: 100%;
      background: linear-gradient(90deg,#00c6ff,#0072ff);
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
    }

    .stages-section {
      flex: 1;
      background: rgba(255,255,255,0.01);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.03);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      overflow: hidden;
    }

    .pipelines-section {
      flex: 1;
      overflow: auto;
    }

    /* Scrollbar for logs and pipelines */
    ::-webkit-scrollbar {
      width: 8px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: rgba(255,255,255,0.15);
      border-radius: 8px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255,255,255,0.3);
    }
  `]
})
export class AppComponent {}
