#!/usr/bin/env bash
# deploy/eks-setup.sh — One-time EKS infrastructure setup for Woship
# Usage: ./deploy/eks-setup.sh
set -euo pipefail

REGION="us-east-1"
CLUSTER_NAME="woship-cluster"
NAMESPACE="woship"
VPC_ID="vpc-08cc449384ba44fd7"
PRIVATE_SUBNETS="subnet-04d02e76a337a91c4,subnet-06d2fd1a513bdadc5"
VPC_CIDR="10.0.0.0/16"

DB_IDENTIFIER="woship-pg"
DB_USER="woship"
DB_NAME="woship"
DB_INSTANCE_CLASS="db.t3.micro"
DB_STORAGE=20

echo "=== Woship EKS Setup ==="

# ─── 1. RDS ───

echo "→ Creating DB subnet group..."
aws rds create-db-subnet-group \
  --db-subnet-group-name woship-db-subnet \
  --db-subnet-group-description "Woship private subnets" \
  --subnet-ids ${PRIVATE_SUBNETS//,/ } \
  --region "$REGION" --no-cli-pager 2>/dev/null || echo "  (already exists)"

echo "→ Creating RDS security group..."
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=woship-rds-sg" "Name=vpc-id,Values=$VPC_ID" \
  --region "$REGION" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  SG_ID=$(aws ec2 create-security-group \
    --group-name woship-rds-sg \
    --description "Woship RDS access" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" --query 'GroupId' --output text)
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" --protocol tcp --port 5432 --cidr "$VPC_CIDR" \
    --region "$REGION" --no-cli-pager
fi
echo "  SG: $SG_ID"

# Generate random password
DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)

echo "→ Creating RDS instance $DB_IDENTIFIER..."
aws rds create-db-instance \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --db-instance-class "$DB_INSTANCE_CLASS" \
  --engine postgres --engine-version 15 \
  --master-username "$DB_USER" \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage "$DB_STORAGE" \
  --db-subnet-group-name woship-db-subnet \
  --vpc-security-group-ids "$SG_ID" \
  --db-name "$DB_NAME" \
  --no-publicly-accessible \
  --region "$REGION" --no-cli-pager 2>/dev/null || echo "  (already exists, skipping password generation)"

echo "→ Waiting for RDS to be available (this takes 3-5 min)..."
aws rds wait db-instance-available --db-instance-identifier "$DB_IDENTIFIER" --region "$REGION"

DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --region "$REGION" --query 'DBInstances[0].Endpoint.Address' --output text)
echo "  Endpoint: $DB_HOST"

# ─── 2. Kubernetes Resources ───

echo "→ Applying RBAC..."
kubectl apply -f deploy/k8s/rbac.yaml

echo "→ Creating secrets..."
kubectl delete secret woship-backend-secrets -n "$NAMESPACE" 2>/dev/null || true
kubectl create secret generic woship-backend-secrets -n "$NAMESPACE" \
  --from-literal=DB_HOST="$DB_HOST" \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DB_NAME="$DB_NAME" \
  --from-literal=DB_SSLMODE=require \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)"

echo "→ Deploying application..."
kubectl apply -f deploy/k8s/deployment.yaml
kubectl rollout status deployment/woship-backend -n "$NAMESPACE" --timeout=120s

# ─── 3. Output ───

LB=$(kubectl get svc -n "$NAMESPACE" woship-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")

echo ""
echo "=== Done ==="
echo "  LB:       http://$LB"
echo "  DB Host:  $DB_HOST"
echo "  DB Pass:  $DB_PASSWORD  ← save this!"
echo "  Login:    admin@woship.local / admin123"
