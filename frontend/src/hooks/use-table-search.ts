"use client";

import { useMemo, useState, useCallback } from "react";

interface UseTableSearchOptions<T> {
  data: T[];
  searchableFields: (keyof T)[];
  initialPageSize?: number;
}

interface UseTableSearchReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  paginatedRecords: T[];
  totalRecords: number;
}

export function useTableSearch<T extends object>({
  data,
  searchableFields,
  initialPageSize = 15,
}: UseTableSearchOptions<T>): UseTableSearchReturn<T> {
  const [search, setSearchRaw] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return data;
    const query = search.toLowerCase().trim();
    return data.filter((record) =>
      searchableFields.some((field) => {
        const value = record[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, search, searchableFields]);

  const totalRecords = filteredRecords.length;

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  return {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    paginatedRecords,
    totalRecords,
  };
}
