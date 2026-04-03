const BASE = "http://localhost:3000";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function download(url: string): Promise<{ fileName: string }> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Download failed: ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] ?? `export-${Date.now()}`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { fileName };
}

export const api = {
  dashboard: () => req<any>("/api/dashboard/summary"),
  categories: () => req<any[]>("/api/categories"),
  createCategory: (body: { name: string }) => req<any>("/api/categories", { method: "POST", body: JSON.stringify(body) }),
  patchCategory: (id: number, body: { name?: string; color?: string }) => req<any>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  mergeCategory: (sourceId: number, targetCategoryId: number) => req<any>(`/api/categories/${sourceId}/merge`, { method: "POST", body: JSON.stringify({ targetCategoryId }) }),
  migrateCategory: (sourceId: number, targetCategoryId: number) => req<any>(`/api/categories/${sourceId}/migrate`, { method: "POST", body: JSON.stringify({ targetCategoryId }) }),
  deleteCategory: (id: number) => req<any>(`/api/categories/${id}`, { method: "DELETE" }),
  items: (query = "") => req<any[]>(`/api/items${query}`),
  item: (id: number) => req<any>(`/api/items/${id}`),
  createItem: (body: any) => req<any>("/api/items", { method: "POST", body: JSON.stringify(body) }),
  updateItem: (id: number, body: any) => req<any>(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteItem: (id: number) => req<any>(`/api/items/${id}`, { method: "DELETE" }),
  updateItemStatus: (id: number, status: string) => req<any>(`/api/items/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  markUsed: (id: number) => req<any>(`/api/items/${id}/use`, { method: "PATCH" }),
  reminders: () => req<any[]>("/api/reminders"),
  completeAllReminders: () => req<{ success: boolean; count: number }>("/api/reminders/complete-all", { method: "PATCH" }),
  deleteAllReminders: () => req<{ success: boolean; count: number }>("/api/reminders", { method: "DELETE" }),
  doneReminder: (id: number) => req<any>(`/api/reminders/${id}/done`, { method: "PATCH" }),
  snoozeReminder: (id: number, until: string) => req<any>(`/api/reminders/${id}/snooze`, { method: "PATCH", body: JSON.stringify({ until }) }),
  analyticsSummary: () => req<any>("/api/analytics/summary"),
  analyticsCategories: () => req<any[]>("/api/analytics/categories"),
  highDailyCost: () => req<any[]>("/api/analytics/high-daily-cost"),
  idleItems: () => req<any[]>("/api/analytics/idle-items"),
  settings: () => req<any>("/api/settings"),
  patchSettings: (body: any) => req<any>("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  downloadExportJson: () => download("/api/export/json/download"),
  downloadExportCsv: () => download("/api/export/csv/download"),
  downloadExportBackup: () => download("/api/export/backup/download"),
  exportJson: () => req<any>("/api/export/json", { method: "POST" }),
  exportCsv: () => req<any>("/api/export/csv", { method: "POST" }),
  exportBackup: () => req<any>("/api/export/backup", { method: "POST" }),
};
