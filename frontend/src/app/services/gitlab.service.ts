import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Group, Project, Pipeline, Job } from '../models/gitlab';

@Injectable({ providedIn: 'root' })
export class GitlabService {
  base = environment.apiBase;

  constructor(private http: HttpClient) {}

  listGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.base}/groups`);
  }

  listProjects(groupId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects/${groupId}`);
  }

  listPipelines(projectId: number): Observable<Pipeline[]> {
    return this.http.get<Pipeline[]>(`${this.base}/pipelines/${projectId}`);
  }

  getPipelineStages(projectId: number, pipelineId: number): Observable<Record<string, Job[]>> {
    return this.http.get<Record<string, Job[]>>(`${this.base}/pipelines/${projectId}/${pipelineId}/stages`);
  }

  getJobLog(projectId: number, jobId: number): Observable<{ log: any }> {
    return this.http.get<{ log: string }>(`${this.base}/pipelines/${projectId}/jobs/${jobId}/log`);
  }
}
