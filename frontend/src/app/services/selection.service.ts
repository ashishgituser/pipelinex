import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Group, Project, Pipeline, Job } from '../models/gitlab';

@Injectable({ providedIn: 'root' })
export class SelectionService {
  public groups$ = new BehaviorSubject<Group[] | null>(null);
  public selectedGroup$ = new BehaviorSubject<Group | null>(null);

  public projects$ = new BehaviorSubject<Project[] | null>(null);
  public selectedProject$ = new BehaviorSubject<Project | null>(null);

  public pipelines$ = new BehaviorSubject<Pipeline[] | null>(null);
  public selectedPipeline$ = new BehaviorSubject<Pipeline | null>(null);

  public stages$ = new BehaviorSubject<Record<string, Job[]> | null>(null);
  public selectedJob$ = new BehaviorSubject<Job | null>(null);
}
