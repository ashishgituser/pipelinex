from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from services import gitlab_service

router = APIRouter(prefix="/gitlab", tags=["GitLab"])


@router.get("/groups")
def list_groups():
    return gitlab_service.get_groups()


@router.get("/projects/{group_id}")
def list_projects(group_id: int):
    return gitlab_service.get_projects(group_id)


@router.get("/pipelines/{project_id}")
def list_pipelines(project_id: int):
    return gitlab_service.get_pipelines(project_id)


@router.get("/pipelines/{project_id}/{pipeline_id}/stages")
def list_pipeline_stages(project_id: int, pipeline_id: int):
    """Get all stages (jobs) for the selected pipeline"""
    return gitlab_service.get_pipeline_stages(project_id, pipeline_id)


@router.get("/pipelines/{project_id}/jobs/{job_id}/log")
def get_job_log(project_id: int, job_id: int):
    """Get the log output for a specific job/stage"""
    log = gitlab_service.get_stage_log(project_id, job_id)
    return {"log": log}


@router.get("/pipelines/{project_id}/jobs/{job_id}/log/stream")
def stream_job_log_summary(project_id: int, job_id: int):
    """Stream the log summary generation token by token using Server-Sent Events"""
    def generate_stream():
        try:
            # Send initial status
            yield "data: {\"type\": \"status\", \"message\": \"Fetching logs...\"}\n\n"
            
            # Stream the summary generation
            for chunk in gitlab_service.stream_stage_log_summary(project_id, job_id):
                yield f"data: {chunk}\n\n"
                
        except Exception as e:
            error_msg = str(e).replace('"', '\\"')  # Escape quotes
            yield f"data: {{\"type\": \"error\", \"message\": \"Error: {error_msg}\"}}\n\n"
    
    return StreamingResponse(
        generate_stream(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )
