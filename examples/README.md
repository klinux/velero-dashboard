# Velero Dashboard - Setup Examples

This directory contains helper scripts and examples for connecting various Kubernetes clusters to Velero Dashboard using token-based authentication.

## Overview

Velero Dashboard supports two authentication methods:

1. **Kubeconfig File** - Traditional method using kubeconfig
2. **Service Account Token** - Token-based authentication (recommended for managed clusters)

## When to Use Token Authentication

Use token authentication when:
- Working with managed Kubernetes services (GKE, EKS, AKS)
- The kubeconfig uses exec plugins (gke-gcloud-auth-plugin, aws-iam-authenticator, etc.)
- You want more control over permissions
- You need long-lived credentials without CLI tools

## Setup Scripts

### GKE (Google Kubernetes Engine)

**Prerequisites:**
- `gcloud` CLI installed and authenticated
- `kubectl` configured to access your GKE cluster
- Velero installed in the cluster

**Usage:**
```bash
# Connect to your GKE cluster
gcloud container clusters get-credentials CLUSTER_NAME --zone ZONE --project PROJECT_ID

# Run the setup script
./examples/gke-setup.sh

# With custom options
./examples/gke-setup.sh -n velero -s velero-dashboard
```

**What it does:**
1. Creates a service account in the specified namespace
2. Creates a ClusterRole with Velero permissions
3. Binds the role to the service account
4. Generates a long-lived token (10 years)
5. Outputs API server URL, token, and CA certificate

### EKS (Amazon Elastic Kubernetes Service)

**Prerequisites:**
- `aws` CLI installed and configured
- `kubectl` configured to access your EKS cluster
- Velero installed in the cluster

**Usage:**
```bash
# Connect to your EKS cluster
aws eks update-kubeconfig --name CLUSTER_NAME --region REGION

# Run the setup script
./examples/eks-setup.sh

# With custom options
./examples/eks-setup.sh -n velero -s velero-dashboard
```

## Manual Setup (Any Cluster)

If you prefer manual setup or want to understand the process:

### Step 1: Create Service Account

```bash
NAMESPACE=velero
SA_NAME=velero-dashboard

kubectl create namespace $NAMESPACE
kubectl create serviceaccount $SA_NAME -n $NAMESPACE
```

### Step 2: Create RBAC Permissions

```bash
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
# Core resources
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["namespaces", "persistentvolumes", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch"]
---
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
```

### Step 3: Create Token Secret

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ${SA_NAME}-token
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/service-account.name: ${SA_NAME}
type: kubernetes.io/service-account-token
EOF
```

### Step 4: Get Credentials

```bash
# API Server URL
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
echo "API Server: $API_SERVER"

# Bearer Token
TOKEN=$(kubectl get secret ${SA_NAME}-token -n ${NAMESPACE} -o jsonpath='{.data.token}' | base64 -d)
echo "Token: $TOKEN"

# CA Certificate (base64)
CA_CERT=$(kubectl get secret ${SA_NAME}-token -n ${NAMESPACE} -o jsonpath='{.data.ca\.crt}')
echo "CA Cert: $CA_CERT"
```

## Using Credentials in Dashboard

1. Navigate to `http://localhost:3001/clusters`
2. Click **"Add Cluster"**
3. Select **"Service Account Token"** as authentication method
4. Fill in the form:
   - **Cluster Name**: Choose a descriptive name (e.g., `gke-production`)
   - **Velero Namespace**: The namespace where Velero is installed (default: `velero`)
   - **API Server URL**: The API server endpoint from above
   - **Bearer Token**: The service account token
   - **CA Certificate**: The base64-encoded CA certificate (optional but recommended)
   - **Skip TLS Verification**: Only for development/testing (not recommended for production)
5. Click **"Add Cluster"**

## Troubleshooting

### Token Expired or Invalid
```bash
# Check if secret exists
kubectl get secret ${SA_NAME}-token -n ${NAMESPACE}

# Recreate token
kubectl delete secret ${SA_NAME}-token -n ${NAMESPACE}
# Re-run Step 3 above
```

### Permission Denied Errors
```bash
# Check ClusterRoleBinding
kubectl get clusterrolebinding velero-dashboard -o yaml

# Verify service account has correct permissions
kubectl auth can-i list backups.velero.io --as=system:serviceaccount:${NAMESPACE}:${SA_NAME}
```

### Connection Refused
- Verify API server URL is correct and accessible
- Check if firewall rules allow access to the API server
- Ensure CA certificate is correct (or use Skip TLS for testing)

### GKE Kubeconfig with exec Plugin Not Working
This is expected! GKE kubeconfigswith `gke-gcloud-auth-plugin` don't work in server environments. Use the token-based authentication instead (this is why we created these scripts).

## Security Best Practices

1. **Principle of Least Privilege**: The example ClusterRole grants broad permissions for Velero resources. For production, consider creating a more restrictive role.

2. **Token Rotation**: Periodically rotate service account tokens:
   ```bash
   kubectl delete secret ${SA_NAME}-token -n ${NAMESPACE}
   # Recreate the secret (Step 3)
   ```

3. **Network Security**:
   - Use network policies to restrict access to the dashboard
   - Consider using a VPN or bastion host for API server access
   - Enable TLS verification in production (don't use Skip TLS)

4. **Audit Logging**: Enable Kubernetes audit logging to track dashboard activities

5. **Multi-Tenancy**: If managing multiple teams:
   - Use separate namespaces for each team
   - Create Role (not ClusterRole) with namespace-scoped permissions
   - Use RoleBinding instead of ClusterRoleBinding

## Example: Namespace-Scoped Permissions

For a more secure setup with namespace-scoped access:

```bash
# Create role for single namespace
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: velero-dashboard
  namespace: ${NAMESPACE}
rules:
- apiGroups: ["velero.io"]
  resources: ["backups", "restores", "schedules", "backupstoragelocations", "volumesnapshotlocations"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: velero-dashboard
  namespace: ${NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: velero-dashboard
subjects:
- kind: ServiceAccount
  name: ${SA_NAME}
  namespace: ${NAMESPACE}
EOF
```

## Additional Resources

- [Velero Documentation](https://velero.io/docs/)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Service Account Tokens](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
- [GKE Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [EKS IAM Roles for Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
