#!/bin/bash
#
# EKS Service Account Setup for Velero Dashboard
#
# This script creates a service account in your EKS cluster with the necessary
# permissions to manage Velero backups, restores, and schedules.
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - kubectl configured to connect to your EKS cluster
#   - Velero installed in the cluster
#
# Usage:
#   ./eks-setup.sh [options]
#
# Options:
#   -n, --namespace NAMESPACE    Velero namespace (default: velero)
#   -s, --sa-name NAME          Service account name (default: velero-dashboard)
#   -h, --help                  Show this help message
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
NAMESPACE="velero"
SA_NAME="velero-dashboard"

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
        -h|--help)
            head -n 19 "$0" | tail -n +2 | sed 's/^# //'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  EKS Service Account Setup for Velero Dashboard${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Not connected to a Kubernetes cluster${NC}"
    exit 1
fi

CLUSTER_NAME=$(kubectl config current-context | cut -d'/' -f2)
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

echo -e "${GREEN}✓${NC} Connected to cluster: ${YELLOW}${CLUSTER_NAME}${NC}"
echo -e "${GREEN}✓${NC} API Server: ${YELLOW}${API_SERVER}${NC}"
echo ""

# Create namespace
echo -e "${BLUE}[1/5]${NC} Checking namespace..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓${NC} Namespace ready"
echo ""

# Create service account
echo -e "${BLUE}[2/5]${NC} Creating service account..."
kubectl create serviceaccount "$SA_NAME" -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓${NC} Service account created"
echo ""

# Create ClusterRole
echo -e "${BLUE}[3/5]${NC} Creating ClusterRole..."
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: velero-dashboard
rules:
- apiGroups: ["velero.io"]
  resources: ["backups", "restores", "schedules", "backupstoragelocations", "volumesnapshotlocations"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["velero.io"]
  resources: ["backups/status", "restores/status", "schedules/status"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "pods/log", "namespaces", "persistentvolumes", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch"]
EOF
echo -e "${GREEN}✓${NC} ClusterRole created"
echo ""

# Create ClusterRoleBinding
echo -e "${BLUE}[4/5]${NC} Creating ClusterRoleBinding..."
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
echo -e "${GREEN}✓${NC} ClusterRoleBinding created"
echo ""

# Create token secret
echo -e "${BLUE}[5/5]${NC} Creating token secret..."
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
sleep 3
echo -e "${GREEN}✓${NC} Token secret created"
echo ""

# Get credentials
TOKEN=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.ca\.crt}')

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Credentials Ready!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}API Server URL:${NC}"
echo "${API_SERVER}"
echo ""
echo -e "${BLUE}Bearer Token:${NC}"
echo "${TOKEN}"
echo ""
echo -e "${BLUE}CA Certificate:${NC}"
echo "${CA_CERT}"
echo ""
echo -e "${GREEN}✅ Setup complete! Add these credentials in the Velero Dashboard UI.${NC}"
