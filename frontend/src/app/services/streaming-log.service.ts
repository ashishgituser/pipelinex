// Angular service to consume streaming log summary
// streaming-log.service.ts

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface StreamingResponse {
  type: 'status' | 'token' | 'complete' | 'error';
  content?: string;
  message?: string;
  summary?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StreamingLogService {
  
  /**
   * Stream log summary for a specific job with true token-by-token streaming
   * @param projectId GitLab project ID
   * @param jobId GitLab job ID
   * @returns Observable that emits streaming responses
   */
  streamLogSummary(projectId: number, jobId: number): Observable<StreamingResponse> {
    // Use aggressive real-time streaming approach
    return this.streamLogSummaryRealTime(projectId, jobId);
  }

  /**
   * EventSource-based streaming (native SSE support)
   */
  streamLogSummaryWithEventSource(projectId: number, jobId: number): Observable<StreamingResponse> {
    const subject = new Subject<StreamingResponse>();
    
    const url = `http://localhost:8000/gitlab/pipelines/${projectId}/jobs/${jobId}/log/stream`;
    
    console.log('🎯 Starting EventSource streaming from:', url);
    
    const eventSource = new EventSource(url);
    
    eventSource.onopen = () => {
      console.log('✅ EventSource connection opened');
    };
    
    eventSource.onmessage = (event) => {
      try {
        console.log('📥 EventSource raw data:', event.data);
        
        // Handle completion signals
        if (event.data === '[DONE]') {
          console.log('🏁 EventSource completed with DONE');
          eventSource.close();
          subject.complete();
          return;
        }
        
        const data: StreamingResponse = JSON.parse(event.data);
        console.log('📦 EventSource parsed:', data);
        
        // Emit token immediately
        subject.next(data);
        
        // Handle completion
        if (data.type === 'complete' || data.type === 'error') {
          console.log('🎯 EventSource natural completion:', data.type);
          eventSource.close();
          
          if (data.type === 'complete') {
            subject.complete();
          } else {
            subject.error(data);
          }
        }
        
      } catch (error) {
        console.error('⚠️ EventSource parse error:', error, 'Data:', event.data);
        // Don't close the stream for individual parse errors
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ EventSource error:', error);
      eventSource.close();
      
      subject.error({
        type: 'error',
        message: 'EventSource connection failed'
      });
    };
    
    // Cleanup function
    return new Observable(observer => {
      const subscription = subject.subscribe(observer);
      
      return () => {
        console.log('🧹 Cleaning up EventSource');
        eventSource.close();
        subscription.unsubscribe();
      };
    });
  }

  /**
   * Test method to simulate proper token streaming (for debugging)
   */
  testTokenStreaming(): Observable<StreamingResponse> {
    const subject = new Subject<StreamingResponse>();
    
    const testText = "## Log Analysis Summary\n\n**Status**: The job completed successfully.\n\n**Key Points**:\n* Build process finished\n* Tests passed\n* Deployment ready\n\n**Conclusion**: Everything looks good!";
    
    let index = 0;
    
    // Send initial status
    setTimeout(() => {
      subject.next({ type: 'status', message: 'Analyzing logs...' });
    }, 100);
    
    // Stream tokens one by one
    const interval = setInterval(() => {
      if (index < testText.length) {
        subject.next({
          type: 'token',
          content: testText[index]
        });
        index++;
      } else {
        clearInterval(interval);
        subject.next({
          type: 'complete',
          message: 'Analysis complete',
          summary: testText
        });
        subject.complete();
      }
    }, 50); // 50ms per character for visible streaming effect
    
    return subject.asObservable();
  }
  
  /**
   * Fetch-based streaming with proper SSE token-by-token handling
   */
  streamLogSummaryWithFetch(projectId: number, jobId: number): Observable<StreamingResponse> {
    const subject = new Subject<StreamingResponse>();
    
    const url = `http://localhost:8000/gitlab/pipelines/${projectId}/jobs/${jobId}/log/stream`;
    
    console.log('🚀 Starting SSE streaming from:', url);
    
    fetch(url, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log('✅ Connected to SSE stream');
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        
        function processBuffer() {
          // Split by double newlines (SSE event separator)
          const events = buffer.split('\n\n');
          
          // Keep the last incomplete event in buffer
          buffer = events.pop() || '';
          
          for (const event of events) {
            if (!event.trim()) continue;
            
            const lines = event.split('\n');
            let data = '';
            
            // Parse SSE event
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                data = line.substring(6).trim();
                break;
              }
            }
            
            if (data && data !== '') {
              try {
                console.log('📥 Raw SSE data:', data);
                
                // Handle special completion signals
                if (data === '[DONE]' || data === 'data: [DONE]') {
                  console.log('🏁 Stream completed with DONE signal');
                  subject.next({
                    type: 'complete',
                    message: 'AI analysis completed'
                  });
                  subject.complete();
                  return;
                }
                
                const parsed: StreamingResponse = JSON.parse(data);
                console.log('📦 Parsed token:', parsed);
                
                // Emit each token immediately
                subject.next(parsed);
                
                // Check for natural completion
                if (parsed.type === 'complete' || parsed.type === 'error') {
                  console.log('🎯 Natural stream completion:', parsed.type);
                  if (parsed.type === 'complete') {
                    subject.complete();
                  } else {
                    subject.error(parsed);
                  }
                  return;
                }
                
              } catch (error) {
                console.warn('⚠️ Failed to parse SSE data:', data, error);
                // Continue processing other events
              }
            }
          }
        }
        
        function readStream(): Promise<void> {
          return reader!.read().then(({ done, value }) => {
            if (done) {
              console.log('🔚 Reader done, processing final buffer');
              // Process any remaining data in buffer
              if (buffer.trim()) {
                buffer += '\n\n'; // Add separator to trigger final processing
                processBuffer();
              }
              subject.complete();
              return;
            }
            
            // Decode chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            console.log('📡 Received chunk:', chunk.length, 'chars');
            
            // Process complete events in buffer
            processBuffer();
            
            // Continue reading
            return readStream();
          });
        }
        
        return readStream();
      })
      .catch(error => {
        console.error('❌ SSE fetch error:', error);
        subject.error({
          type: 'error',
          message: `Connection failed: ${error.message}`
        });
      });
    
    return subject.asObservable();
  }

  /**
   * Test endpoint connectivity before streaming
   */
  testEndpoint(projectId: number, jobId: number): Promise<boolean> {
    const url = `http://localhost:8000/gitlab/pipelines/${projectId}/jobs/${jobId}/log/stream`;
    
    console.log('🧪 TESTING ENDPOINT:', url);
    
    return fetch(url, {
      method: 'HEAD', // Just check if endpoint exists
      headers: {
        'Accept': 'text/event-stream'
      }
    })
    .then(response => {
      console.log('🧪 TEST RESPONSE:', response.status, response.statusText);
      return response.ok;
    })
    .catch(error => {
      console.error('🧪 TEST ERROR:', error);
      return false;
    });
  }

  /**
   * Aggressive real-time streaming - processes each byte immediately
   */
  streamLogSummaryRealTime(projectId: number, jobId: number): Observable<StreamingResponse> {
    const subject = new Subject<StreamingResponse>();
    
    const url = `http://localhost:8000/gitlab/pipelines/${projectId}/jobs/${jobId}/log/stream`;
    
    console.log('🔥 AGGRESSIVE STREAMING from:', url);
    
    // Add timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('🔥 TIMEOUT: Aborting request after 10 seconds');
      controller.abort();
    }, 10000);
    
    fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
    .then(async (response) => {
      clearTimeout(timeoutId);
      console.log('🔥 RESPONSE STATUS:', response.status, response.statusText);
      console.log('🔥 RESPONSE HEADERS:', Object.fromEntries(response.headers.entries()));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('🔥 AGGRESSIVE: Connected, processing bytes...');
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream');
      }
      
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let byteCount = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('🔥 AGGRESSIVE: Stream ended, total bytes:', byteCount);
            break;
          }
          
          byteCount += value.length;
          const chunk = decoder.decode(value, { stream: true });
          
          console.log(`🔥 CHUNK[${byteCount}]:`, JSON.stringify(chunk));
          
          buffer += chunk;
          
          // Process buffer immediately on each chunk
          this.processBufferRealTime(buffer, subject, (remaining) => {
            buffer = remaining;
          });
        }
        
        // Process any remaining buffer
        if (buffer.trim()) {
          console.log('🔥 FINAL BUFFER:', JSON.stringify(buffer));
          this.processBufferRealTime(buffer + '\n\n', subject, () => {});
        }
        
        subject.complete();
        
      } catch (error) {
        console.error('🔥 AGGRESSIVE: Stream error:', error);
        subject.error(error);
      }
      
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('🔥 AGGRESSIVE: Fetch error:', error);
      
      if (error.name === 'AbortError') {
        subject.error({
          type: 'error',
          message: 'Connection timed out after 10 seconds'
        });
      } else {
        subject.error({
          type: 'error',
          message: `Connection failed: ${error.message}`
        });
      }
    });
    
    return subject.asObservable();
  }
  
  private processBufferRealTime(
    buffer: string, 
    subject: Subject<StreamingResponse>, 
    updateBuffer: (remaining: string) => void
  ) {
    console.log('🔥 PROCESSING BUFFER:', JSON.stringify(buffer.substring(0, 100)) + '...');
    
    // Look for complete SSE events (ending with \n\n)
    let remaining = buffer;
    
    while (true) {
      const eventEnd = remaining.indexOf('\n\n');
      if (eventEnd === -1) {
        // No complete event found
        break;
      }
      
      const event = remaining.substring(0, eventEnd);
      remaining = remaining.substring(eventEnd + 2);
      
      if (event.trim()) {
        console.log('🔥 COMPLETE EVENT:', JSON.stringify(event));
        this.processSSEEvent(event, subject);
      }
    }
    
    updateBuffer(remaining);
  }
  
  private processSSEEvent(event: string, subject: Subject<StreamingResponse>) {
    const lines = event.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6).trim();
        
        if (data === '[DONE]') {
          console.log('🔥 DONE SIGNAL');
          subject.next({ type: 'complete', message: 'Completed' });
          subject.complete();
          return;
        }
        
        if (data) {
          try {
            const parsed: StreamingResponse = JSON.parse(data);
            console.log('🔥 IMMEDIATE TOKEN:', parsed);
            
            // Emit IMMEDIATELY - no delay, no batching
            subject.next(parsed);
            
            if (parsed.type === 'complete' || parsed.type === 'error') {
              console.log('🔥 NATURAL COMPLETION');
              subject.complete();
              return;
            }
            
          } catch (error) {
            console.warn('🔥 PARSE ERROR:', data, error);
          }
        }
      }
    }
  }
}