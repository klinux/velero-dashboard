import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSearch } from "@/hooks/use-table-search";

interface TestRecord {
  name: string;
  phase: string;
  storage: string;
  [key: string]: unknown;
}

const mockData: TestRecord[] = [
  { name: "backup-daily-001", phase: "Completed", storage: "default" },
  { name: "backup-daily-002", phase: "Failed", storage: "default" },
  { name: "backup-weekly-001", phase: "Completed", storage: "s3-primary" },
  { name: "backup-weekly-002", phase: "InProgress", storage: "s3-primary" },
  { name: "migration-prod", phase: "Completed", storage: "gcs-backup" },
  { name: "test-backup", phase: "PartiallyFailed", storage: "default" },
  { name: "snapshot-db", phase: "Completed", storage: "gcs-backup" },
  { name: "nightly-full", phase: "Completed", storage: "s3-primary" },
  { name: "manual-hotfix", phase: "Completed", storage: "default" },
  { name: "pre-deploy-check", phase: "Failed", storage: "gcs-backup" },
  { name: "staging-backup", phase: "Completed", storage: "default" },
  { name: "dr-test-001", phase: "Completed", storage: "s3-primary" },
  { name: "dr-test-002", phase: "InProgress", storage: "s3-primary" },
  { name: "archive-2024", phase: "Completed", storage: "gcs-backup" },
  { name: "quarterly-audit", phase: "Completed", storage: "default" },
  { name: "restore-test", phase: "Failed", storage: "default" },
  { name: "canary-backup", phase: "Completed", storage: "s3-primary" },
];

describe("useTableSearch", () => {
  it("returns all records when search is empty", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    expect(result.current.totalRecords).toBe(17);
    expect(result.current.search).toBe("");
  });

  it("paginates with default page size of 15", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    expect(result.current.paginatedRecords.length).toBe(15);
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(15);
  });

  it("shows remaining records on page 2", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.paginatedRecords.length).toBe(2);
  });

  it("respects custom initialPageSize", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
        initialPageSize: 5,
      })
    );

    expect(result.current.paginatedRecords.length).toBe(5);
    expect(result.current.pageSize).toBe(5);
  });

  it("filters records by name", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("weekly");
    });

    expect(result.current.totalRecords).toBe(2);
    expect(result.current.paginatedRecords.every((r) => r.name.includes("weekly"))).toBe(true);
  });

  it("filters records by phase", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("Failed");
    });

    expect(result.current.totalRecords).toBe(4); // 3x Failed + 1x PartiallyFailed
  });

  it("filters case-insensitively", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("COMPLETED");
    });

    const completedCount = mockData.filter((r) => r.phase === "Completed").length;
    expect(result.current.totalRecords).toBe(completedCount);
  });

  it("filters by storage location", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("gcs");
    });

    expect(result.current.totalRecords).toBe(
      mockData.filter((r) => r.storage.includes("gcs")).length
    );
  });

  it("resets to page 1 when search changes", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
        initialPageSize: 5,
      })
    );

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.setSearch("backup");
    });
    expect(result.current.page).toBe(1);
  });

  it("handles empty data array", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: [] as TestRecord[],
        searchableFields: ["name", "phase", "storage"],
      })
    );

    expect(result.current.totalRecords).toBe(0);
    expect(result.current.paginatedRecords).toEqual([]);
  });

  it("handles search with no results", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("nonexistent-xyz-12345");
    });

    expect(result.current.totalRecords).toBe(0);
    expect(result.current.paginatedRecords).toEqual([]);
  });

  it("updates page size correctly", () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchableFields: ["name", "phase", "storage"],
        initialPageSize: 5,
      })
    );

    expect(result.current.paginatedRecords.length).toBe(5);

    act(() => {
      result.current.setPageSize(10);
    });

    expect(result.current.paginatedRecords.length).toBe(10);
    expect(result.current.pageSize).toBe(10);
  });

  it("ignores null/undefined field values during search", () => {
    const dataWithNulls = [
      { name: "test", phase: null, storage: "default" },
      { name: null, phase: "Completed", storage: "s3" },
    ] as unknown as TestRecord[];

    const { result } = renderHook(() =>
      useTableSearch({
        data: dataWithNulls,
        searchableFields: ["name", "phase", "storage"],
      })
    );

    act(() => {
      result.current.setSearch("test");
    });

    expect(result.current.totalRecords).toBe(1);
  });
});
