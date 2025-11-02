export interface Group {
    id: number;
    name: string;
    path?: string;
    web_url?: string;
  }
  
  export interface Project {
    id: number;
    name: string;
    path?: string;
    web_url?: string;
  }
  
  export interface Pipeline {
    id: number;
    status: string;
    ref?: string;
    sha?: string;
    web_url?: string;
    created_at?: string;
    updated_at?: string;
  }
  
  export interface Job {
    id: number;
    name: string;
    status: string;
    stage?: string;
    started_at?: string | null;
    finished_at?: string | null;
    duration?: number | null;
  }
  