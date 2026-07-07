# Setup

Deploys the existing Docker Compose stack to a Google Compute Engine VM. No application or Docker container files are changed.

## Requirements

- Billing-enabled Google Cloud project.
- Bash, `tar`, and Google Cloud CLI.
- A Gemini API key.

On Windows, use Git Bash or WSL with a Linux distribution.

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Your account needs permission to enable APIs, create Compute Engine resources, create service accounts, and bind IAM roles.

## Configure

From the repo root:

```bash
make init-deploy-env
```

Edit `deployment/gcloud/.env`:

```bash
GCP_PROJECT_ID=your-gcp-project-id
GCP_REGION=europe-west1
GCP_ZONE=europe-west1-b
GOOGLE_GENAI_API_KEY=your-gemini-key
```

Recommended:

```bash
SSH_SOURCE_RANGE=YOUR_PUBLIC_IP/32
```

Keep this default unless you need to skip the Gemini/agent check:

```bash
RUN_AGENT_SMOKE_TEST=true
```

That check sends one request through the frontend route to the API, ADK agent, Gemini, and MCP server.

## Deploy

```bash
make deploy-gcloud
```

The script creates the network, firewall rules, VM service account, VM, installs Docker, uploads `solution-system`, writes runtime env files, starts Docker Compose, and smoke-tests the app.

The printed URL is:

```text
http://VM_EXTERNAL_IP:4200
```

## Operate

SSH:

```bash
gcloud compute ssh buildwithai-vm --zone europe-west1-b --project YOUR_PROJECT_ID
```

Logs:

```bash
cd /opt/buildwithai
sudo docker compose -p buildwithai --env-file .env -f solution-system/docker-compose.yml logs -f
```

Restart:

```bash
cd /opt/buildwithai
sudo docker compose -p buildwithai --env-file .env -f solution-system/docker-compose.yml up -d --build
```

## Destroy

```bash
bash destroy.sh --env-file deployment/gcloud/.env --yes
```

This deletes the VM, boot disk, firewall rules, subnet, VPC network, and VM service account created by the scripts. It does not delete the Google Cloud project.
