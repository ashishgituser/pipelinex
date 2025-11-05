from config import get_gitlab_client
from services.llm_log_service import summarize_logs_with_llm, stream_summarize_logs_with_llm


# ---- Existing ----
def get_groups():
    gl = get_gitlab_client()
    return [{"id": g.id, "name": g.name} for g in gl.groups.list(all=True)]


def get_projects(group_id: int):
    gl = get_gitlab_client()
    group = gl.groups.get(group_id)
    return [{"id": p.id, "name": p.name} for p in group.projects.list(all=True)]


def get_pipelines(project_id: int):
    gl = get_gitlab_client()
    project = gl.projects.get(project_id)
    pipelines = project.pipelines.list(per_page=10, page=1, order_by='id', sort='desc')
    return [
        {"id": p.id, "status": p.status, "ref": p.ref, "sha": p.sha}
        for p in pipelines
    ]


# ---- New: Get stages (jobs) for pipeline ----
def get_pipeline_stages(project_id: int, pipeline_id: int):
    gl = get_gitlab_client()
    project = gl.projects.get(project_id)
    pipeline = project.pipelines.get(pipeline_id)
    jobs = pipeline.jobs.list(all=True)

    stages = {}
    for job in jobs:
        stages.setdefault(job.stage, []).append({
            "id": job.id,
            "name": job.name,
            "status": job.status,
            "started_at": job.started_at,
            "duration": job.duration
        })
    return stages


def ensure_text(data):
    if isinstance(data, bytes):
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return data.decode("latin-1", errors="ignore")
    return str(data)


# ---- New: Get logs for a stage/job ----
def get_stage_log(project_id: int, job_id: int):
    """Fetch raw job logs and summarize them."""
    gl = get_gitlab_client()
    project = gl.projects.get(project_id)
    job = project.jobs.get(job_id)
    raw_log = job.trace()

    if not raw_log or len(raw_log.strip()) == 0:
        return {"summary": "No logs found for this job."}

    # Generate AI summary
    log_text = ensure_text(raw_log)
    summary_result = summarize_logs_with_llm(raw_log)
    return summary_result


def stream_stage_log_summary(project_id: int, job_id: int):
    """Stream the log summary generation token by token."""
    import json
    
    gl = get_gitlab_client()
    project = gl.projects.get(project_id)
    job = project.jobs.get(job_id)
    raw_log = job.trace()

    if not raw_log or len(raw_log.strip()) == 0:
        yield json.dumps({"type": "complete", "summary": "No logs found for this job."})
        return

    # Generate streaming AI summary
    log_text = ensure_text(raw_log)
    
    yield json.dumps({"type": "status", "message": "Processing logs..."})
    
    # Stream the summary generation
    for token in stream_summarize_logs_with_llm(raw_log):
        yield json.dumps({"type": "token", "content": token})
    
    yield json.dumps({"type": "complete", "message": "Summary generation complete"})
