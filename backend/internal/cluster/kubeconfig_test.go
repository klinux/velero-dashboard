package cluster

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestTokenToKubeconfigBasic(t *testing.T) {
	kc := TokenToKubeconfig("my-cluster", "https://api.example.com:6443", "my-token", "", false)

	if !strings.Contains(kc, "server: https://api.example.com:6443") {
		t.Error("Missing server URL")
	}
	if !strings.Contains(kc, "token: my-token") {
		t.Error("Missing token")
	}
	if !strings.Contains(kc, "name: my-cluster") {
		t.Error("Missing cluster name")
	}
	if !strings.Contains(kc, "current-context: my-cluster") {
		t.Error("Missing current-context")
	}
	if strings.Contains(kc, "insecure-skip-tls-verify") {
		t.Error("Should not contain insecure-skip-tls-verify")
	}
	if strings.Contains(kc, "certificate-authority-data") {
		t.Error("Should not contain certificate-authority-data")
	}
}

func TestTokenToKubeconfigInsecureSkipTLS(t *testing.T) {
	kc := TokenToKubeconfig("test", "https://api.example.com", "token", "", true)

	if !strings.Contains(kc, "insecure-skip-tls-verify: true") {
		t.Error("Missing insecure-skip-tls-verify")
	}
	if strings.Contains(kc, "certificate-authority-data") {
		t.Error("Should not contain CA cert when skipTLS is true")
	}
}

func TestTokenToKubeconfigWithCACert(t *testing.T) {
	// Already base64 encoded
	caCert := base64.StdEncoding.EncodeToString([]byte("my-ca-cert"))
	kc := TokenToKubeconfig("test", "https://api.example.com", "token", caCert, false)

	if !strings.Contains(kc, "certificate-authority-data: "+caCert) {
		t.Error("Missing or incorrect CA certificate")
	}
	if strings.Contains(kc, "insecure-skip-tls-verify") {
		t.Error("Should not contain insecure-skip-tls-verify with CA cert")
	}
}

func TestTokenToKubeconfigWithRawCACert(t *testing.T) {
	// Raw cert (not base64) should be encoded
	rawCert := "-----BEGIN CERTIFICATE-----\nMIIDxTCC..."
	kc := TokenToKubeconfig("test", "https://api.example.com", "token", rawCert, false)

	expected := base64.StdEncoding.EncodeToString([]byte(rawCert))
	if !strings.Contains(kc, "certificate-authority-data: "+expected) {
		t.Error("Raw CA cert should be base64 encoded")
	}
}

func TestTokenToKubeconfigInsecureOverridesCACert(t *testing.T) {
	// When both insecureSkipTLS and caCert are set, insecure wins
	kc := TokenToKubeconfig("test", "https://api.example.com", "token", "some-cert", true)

	if !strings.Contains(kc, "insecure-skip-tls-verify: true") {
		t.Error("insecure-skip-tls-verify should be set")
	}
	if strings.Contains(kc, "certificate-authority-data") {
		t.Error("CA cert should not be present when insecure is true")
	}
}

func TestTokenToKubeconfigIsValidYAML(t *testing.T) {
	kc := TokenToKubeconfig("prod", "https://k8s.prod.example.com:6443", "eyJhbGciOiJSUzI1NiI...", "", true)

	if !strings.Contains(kc, "apiVersion: v1") {
		t.Error("Missing apiVersion")
	}
	if !strings.Contains(kc, "kind: Config") {
		t.Error("Missing kind")
	}
	if !strings.Contains(kc, "clusters:") {
		t.Error("Missing clusters section")
	}
	if !strings.Contains(kc, "contexts:") {
		t.Error("Missing contexts section")
	}
	if !strings.Contains(kc, "users:") {
		t.Error("Missing users section")
	}
}
