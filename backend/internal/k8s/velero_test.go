package k8s

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
)

func newTestClient(t *testing.T, objects ...runtime.Object) *Client {
	t.Helper()

	scheme := runtime.NewScheme()

	fakeClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(
		scheme,
		map[schema.GroupVersionResource]string{
			BackupGVR:                "BackupList",
			RestoreGVR:               "RestoreList",
			ScheduleGVR:              "ScheduleList",
			BackupStorageLocationGVR: "BackupStorageLocationList",
			VolumeSnapshotLocationGVR: "VolumeSnapshotLocationList",
			DeleteBackupRequestGVR:   "DeleteBackupRequestList",
		},
		objects...,
	)

	logger, _ := zap.NewDevelopment()
	return &Client{
		dynamic:   fakeClient,
		namespace: "velero",
		logger:    logger,
	}
}

func makeBackup(name, phase string, errors, warnings int64) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Backup",
			"metadata": map[string]interface{}{
				"name":              name,
				"namespace":         "velero",
				"creationTimestamp": time.Now().UTC().Format(time.RFC3339),
			},
			"spec": map[string]interface{}{
				"storageLocation": "default",
				"ttl":             "720h",
			},
			"status": map[string]interface{}{
				"phase":    phase,
				"errors":   errors,
				"warnings": warnings,
			},
		},
	}
}

func makeRestore(name, backupName, phase string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Restore",
			"metadata": map[string]interface{}{
				"name":              name,
				"namespace":         "velero",
				"creationTimestamp": time.Now().UTC().Format(time.RFC3339),
			},
			"spec": map[string]interface{}{
				"backupName": backupName,
			},
			"status": map[string]interface{}{
				"phase": phase,
			},
		},
	}
}

func makeSchedule(name, schedule, phase string, paused bool) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Schedule",
			"metadata": map[string]interface{}{
				"name":              name,
				"namespace":         "velero",
				"creationTimestamp": time.Now().UTC().Format(time.RFC3339),
			},
			"spec": map[string]interface{}{
				"schedule": schedule,
				"paused":   paused,
				"template": map[string]interface{}{
					"storageLocation": "default",
					"ttl":             "720h",
				},
			},
			"status": map[string]interface{}{
				"phase": phase,
			},
		},
	}
}

func makeBSL(name, provider, bucket, phase string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "BackupStorageLocation",
			"metadata": map[string]interface{}{
				"name":              name,
				"namespace":         "velero",
				"creationTimestamp": time.Now().UTC().Format(time.RFC3339),
			},
			"spec": map[string]interface{}{
				"provider": provider,
				"objectStorage": map[string]interface{}{
					"bucket": bucket,
				},
				"accessMode": "ReadWrite",
			},
			"status": map[string]interface{}{
				"phase": phase,
			},
		},
	}
}

// --- Tests ---

func TestListBackups(t *testing.T) {
	client := newTestClient(t,
		makeBackup("backup-1", "Completed", 0, 0),
		makeBackup("backup-2", "Failed", 2, 1),
		makeBackup("backup-3", "InProgress", 0, 0),
	)

	backups, err := client.ListBackups(context.Background())
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 3 {
		t.Errorf("expected 3 backups, got %d", len(backups))
	}
}

func TestGetBackup(t *testing.T) {
	client := newTestClient(t, makeBackup("my-backup", "Completed", 0, 3))

	backup, err := client.GetBackup(context.Background(), "my-backup")
	if err != nil {
		t.Fatalf("GetBackup failed: %v", err)
	}

	if backup.Name != "my-backup" {
		t.Errorf("expected name 'my-backup', got '%s'", backup.Name)
	}
	if backup.Phase != "Completed" {
		t.Errorf("expected phase 'Completed', got '%s'", backup.Phase)
	}
	if backup.Warnings != 3 {
		t.Errorf("expected 3 warnings, got %d", backup.Warnings)
	}
}

func TestGetBackupNotFound(t *testing.T) {
	client := newTestClient(t)

	_, err := client.GetBackup(context.Background(), "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent backup")
	}
}

func TestCreateBackup(t *testing.T) {
	client := newTestClient(t)

	req := CreateBackupRequest{
		Name:               "new-backup",
		IncludedNamespaces: []string{"default", "production"},
		StorageLocation:    "default",
		TTL:                "720h",
	}

	backup, err := client.CreateBackup(context.Background(), req)
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	if backup.Name != "new-backup" {
		t.Errorf("expected name 'new-backup', got '%s'", backup.Name)
	}

	// Verify it was actually created
	list, _ := client.ListBackups(context.Background())
	if len(list) != 1 {
		t.Errorf("expected 1 backup after create, got %d", len(list))
	}
}

func TestDeleteBackup(t *testing.T) {
	client := newTestClient(t, makeBackup("to-delete", "Completed", 0, 0))

	err := client.DeleteBackup(context.Background(), "to-delete")
	if err != nil {
		t.Fatalf("DeleteBackup failed: %v", err)
	}

	// Verify a DeleteBackupRequest was created
	list, err := client.dynamic.Resource(DeleteBackupRequestGVR).Namespace("velero").List(
		context.Background(), metav1.ListOptions{},
	)
	if err != nil {
		t.Fatalf("Failed to list delete requests: %v", err)
	}
	if len(list.Items) != 1 {
		t.Errorf("expected 1 delete request, got %d", len(list.Items))
	}
}

func TestListRestores(t *testing.T) {
	client := newTestClient(t,
		makeRestore("restore-1", "backup-1", "Completed"),
		makeRestore("restore-2", "backup-2", "InProgress"),
	)

	restores, err := client.ListRestores(context.Background())
	if err != nil {
		t.Fatalf("ListRestores failed: %v", err)
	}

	if len(restores) != 2 {
		t.Errorf("expected 2 restores, got %d", len(restores))
	}
	if restores[0].BackupName != "backup-1" {
		t.Errorf("expected backupName 'backup-1', got '%s'", restores[0].BackupName)
	}
}

func TestCreateRestore(t *testing.T) {
	client := newTestClient(t)

	req := CreateRestoreRequest{
		BackupName:         "my-backup",
		IncludedNamespaces: []string{"default"},
	}

	restore, err := client.CreateRestore(context.Background(), req)
	if err != nil {
		t.Fatalf("CreateRestore failed: %v", err)
	}

	// Note: spec.backupName isn't returned in status on creation
	if restore.Name == "" {
		t.Error("expected auto-generated restore name")
	}
}

func TestListSchedules(t *testing.T) {
	client := newTestClient(t,
		makeSchedule("daily", "0 2 * * *", "Enabled", false),
		makeSchedule("weekly", "0 0 * * 0", "Enabled", true),
	)

	schedules, err := client.ListSchedules(context.Background())
	if err != nil {
		t.Fatalf("ListSchedules failed: %v", err)
	}

	if len(schedules) != 2 {
		t.Errorf("expected 2 schedules, got %d", len(schedules))
	}

	// Find the paused one
	for _, s := range schedules {
		if s.Name == "weekly" && !s.Paused {
			t.Error("expected weekly schedule to be paused")
		}
		if s.Name == "daily" && s.Paused {
			t.Error("expected daily schedule to NOT be paused")
		}
	}
}

func TestCreateSchedule(t *testing.T) {
	client := newTestClient(t)

	req := CreateScheduleRequest{
		Name:     "hourly",
		Schedule: "0 * * * *",
		TTL:      "48h",
	}

	schedule, err := client.CreateSchedule(context.Background(), req)
	if err != nil {
		t.Fatalf("CreateSchedule failed: %v", err)
	}

	if schedule.Name != "hourly" {
		t.Errorf("expected name 'hourly', got '%s'", schedule.Name)
	}
}

func TestUpdateSchedule(t *testing.T) {
	client := newTestClient(t,
		makeSchedule("my-schedule", "0 2 * * *", "Enabled", false),
	)

	// Pause it
	paused := true
	schedule, err := client.UpdateSchedule(context.Background(), "my-schedule", UpdateScheduleRequest{
		Paused: &paused,
	})
	if err != nil {
		t.Fatalf("UpdateSchedule (pause) failed: %v", err)
	}

	if !schedule.Paused {
		t.Error("expected schedule to be paused after update")
	}

	// Unpause it
	unpaused := false
	schedule, err = client.UpdateSchedule(context.Background(), "my-schedule", UpdateScheduleRequest{
		Paused: &unpaused,
	})
	if err != nil {
		t.Fatalf("UpdateSchedule (unpause) failed: %v", err)
	}

	if schedule.Paused {
		t.Error("expected schedule to be unpaused after update")
	}

	// Update cron expression
	newCron := "0 3 * * *"
	schedule, err = client.UpdateSchedule(context.Background(), "my-schedule", UpdateScheduleRequest{
		Schedule: &newCron,
	})
	if err != nil {
		t.Fatalf("UpdateSchedule (cron) failed: %v", err)
	}

	if schedule.Schedule != "0 3 * * *" {
		t.Errorf("expected cron '0 3 * * *', got '%s'", schedule.Schedule)
	}
}

func TestDeleteSchedule(t *testing.T) {
	client := newTestClient(t,
		makeSchedule("to-delete", "0 2 * * *", "Enabled", false),
	)

	err := client.DeleteSchedule(context.Background(), "to-delete")
	if err != nil {
		t.Fatalf("DeleteSchedule failed: %v", err)
	}

	list, _ := client.ListSchedules(context.Background())
	if len(list) != 0 {
		t.Errorf("expected 0 schedules after delete, got %d", len(list))
	}
}

func TestListBackupStorageLocations(t *testing.T) {
	client := newTestClient(t,
		makeBSL("default", "aws", "my-bucket", "Available"),
		makeBSL("secondary", "gcp", "gcp-bucket", "Unavailable"),
	)

	locations, err := client.ListBackupStorageLocations(context.Background())
	if err != nil {
		t.Fatalf("ListBSL failed: %v", err)
	}

	if len(locations) != 2 {
		t.Errorf("expected 2 BSLs, got %d", len(locations))
	}

	for _, l := range locations {
		if l.Name == "default" {
			if l.Provider != "aws" {
				t.Errorf("expected provider 'aws', got '%s'", l.Provider)
			}
			if l.Bucket != "my-bucket" {
				t.Errorf("expected bucket 'my-bucket', got '%s'", l.Bucket)
			}
			if l.Phase != "Available" {
				t.Errorf("expected phase 'Available', got '%s'", l.Phase)
			}
		}
	}
}

func TestGetDashboardStats(t *testing.T) {
	client := newTestClient(t,
		makeBackup("b1", "Completed", 0, 0),
		makeBackup("b2", "Completed", 0, 0),
		makeBackup("b3", "Failed", 1, 0),
		makeBackup("b4", "InProgress", 0, 0),
		makeRestore("r1", "b1", "Completed"),
		makeSchedule("s1", "0 2 * * *", "Enabled", false),
		makeSchedule("s2", "0 0 * * 0", "Enabled", true),
		makeBSL("default", "aws", "bucket", "Available"),
	)

	stats, err := client.GetDashboardStats(context.Background())
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}

	if stats.TotalBackups != 4 {
		t.Errorf("expected 4 total backups, got %d", stats.TotalBackups)
	}
	if stats.CompletedBackups != 2 {
		t.Errorf("expected 2 completed backups, got %d", stats.CompletedBackups)
	}
	if stats.FailedBackups != 1 {
		t.Errorf("expected 1 failed backup, got %d", stats.FailedBackups)
	}
	if stats.TotalRestores != 1 {
		t.Errorf("expected 1 restore, got %d", stats.TotalRestores)
	}
	if stats.TotalSchedules != 2 {
		t.Errorf("expected 2 schedules, got %d", stats.TotalSchedules)
	}
	if stats.ActiveSchedules != 1 {
		t.Errorf("expected 1 active schedule, got %d", stats.ActiveSchedules)
	}
	if stats.StorageLocations != 1 {
		t.Errorf("expected 1 storage location, got %d", stats.StorageLocations)
	}
	if stats.HealthyLocations != 1 {
		t.Errorf("expected 1 healthy location, got %d", stats.HealthyLocations)
	}
}

// --- Parser Tests ---

func TestParseBackup(t *testing.T) {
	obj := makeBackup("test", "Completed", 2, 5)
	obj.Object["spec"].(map[string]interface{})["includedNamespaces"] = []interface{}{"default", "kube-system"}

	b := parseBackup(*obj)

	if b.Name != "test" {
		t.Errorf("expected name 'test', got '%s'", b.Name)
	}
	if b.Phase != "Completed" {
		t.Errorf("expected phase 'Completed', got '%s'", b.Phase)
	}
	if b.Errors != 2 {
		t.Errorf("expected 2 errors, got %d", b.Errors)
	}
	if b.Warnings != 5 {
		t.Errorf("expected 5 warnings, got %d", b.Warnings)
	}
	if len(b.IncludedNamespaces) != 2 {
		t.Errorf("expected 2 included namespaces, got %d", len(b.IncludedNamespaces))
	}
	if b.StorageLocation != "default" {
		t.Errorf("expected storage 'default', got '%s'", b.StorageLocation)
	}
}

func TestParseSchedule(t *testing.T) {
	obj := makeSchedule("daily", "0 2 * * *", "Enabled", true)

	s := parseSchedule(*obj)

	if s.Name != "daily" {
		t.Errorf("expected name 'daily', got '%s'", s.Name)
	}
	if s.Schedule != "0 2 * * *" {
		t.Errorf("expected schedule '0 2 * * *', got '%s'", s.Schedule)
	}
	if !s.Paused {
		t.Error("expected paused=true")
	}
	if s.StorageLocation != "default" {
		t.Errorf("expected storage 'default', got '%s'", s.StorageLocation)
	}
}
