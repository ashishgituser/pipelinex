// src/app/streaming-agent/streaming-agent.component.ts

import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { Observable, Subscription, Observer } from 'rxjs';
import { CommonModule } from '@angular/common'; // Needed for *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Needed for [(ngModel)]

// -----------------------------------------------------------------
// 🤖 Agent Component (Standalone)
// -----------------------------------------------------------------

@Component({
  selector: 'app-agent-weather',
  // Required imports for standalone components (Angular 15+)
  standalone: true, 
  imports: [CommonModule, FormsModule], 
  // Template and styles embedded below for a single-file solution
  template: `
    <div class="agent-container">
        <h2>🤖 AI Weather Agent Interface</h2>
        <p class="api-note">Backend Endpoint: http://localhost:8000/agent/stream</p>

        <form (ngSubmit)="submitIntention()">
            <div class="input-group">
                <textarea 
                    [(ngModel)]="userIntention" 
                    name="intentionInput"
                    placeholder="Ask for the weather, e.g., 'Give me a table of today's temperature and wind speed in Paris.' (The LLM will choose format: table, JSON, or text)"
                    rows="3"
                    [disabled]="isLoading">
                </textarea>
                <button type="submit" [disabled]="isLoading || !userIntention.trim()">
                    <span *ngIf="!isLoading">Ask Agent</span>
                    <span *ngIf="isLoading">Streaming...</span>
                </button>
            </div>
        </form>
        
        <div *ngIf="isLoading" class="loader">
            <p>Agent is thinking and fetching data... ({{ agentResponse.length > 0 ? 'Partial data received' : 'Starting'}})</p>
            
        </div>

        <div *ngIf="error" class="error-message">
            ❌ **Error:** {{ error }}
        </div>

        <div class="response-card">
            <h3>Agent Response</h3>
            <div class="response-content">
                <pre>{{ agentResponse }}</pre>
                <i *ngIf="!isLoading && !agentResponse && !error" class="placeholder-text">
                    Enter your query above to start.
                </i>
            </div>
        </div>
    </div>
  `,
  styles: [`
    .agent-container { max-width: 800px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); font-family: sans-serif; }
    .api-note { font-size: 0.85em; color: #666; margin-bottom: 20px; border-bottom: 1px dashed #eee; padding-bottom: 10px; }
    .input-group { display: flex; gap: 10px; margin-bottom: 20px; }
    textarea { flex-grow: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; }
    button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.3s; }
    button:disabled { background-color: #99cfff; cursor: not-allowed; }
    .loader { text-align: center; color: #007bff; margin-bottom: 15px; }
    .error-message { padding: 10px; background-color: #fdd; color: #a00; border: 1px solid #f99; border-radius: 4px; margin-bottom: 15px; font-weight: bold; }
    .response-card { border: 1px solid #ddd; padding: 15px; border-radius: 4px; background-color: #f8f8f8; }
    .response-content { min-height: 100px; padding: 5px; background-color: #fff; border: 1px solid #eee; border-radius: 4px; overflow-x: auto; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: monospace; margin: 0; padding: 0; }
    .placeholder-text { color: #aaa; }
  `]
})
export class AgentWeatherComponent implements OnInit, OnDestroy {
  // === Component State Variables ===
  userIntention: string = 'What is the hourly temperature and wind speed for the next 24 hours in Berlin? Give me the response in a Markdown table.';
  agentResponse: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  private streamSubscription: Subscription | null = null;
  
  // === Data Fetching Constants ===
  private apiBaseUrl = 'http://localhost:8000/agent/stream';

  constructor(private ngZone: NgZone) {} // Inject NgZone for stream handling

  ngOnInit(): void {
    // Initialization logic if needed
  }

  // === Core Streaming Logic (In-Component Service) ===

  /**
   * Defines the streaming logic using the native fetch API to read chunks.
   * @param intention The user's input string.
   * @returns An Observable that emits chunks of the streamed response text.
   */
  private streamAgentResponse(intention: string): Observable<string> {
    return new Observable<string>((observer: Observer<string>) => {
      const body = { user_intention: intention };

      const fetchStream = async () => {
        try {
          // Use fetch for streaming POST support
          const response = await fetch(this.apiBaseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify(body),
          });

          if (!response.body) {
            throw new Error('Response body is null or not readable.');
          }
          if (!response.ok) {
             throw new Error(`HTTP Error! Status: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Ensure Angular recognizes the stream completion event
              this.ngZone.run(() => observer.complete());
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });

            // Ensure Angular recognizes the data update event
            this.ngZone.run(() => observer.next(chunk));
          }

        } catch (error) {
          // Ensure Angular recognizes the error
          this.ngZone.run(() => observer.error(error));
        }
      };

      fetchStream();
    });
  }

  // === Component UI Handler ===

  /**
   * Handles the form submission, initiates the stream, and manages state.
   */
  submitIntention(): void {
    if (this.isLoading || !this.userIntention.trim()) {
      return;
    }

    // --- Reset and State Update ---
    this.streamSubscription?.unsubscribe();
    this.agentResponse = '';
    this.error = null;
    this.isLoading = true;

    // --- Start Streaming ---
    this.streamSubscription = this.streamAgentResponse(this.userIntention)
      .subscribe({
        next: (chunk: string) => {
          this.agentResponse += chunk; // Append the new chunk to the display
        },
        error: (err) => {
          console.error('Streaming error:', err);
          this.error = `An error occurred: ${err.message || 'Check console.'}`;
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
          console.log('Stream completed.');
        }
      });
  }

  /**
   * Cleanup subscription when component is destroyed.
   */
  ngOnDestroy(): void {
    this.streamSubscription?.unsubscribe();
  }
}