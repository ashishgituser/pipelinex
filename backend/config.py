import gitlab
import os

def get_gitlab_client():
    token = os.getenv("GITLAB_TOKEN")
    url = os.getenv("GITLAB_URL", "https://gitlab.com/")
    if not token:
        raise ValueError("Missing GitLab Personal Access Token in GITLAB_TOKEN")
    return gitlab.Gitlab(url, private_token=token)
