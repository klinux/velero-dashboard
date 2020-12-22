IMG="klinux/velero-dashboard"
VERSION="0.0.1"
DOCKER_DIR="utils/docker"
DEV="velero-dashboard"
IP=192.168.0.146
KUBECONFIG="${PWD}/utils/config"
MINIKUBE_HOME="/tmp/minikube"
KUBERNETES_VERSION="v1.19.0"

.PHONY: help
help:
	 @awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
.DEFAULT_GOAL := help

# TASKS
image: ## Build and push image
	docker build -t ${IMG}:${VERSION} -f ${DOCKER_DIR}/Dockerfile .
	docker build -t ${IMG}:latest -f ${DOCKER_DIR}/Dockerfile .
	docker push ${IMG}:${VERSION}
	docker push ${IMG}:latest

dev: ## Run in development mode
	docker build -t ${DEV} --target dev -f ${DOCKER_DIR}/Dockerfile-dev .
	docker-compose -f ${DOCKER_DIR}/docker-compose.yaml up

stop: ## Stop development mode
	docker-compose -f ${DOCKER_DIR}/docker-compose.yaml down

kube: ## Depploy velero dashboard
	kubectl apply -f utils/kubernetes -n velero

minikube: ## Run minikube cluster
	export KUBECONFIG=${KUBECONFIG}; export MINIKUBE_HOME=${MINIKUBE_HOME}; minikube start --cni=bridge --kubernetes-version=${KUBERNETES_VERSION}
	docker stop minio || true && docker rm -f minio || true
	docker run --name minio -d -p 9000:9000 -e "MINIO_ACCESS_KEY=minioadmin" -e "MINIO_SECRET_KEY=minioadmin" -v /tmp/data:/data minio/minio server /data
	sleep 5
	docker run --entrypoint="" minio/mc /bin/sh -c "/usr/bin/mc config host add server http://${IP}:9000 minioadmin minioadmin; /usr/bin/mc mb server/velero; exit 0;"
	velero install --provider aws --use-restic --plugins velero/velero-plugin-for-aws --bucket velero --secret-file ./utils/minio.credentials --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=http://${IP}:9000 --kubeconfig ${KUBECONFIG}
	export KUBECONFIG=${KUBECONFIG}; kubectl create ns namespace1 || true
	export KUBECONFIG=${KUBECONFIG}; kubectl create ns namespace2 || true
	velero backup create namespace1 --include-namespaces napespace1 --kubeconfig ${KUBECONFIG} || true
	velero backup create namespace2 --include-namespaces napespace2 --kubeconfig ${KUBECONFIG} || true
	# sed -i -e 's/[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}/${IP}/g' utils/config || true

ministop: ## Stop minikube
	export KUBECONFIG=${KUBECONFIG}; export MINIKUBE_HOME=${MINIKUBE_HOME}; minikube stop
	docker stop minio || true && docker rm -f minio || true

miniclean: ## Clean minikube installation
	export KUBECONFIG=${KUBECONFIG}; export MINIKUBE_HOME=${MINIKUBE_HOME}; minikube stop
	export KUBECONFIG=${KUBECONFIG}; export MINIKUBE_HOME=${MINIKUBE_HOME}; minikube delete
