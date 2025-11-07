from flask import Flask, jsonify, Response, request
from flask_cors import CORS

from services.gitlab_service import (
    get_groups, get_projects, get_pipelines,
    get_pipeline_stages, get_stage_log, stream_stage_log_summary
)

app = Flask(__name__)

# ✅ Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/groups")
def groups():
    return jsonify(get_groups())


@app.route("/projects/<int:group_id>")
def projects(group_id):
    return jsonify(get_projects(group_id))


@app.route("/pipelines/<int:project_id>")
def pipelines(project_id):
    return jsonify(get_pipelines(project_id))


@app.route("/stages/<int:project_id>/<int:pipeline_id>")
def stages(project_id, pipeline_id):
    return jsonify(get_pipeline_stages(project_id, pipeline_id))


@app.route("/logs/<int:project_id>/<int:job_id>")
def summarize_log(project_id, job_id):
    return jsonify(get_stage_log(project_id, job_id))


@app.route("/stream/<int:project_id>/<int:job_id>")
def stream_log_summary(project_id, job_id):
    def generate():
        for chunk in stream_stage_log_summary(project_id, job_id):
            yield f"data: {chunk}\n\n"
    # ✅ Important: set headers for Server-Sent Events (SSE) + CORS
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    }
    return Response(generate(), headers=headers)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
