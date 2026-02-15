#!/bin/bash
#
# GKE Service Account Setup for Velero Dashboard
#
# This script creates a service account in your GKE cluster with the necessary
# permissions to manage Velero backups, restores, and schedules. It outputs
# the credentials needed to connect the cluster to Velero Dashboard using
# token-based authentication.
#
# Usage:
#   ./gke-setup.sh [options]
#
# Options:
#   -n, --namespace NAMESPACE    Velero namespace (default: velero)
#   -s, --sa-name NAME          Service account name (default: velero-dashboard)
#   -d, --duration DURATION     Token duration (default: 87600h = 10 years)
#   -h, --help                  Show this help message
#
# Example:
#   ./gke-setup.sh -n velero -s velero-dashboard
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NAMESPACE="velero"
SA_NAME="velero-dashboard"
TOKEN_DURATION="87600h"  # 10 years

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -s|--sa-name)
            SA_NAME="$2"
            shift 2
            ;;
        -d|--duration)
            TOKEN_DURATION="$2"
            shift 2
            ;;
        -h|--help)
            head -n 20 "$0" | tail -n +2 | sed 's/^# //'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  GKE Service Account Setup for Velero Dashboard${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed. Please install kubectl first.${NC}"
    exit 1
fi

# Check if connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Not connected to a Kubernetes cluster.${NC}"
    echo -e "${YELLOW}   Run: gcloud container clusters get-credentials CLUSTER_NAME --zone ZONE${NC}"
    exit 1
fi

CLUSTER_NAME=$(kubectl config current-context)
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

echo -e "${GREEN}✓${NC} Connected to cluster: ${YELLOW}${CLUSTER_NAME}${NC}"
echo -e "${GREEN}✓${NC} API Server: ${YELLOW}${API_SERVER}${NC}"
echo ""

# Step 1: Create namespace if it doesn't exist
echo -e "${BLUE}[1/6]${NC} Checking namespace..."
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓${NC} Namespace '${NAMESPACE}' already exists"
else
    kubectl create namespace "$NAMESPACE"
    echo -e "${GREEN}✓${NC} Created namespace '${NAMESPACE}'"
fi
echo ""

# Step 2: Create service account
echo -e "${BLUE}[2/6]${NC} Creating service account..."
if kubectl get serviceaccount "$SA_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Service account '${SA_NAME}' already exists, skipping..."
else
    kubectl create serviceaccount "$SA_NAME" -n "$NAMESPACE"
    echo -e "${GREEN}✓${NC} Created service account '${SA_NAME}'"
fi
echo ""

# Step 3: Create ClusterRole with Velero permissions
echo -e "${BLUE}[3/6]${NC} Creating ClusterRole..."
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: velero-dashboard
rules:
# Velero resources
- apiGroups: ["velero.io"]
  resources: ["backups", "restores", "schedules", "backupstoragelocations", "volumesnapshotlocations"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["velero.io"]
  resources: ["backups/status", "restores/status", "schedules/status"]
  verbs: ["get", "list", "watch"]
# Core resources (for logs, pods, etc)
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["namespaces", "persistentvolumes", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch"]
EOF
echo -e "${GREEN}✓${NC} Created ClusterRole 'velero-dashboard'"
echo ""

# Step 4: Create ClusterRoleBinding
echo -e "${BLUE}[4/6]${NC} Creating ClusterRoleBinding..."
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: velero-dashboard
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: velero-dashboard
subjects:
- kind: ServiceAccount
  name: ${SA_NAME}
  namespace: ${NAMESPACE}
EOF
echo -e "${GREEN}✓${NC} Created ClusterRoleBinding"
echo ""

# Step 5: Create token secret (for K8s < 1.24 compatibility)
echo -e "${BLUE}[5/6]${NC} Creating token secret..."
SECRET_NAME="${SA_NAME}-token"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET_NAME}
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/service-account.name: ${SA_NAME}
type: kubernetes.io/service-account-token
EOF
echo -e "${GREEN}✓${NC} Created token secret"
echo ""

# Wait for token to be populated
echo -e "${BLUE}[6/6]${NC} Waiting for token to be generated..."
sleep 3

# Get token and CA certificate
TOKEN=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.ca\.crt}')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get token. The secret might not be ready yet.${NC}"
    echo -e "${YELLOW}   Try running: kubectl get secret ${SECRET_NAME} -n ${NAMESPACE} -o jsonpath='{.data.token}' | base64 -d${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Token generated successfully!"
echo ""

# Output credentials
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Credentials Ready!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Use these credentials in Velero Dashboard:${NC}"
echo ""
echo -e "${BLUE}1. API Server URL:${NC}"
echo -e "   ${API_SERVER}"
echo ""
echo -e "${BLUE}2. Bearer Token:${NC}"
echo -e "   ${TOKEN}"
echo ""
echo -e "${BLUE}3. CA Certificate (base64):${NC}"
echo -e "   ${CA_CERT}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Go to your Velero Dashboard: ${YELLOW}http://localhost:3001/clusters${NC}"
echo -e "  2. Click '${YELLOW}Add Cluster${NC}'"
echo -e "  3. Select '${YELLOW}Service Account Token${NC}' authentication"
echo -e "  4. Fill in the credentials above"
echo -e "  5. Set namespace to: ${YELLOW}${NAMESPACE}${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Optionally save to file
read -p "$(echo -e ${YELLOW}Save credentials to file? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    OUTPUT_FILE="gke-credentials-${CLUSTER_NAME}.txt"
    cat > "$OUTPUT_FILE" <<EOF
Velero Dashboard Credentials
=============================
Cluster: ${CLUSTER_NAME}
Generated: $(date)

API Server URL:
${API_SERVER}

Bearer Token:
${TOKEN}

CA Certificate (base64):
${CA_CERT}

Namespace: ${NAMESPACE}
Service Account: ${SA_NAME}
EOF
    echo -e "${GREEN}✓${NC} Credentials saved to: ${YELLOW}${OUTPUT_FILE}${NC}"
    echo -e "${RED}⚠${NC}  ${YELLOW}Keep this file secure! It contains sensitive credentials.${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
