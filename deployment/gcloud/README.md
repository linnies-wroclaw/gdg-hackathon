# GCloud Deployment

This deployment uses Compute Engine plus the existing `solution-system/docker-compose.yml`. That keeps the current container setup intact, including frontend `/api` proxying through Docker Compose service DNS.

## Files

- `deploy.sh`: root wrapper.
- `destroy.sh`: root wrapper.
- `deployment/gcloud/deploy.sh`: deployment orchestrator.
- `deployment/gcloud/destroy.sh`: destroy orchestrator.
- `deployment/gcloud/env.example`: deployment env template.
- `deployment/gcloud/scripts/*.sh`: infrastructure steps.
- `deployment/gcloud/remote/*.sh`: scripts executed on the VM.

## Created Resources

- VPC network and subnet.
- Firewall rules for SSH and frontend port `4200`.
- Ubuntu 22.04 Compute Engine VM.
- VM service account.
- Docker Engine and Docker Compose plugin on the VM.
- Remote app directory, default `/opt/buildwithai`.

## Quick Start

```bash
make init-deploy-env
# edit deployment/gcloud/.env
make deploy-gcloud
```

The app URL is printed at the end:

```text
http://VM_EXTERNAL_IP:4200
```

Destroy:

```bash
bash destroy.sh --env-file deployment/gcloud/.env --yes
```

## Smoke Tests

`deploy.sh` checks:

- The frontend serves HTTP.
- `frontend`, `api`, `postgres`, `adk-agent`, and `mcp-server` containers are running.
- By default, `/api/agent/messages` asks the agent to call `get_random_principles`, which checks frontend -> API -> ADK/Gemini -> MCP.

Set this in `.env` to skip the Gemini call:

```bash
RUN_AGENT_SMOKE_TEST=false
```

## Notes

- `deployment/gcloud/.env` is gitignored.
- Re-running deploy reuses existing infrastructure and refreshes the app source.
- Changing VM size or disk size after creation requires destroy and redeploy.
- Only SSH and port `4200` are public by default.
- Set `EXPOSE_INTERNAL_PORTS=true` only for debugging; it opens ports `3000`, `8000`, and `8081`.
- On Windows, run from Git Bash or WSL with a Linux distribution.

References:

- Compute Engine VM creation: https://cloud.google.com/compute/docs/instances/create-start-instance
- `gcloud compute instances create`: https://cloud.google.com/sdk/gcloud/reference/compute/instances/create
- `gcloud compute firewall-rules create`: https://cloud.google.com/sdk/gcloud/reference/compute/firewall-rules/create
