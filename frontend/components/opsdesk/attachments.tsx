"use client";
import { useState } from "react";
import { request } from "./ui";

type Attachment = { id: string; filename: string; size: number };
export function Attachments({
  messageId,
  author,
}: {
  messageId: string;
  author: boolean;
}) {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      setItems(await request(`messages/${messageId}/attachments`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load files.");
    }
  }
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (!file.size || file.size > 2 * 1024 * 1024)
        throw new Error("Choose a file between 1 byte and 2 MiB.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Unable to read file."));
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(file);
      });
      await request(`messages/${messageId}/attachments`, {
        filename: file.name,
        mimeType: file.type,
        base64,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    setError("");
    try {
      const link = await request(`attachments/${id}/download-link`, {});
      const response = await fetch(`/api/backend${link.url}`);
      if (!response.ok)
        throw new Error(
          "Download failed. Refresh the file list and try again.",
        );
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        items?.find((item) => item.id === id)?.filename || "attachment";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }
  return (
    <div>
      <button type="button" className="od-secondary" onClick={load}>
        View files
      </button>
      {author && (
        <label>
          {" "}
          Add file (PDF, PNG, JPEG or text; 2 MiB maximum)
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,text/plain"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {busy && <p role="status">Checking and uploading file…</p>}
      {items &&
        (items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => download(item.id)}>
                  {item.filename} ({Math.ceil(item.size / 1024)} KiB)
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No files attached.</p>
        ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
