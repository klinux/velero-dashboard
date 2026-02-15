package cluster

import (
	"encoding/base64"
	"fmt"
)

// TokenToKubeconfig generates a kubeconfig YAML from token-based auth
func TokenToKubeconfig(clusterName, apiServer, token, caCert string, insecureSkipTLS bool) string {
	kubeconfig := fmt.Sprintf(`apiVersion: v1
kind: Config
clusters:
- cluster:
    server: %s`, apiServer)

	if insecureSkipTLS {
		kubeconfig += `
    insecure-skip-tls-verify: true`
	} else if caCert != "" {
		// Ensure CA cert is base64 encoded
		caCertBase64 := caCert
		if _, err := base64.StdEncoding.DecodeString(caCert); err != nil {
			// Not base64, encode it
			caCertBase64 = base64.StdEncoding.EncodeToString([]byte(caCert))
		}
		kubeconfig += fmt.Sprintf(`
    certificate-authority-data: %s`, caCertBase64)
	}

	kubeconfig += fmt.Sprintf(`
  name: %s
contexts:
- context:
    cluster: %s
    user: %s
  name: %s
current-context: %s
users:
- name: %s
  user:
    token: %s
`, clusterName, clusterName, clusterName, clusterName, clusterName, clusterName, token)

	return kubeconfig
}
