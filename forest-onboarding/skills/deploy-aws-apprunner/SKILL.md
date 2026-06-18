---
name: deploy-aws-apprunner
description: >
  Deploy a Forest Admin Standalone agent to production on AWS App Runner, using
  the AWS CLI. Use when someone wants to "deploy my Forest Admin agent to AWS",
  "put my admin panel in production on App Runner", or run the agent on AWS
  without managing servers (ECS/VPC/ALB). Builds and pushes a container image to
  ECR, creates an App Runner service with the production env vars, applies the
  known findings, and activates the environment. Pairs with forest-onboard.
---

# Deploy a Standalone agent to production (AWS App Runner)

Activates a **production environment** by deploying the agent as a container on **AWS App Runner** — the AWS service closest to the Heroku/Railway model: managed, public HTTPS URL, no ALB/VPC to wire by hand. App Runner pulls a container **image from ECR**, so the flow is: build → push to ECR → create service.

> ✅ **Validated end-to-end on a real production deploy (2026-06-18):** ECR push → IAM access role → `create-service` → schema pushed + first role created → `environments:update` → `isActive: true`. Verified against aws-cli 2.x in `eu-west-3`.

## Prerequisites (preflight)

- 🟩 REMEDIATE if missing: `aws` CLI v2 installed and configured (`aws configure` / SSO — **IAM credentials**, not an OAuth login); `docker`; the built agent directory.
- 🟩 IAM permissions for the operator: create ECR repos, push images, create IAM roles, create App Runner services (e.g. `AWSAppRunnerFullAccess` + ECR + `iam:CreateRole`/`AttachRolePolicy`).
- Inputs: the **production** env's `FOREST_ENV_SECRET` (`secret_key`); a generated `FOREST_AUTH_SECRET`; a **remotely-reachable production `DATABASE_URL`** (RDS or external — App Runner egress is public by default, a local DB won't work); the target **region**.

## Findings to apply (do not skip)

1. **Container port** — set `ImageConfiguration.Port` (default **8080**) AND make the agent listen on it: pass `APPLICATION_PORT=8080` (or `PORT=8080`) as a runtime env var, and keep the PORT patch `Number(process.env.PORT || process.env.APPLICATION_PORT)`. App Runner routes to that port.
2. **Build for amd64** — App Runner runs **linux/amd64**. On Apple Silicon you MUST `docker build --platform linux/amd64`, else the service crashes with `exec format error`.
3. **`FOREST_SERVER_URL` must be publicly reachable** — same finding as the other PaaS: use a **public** Forest server (prod). An internal/dev server fails with `getaddrinfo ENOTFOUND`.
4. **Private ECR needs an access role** — App Runner can't pull a private image without an IAM role trusted by `build.apprunner.amazonaws.com` carrying `AWSAppRunnerServicePolicyForECRAccess` (created once, reused).
5. **Production schema** — with `NODE_ENV=production` the agent serves the **committed** `.forestadmin-schema.json` (not introspected) — generate (dev boot) + commit before building the image; regenerate + rebuild after any customization.
6. **New AWS accounts: first App Runner deploy in a region waits on Fargate capacity validation.** App Runner runs on Fargate; a brand-new account's first use in a region triggers an AWS-side validation — `create-service` sits in `OPERATION_IN_PROGRESS` until AWS validates (an email confirms it). Not an error — just wait it out; the service then reaches `RUNNING`. (Observed 2026-06-18 in `eu-west-3`.)

## Procedure

```bash
REGION=eu-west-3            # match the Forest data region
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO=forest-agent

# 1. ECR repo + login + build/push the image (amd64!)
aws ecr create-repository --repository-name "$REPO" --region "$REGION" 2>/dev/null || true
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
docker build --platform linux/amd64 -t "$REPO" .
docker tag "$REPO:latest" "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest"
docker push "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest"

# 2. One-time: IAM access role so App Runner can pull from private ECR
cat > /tmp/apprunner-trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[{"Effect":"Allow",
  "Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam create-role --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document file:///tmp/apprunner-trust.json 2>/dev/null || true
aws iam attach-role-policy --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

# 3. Create the App Runner service (port 8080 + prod env vars)
cat > /tmp/apprunner-src.json <<JSON
{
  "ServiceName": "forest-agent",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8080",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "APPLICATION_PORT": "8080",
          "FOREST_SERVER_URL": "https://api.forestadmin.com",
          "FOREST_ENV_SECRET": "<prod env secret_key>",
          "FOREST_AUTH_SECRET": "<generated>",
          "DATABASE_URL": "<remote prod url>",
          "DATABASE_SCHEMA": "public",
          "DATABASE_SSL_MODE": "required"
        }
      }
    },
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::$ACCOUNT:role/AppRunnerECRAccessRole"
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": { "Cpu": "1 vCPU", "Memory": "2 GB" }
}
JSON
aws apprunner create-service --cli-input-json file:///tmp/apprunner-src.json --region "$REGION"
# → note the Service.ServiceUrl in the output (e.g. xxxx.eu-west-3.awsapprunner.com)
```

> For real secrets, prefer `RuntimeEnvironmentSecrets` (Secrets Manager / SSM ARNs) over plain `RuntimeEnvironmentVariables`. Plain vars are simpler for a first onboarding; document the trade-off.

## Verify & activate

- Poll until running: `aws apprunner describe-service --service-arn <arn> --query 'Service.Status'` → `RUNNING` (or track the `OperationId` via `list-operations`).
- Check logs (CloudWatch) for `Schema was updated…` then `Successfully mounted on Standalone server`. The schema push on this **new** prod env sets `apimapVersionId` **and creates the first role ("Operations")**.
- **Set the apiEndpoint** (App Runner gives HTTPS):
  ```bash
  forest environments:update -e <prod env id> -u https://<service-url>
  ```
- Confirm: `forest environments:get <prod env id> --format json` → `"isActive": true`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `exec format error` on boot | image built for arm64 (Apple Silicon) | rebuild `--platform linux/amd64`, push, redeploy |
| Service stuck `CREATE_FAILED` pulling image | missing/incorrect ECR access role | create `AppRunnerECRAccessRole` (trust `build.apprunner.amazonaws.com` + `AWSAppRunnerServicePolicyForECRAccess`), recreate the service |
| Health check fails / 502 | agent not listening on `Port` (8080) | set `APPLICATION_PORT=8080` (or `PORT`) + the PORT patch; ensure bind `0.0.0.0` |
| `getaddrinfo ENOTFOUND <forest server>` | `FOREST_SERVER_URL` not public (dev/internal) | use a public Forest server (prod) — finding #3 |
| DB connection refused/timeout | DB not reachable from App Runner, or SSL | use a remote DB; set `DATABASE_SSL_MODE`; for RDS in a private subnet add a VPC connector |
| Prod panel shows 0 collections | `.forestadmin-schema.json` missing/stale in the image | regenerate (dev boot) + commit + rebuild + redeploy |

## Redeploy after a change

App Runner serves the committed image. After ANY code/customization change: regenerate `.forestadmin-schema.json` → commit → `docker build --platform linux/amd64` → push to ECR. With `AutoDeploymentsEnabled: true` App Runner redeploys on a new `:latest` push; otherwise `aws apprunner start-deployment --service-arn <arn>`.

## Fail-fast

- 🟥 Image build/push failure, role/permission errors, or service never reaches `RUNNING` / prod never `isActive` after a reasonable timeout → stop with the logs.

## Cleanup (for test/dry runs)

`aws apprunner delete-service --service-arn <arn>` · `aws ecr delete-repository --repository-name forest-agent --force --region <r>` · (optional) `aws iam detach-role-policy` + `aws iam delete-role --role-name AppRunnerECRAccessRole` · then delete the Forest project if throwaway (`DELETE /api/projects/:id`).
