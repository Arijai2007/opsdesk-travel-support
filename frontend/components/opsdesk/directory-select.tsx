"use client";
import { useState, type ReactNode } from "react";
import { useOpsPage, PageControls } from "./paged-data";
export function DirectorySelect<T extends { id: string }>({
  path,
  label,
  value,
  onSelect,
  text,
  children,
  refresh,
  required = false,
  disabled = false,
}: {
  path: string;
  label: string;
  value: string;
  onSelect: (id: string, item?: T) => void;
  text: (item: T) => string;
  children?: ReactNode;
  refresh: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<T>();
  const resource = useOpsPage<T>(
    `${path}${path.includes("?") ? "&" : "?"}search=${encodeURIComponent(search)}`,
    refresh,
  );
  const items = resource.data?.items ?? [];
  return (
    <div>
      <input
        aria-label={`Search ${label}`}
        placeholder={`Search ${label}`}
        maxLength={100}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        value={value}
        required={required}
        disabled={disabled || !resource.data}
        onChange={(e) => {
          setPicked(items.find((v) => v.id === e.target.value));
          onSelect(
            e.target.value,
            items.find((v) => v.id === e.target.value),
          );
        }}
      >
        {children}
        {value && !items.some((v) => v.id === value) && (
          <option value={value}>
            {picked?.id === value ? text(picked) : "Current selection"}
          </option>
        )}
        {items.map((v) => (
          <option key={v.id} value={v.id}>
            {text(v)}
          </option>
        ))}
      </select>
      <PageControls resource={resource} label={label} />
    </div>
  );
}
