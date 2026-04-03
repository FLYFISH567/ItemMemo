import { FormEvent, ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";

export const DATA_CHANGED_EVENT = "writedown:data-changed";

export type ToastType = "success" | "info" | "warning" | "error";

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

export const ToastContext = createContext<{ pushToast: (message: string, type?: ToastType) => void }>({
  pushToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function formatMoney(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mm}`;
}

export function formatDays(days: number) {
  return `${Math.max(0, Number(days || 0))} 天`;
}

export function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function calcElapsedDaysFrom(ref: string | Date | null | undefined) {
  if (!ref) return 0;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (24 * 3600 * 1000)));
}

export function statusText(status: string) {
  const map: Record<string, string> = {
    IN_USE: "使用中",
    IDLE: "闲置中",
    REPLACE_SOON: "待更换",
    RESTOCK_SOON: "待补购",
  };
  return map[status] ?? status;
}

export function statusTagClass(status: string) {
  const map: Record<string, string> = {
    IN_USE: "tag tag-green",
    IDLE: "tag tag-gray",
    REPLACE_SOON: "tag tag-amber",
    RESTOCK_SOON: "tag tag-pink",
  };
  return map[status] ?? "tag";
}

export function reminderTypeText(type: string) {
  const map: Record<string, string> = {
    FIXED_CYCLE: "固定周期",
    OWNED_DAYS: "持有天数",
    HIGH_DAILY_COST: "高日均成本",
    RESTOCK: "补货提醒",
  };
  return map[type] ?? type;
}

export function reminderStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待处理",
    DONE: "已完成",
    SNOOZED: "已稍后",
  };
  return map[status] ?? status;
}

export function reminderStatusTagClass(status: string) {
  const map: Record<string, string> = {
    PENDING: "tag tag-red",
    DONE: "tag tag-gray",
    SNOOZED: "tag tag-amber",
  };
  return map[status] ?? "tag";
}

export function reminderReason(reminder: any) {
  if (reminder.type === "HIGH_DAILY_COST") return "该物品日均成本超过阈值";
  if (reminder.type === "RESTOCK") return "库存或消耗状态触发补购提醒";
  if (reminder.type === "OWNED_DAYS") return "持有时长到达提醒规则";
  return "到达预设提醒条件";
}

export function reminderSuggestion(reminder: any) {
  if (reminder.type === "HIGH_DAILY_COST") return "评估是否继续持有或调整使用频率";
  if (reminder.type === "RESTOCK") return "确认库存并安排补购";
  if (reminder.type === "OWNED_DAYS") return "检查物品状态并更新计划";
  return "查看物品详情后处理";
}

export function isAttentionItem(item: any, highDailyCostThreshold: number, idleDaysThreshold: number) {
  const idleRef = item.lastUsedAt ?? item.statusUpdatedAt;
  const idleDays = calcElapsedDaysFrom(idleRef);
  if (item.dailyCost >= highDailyCostThreshold) return true;
  if (idleDays >= idleDaysThreshold) return true;
  return ["IDLE", "REPLACE_SOON", "RESTOCK_SOON"].includes(item.status);
}

export function CategoryJump({ id, name }: { id?: number; name: string }) {
  if (!id) return <span>{name}</span>;
  return (
    <NavLink className="category-jump" to={`/categories?categoryId=${id}`}>
      {name}
    </NavLink>
  );
}

export function EmptyStateAction({
  title,
  description,
  actionLabel,
  to,
  onClick,
  variant,
}: {
  title: string;
  description: string;
  actionLabel: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "cost" | "idle" | "reminder" | "category";
}) {
  return (
    <div className={`empty-note empty-action-note ${variant ? `empty-${variant}` : ""}`}>
      <strong>{title}</strong>
      <p>{description}</p>
      {to ? (
        <NavLink className="ghost-btn" to={to}>{actionLabel}</NavLink>
      ) : (
        <button className="ghost-btn" type="button" onClick={onClick}>{actionLabel}</button>
      )}
    </div>
  );
}

export function sortCategoriesByRule(list: any[]) {
  return [...list].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), "zh-CN-u-co-pinyin", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export function formatPriceInput(rawValue: string) {
  const normalized = rawValue.replace(/,/g, "").trim();
  if (normalized === "") return "";
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) return null;

  const [intPartRaw, decimalPart] = normalized.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "");
  const safeInt = intPart === "" ? "0" : intPart;
  const formattedInt = safeInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (normalized.endsWith(".")) return `${formattedInt}.`;
  if (typeof decimalPart !== "undefined") return `${formattedInt}.${decimalPart}`;
  return formattedInt;
}

export function normalizeDateInput(rawValue: string) {
  const cleaned = rawValue.trim();
  const match = cleaned.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const normalized = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
  return normalized;
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "年/月/日",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const element = pickerRef.current as HTMLInputElement & { showPicker?: () => void };
    if (element?.showPicker) {
      element.showPicker();
      return;
    }
    element?.focus();
    element?.click();
  };

  const display = value ? value.replace(/-/g, "/") : placeholder;

  return (
    <div className="date-field date-picker-field" onClick={openPicker}>
      <span className="date-label">{label}</span>
      <span className={`date-display ${value ? "" : "placeholder"}`}>{display}</span>
      <button className="date-icon-btn" type="button" onClick={openPicker} aria-label="选择日期">📅</button>
      <input
        ref={pickerRef}
        className="date-native-hidden"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function routeMeta(pathname: string) {
  if (pathname.startsWith("/items/")) {
    return { title: "物品详情", subtitle: "查看单个物品的完整信息与状态。" };
  }
  const entries: Record<string, { title: string; subtitle: string }> = {
    "/": { title: "首页总览", subtitle: "记录物品，记录生活" },
    "/items": { title: "物品列表", subtitle: "集中管理所有物品，支持搜索与快速操作。" },
    "/categories": { title: "分类管理", subtitle: "维护分类结构，保证列表筛选与统计口径稳定。" },
    "/reminders": { title: "提醒中心", subtitle: "处理固定周期、补购与高日均成本提醒。" },
    "/analytics": { title: "统计分析", subtitle: "查看分类分布、闲置项与高成本项。" },
    "/settings": { title: "设置", subtitle: "管理阈值参数与导出行为。" },
  };
  return entries[pathname] ?? entries["/"];
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const meta = routeMeta(location.pathname);
  const breadcrumbName = location.pathname === "/" ? "主页" : meta.title;

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCategories, setQuickCategories] = useState<any[]>([]);
  const [quickForm, setQuickForm] = useState({
    name: "",
    categoryId: 1,
    price: "",
    purchaseDate: "",
    status: "IN_USE",
    note: "",
  });
  const sortedQuickCategories = useMemo(() => sortCategoriesByRule(quickCategories), [quickCategories]);

  const openQuickCreate = async () => {
    try {
      if (quickCategories.length === 0) {
        const cats = await api.categories();
        setQuickCategories(cats);
        const sorted = sortCategoriesByRule(cats);
        if (sorted[0]) {
          setQuickForm((prev) => ({ ...prev, categoryId: sorted[0].id }));
        }
      }
      setQuickCreateOpen(true);
    } catch {
      pushToast("读取分类失败，请稍后重试", "error");
    }
  };

  const onQuickCreate = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = Number(quickForm.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(quickForm.purchaseDate);

    if (!quickForm.name.trim()) {
      pushToast("请输入物品名称", "warning");
      return;
    }
    if (quickForm.price.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("请输入有效价格", "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("日期格式请使用 年/月/日，例如 2026/04/03", "warning");
      return;
    }

    try {
      await api.createItem({ ...quickForm, price: priceNum, purchaseDate });
      const fallbackId = sortedQuickCategories[0]?.id ?? 1;
      setQuickForm({ name: "", categoryId: fallbackId, price: "", purchaseDate: "", status: "IN_USE", note: "" });
      setQuickCreateOpen(false);
      emitDataChanged();
      pushToast("物品已新增", "success");
    } catch {
      pushToast("新增失败，请重试", "error");
    }
  };

  return (
    <div className="shell">
      <aside className="left-rail">
        <div className="brand-card">
          <div className="brand-dot">▣</div>
          <div>
            <p className="brand-title">物记</p>
            <p className="brand-sub">记录物品，记录生活</p>
          </div>
        </div>

        <nav className="nav-list">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>首页总览</NavLink>
          <NavLink to="/items" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>物品列表</NavLink>
          <NavLink to="/categories" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>分类管理</NavLink>
          <NavLink to="/reminders" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>提醒中心</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>统计分析</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>设置</NavLink>
        </nav>

        <div className="quick-box">
          <p className="quick-title">快捷操作</p>
          <p className="quick-desc">快速新增一条物品记录。</p>
          <button className="quick-btn" type="button" onClick={() => void openQuickCreate()}>新增物品</button>
        </div>
      </aside>

      <main className="content-wrap">
        <header className="top-bar panel">
          <div>
            <div className="breadcrumb">物记 <span>›</span> {breadcrumbName}</div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="top-actions" />
        </header>
        {children}
      </main>

      {quickCreateOpen && (
        <div className="modal-mask" onClick={() => setQuickCreateOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>新增物品</h2>
                <p>快速录入一条物品记录，不离开当前页面。</p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setQuickCreateOpen(false)}>×</button>
            </div>

            <form onSubmit={onQuickCreate}>
              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    物品名称
                    <input required value={quickForm.name} onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })} />
                  </label>
                  <label>
                    分类
                    <select value={quickForm.categoryId} onChange={(e) => setQuickForm({ ...quickForm, categoryId: Number(e.target.value) })}>
                      {sortedQuickCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>
                    价格
                    <div className="price-field">
                      <span className="price-label">¥</span>
                      <input
                        value={quickForm.price}
                        onChange={(e) => {
                          const formatted = formatPriceInput(e.target.value);
                          if (formatted !== null) setQuickForm({ ...quickForm, price: formatted });
                        }}
                      />
                    </div>
                  </label>
                  <label>
                    购买日期
                    <DatePickerField label="日期" value={quickForm.purchaseDate} onChange={(next) => setQuickForm({ ...quickForm, purchaseDate: next })} />
                  </label>
                </div>
              </section>

              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    当前状态
                    <select value={quickForm.status} onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}>
                      <option value="IN_USE">使用中</option>
                      <option value="IDLE">闲置中</option>
                      <option value="REPLACE_SOON">待更换</option>
                      <option value="RESTOCK_SOON">待补购</option>
                    </select>
                  </label>
                  <label>
                    备注
                    <input value={quickForm.note} onChange={(e) => setQuickForm({ ...quickForm, note: e.target.value })} placeholder="可选：补充说明" />
                  </label>
                </div>
              </section>

              <div className="edit-footer">
                <button className="ghost-btn" type="button" onClick={() => setQuickCreateOpen(false)}>取消</button>
                <button className="primary-btn" type="submit">保存物品</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
          setQuickForm((prev) => ({ ...prev, categoryId: sorted[0].id }));
        }
      }
      setQuickCreateOpen(true);
    } catch {
      pushToast("璇诲彇鍒嗙被澶辫触锛岃绋嶅悗閲嶈瘯", "error");
    }
  };

  const onQuickCreate = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = Number(quickForm.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(quickForm.purchaseDate);

    if (!quickForm.name.trim()) {
      pushToast("璇疯緭鍏ョ墿鍝佸悕绉?, "warning");
      return;
    }
    if (quickForm.price.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("璇疯緭鍏ユ湁鏁堜环鏍?, "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("鏃ユ湡鏍煎紡璇蜂娇鐢?骞?鏈?鏃ワ紝渚嬪 2026/04/03", "warning");
      return;
    }

    try {
      await api.createItem({ ...quickForm, price: priceNum, purchaseDate });
      const fallbackId = sortedQuickCategories[0]?.id ?? 1;
      setQuickForm({ name: "", categoryId: fallbackId, price: "", purchaseDate: "", status: "IN_USE", note: "" });
      setQuickCreateOpen(false);
      emitDataChanged();
      pushToast("鐗╁搧宸叉柊澧?, "success");
    } catch {
      pushToast("鏂板澶辫触锛岃閲嶈瘯", "error");
    }
  };

  return (
    <div className="shell">
      <aside className="left-rail">
        <div className="brand-card">
          <div className="brand-dot">鈻?/div>
          <div>
            <p className="brand-title">鐗╄</p>
            <p className="brand-sub">璁板綍鐗╁搧锛岃褰曠敓娲?/p>
          </div>
        </div>

        <nav className="nav-list">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>棣栭〉鎬昏</NavLink>
          <NavLink to="/items" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>鐗╁搧鍒楄〃</NavLink>
          <NavLink to="/categories" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>鍒嗙被绠＄悊</NavLink>
          <NavLink to="/reminders" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>鎻愰啋涓績</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>缁熻鍒嗘瀽</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>璁剧疆</NavLink>
        </nav>

        <div className="quick-box">
          <p className="quick-title">蹇嵎鎿嶄綔</p>
          <p className="quick-desc">蹇€熸柊澧炰竴鏉＄墿鍝佽褰曘€?/p>
          <button className="quick-btn" type="button" onClick={() => void openQuickCreate()}>鏂板鐗╁搧</button>
        </div>
      </aside>

      <main className="content-wrap">
        <header className="top-bar panel">
          <div>
            <div className="breadcrumb">鐗╄ <span>鈥?/span> {breadcrumbName}</div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="top-actions">
          </div>
        </header>
        {children}
      </main>

      {quickCreateOpen && (
        <div className="modal-mask" onClick={() => setQuickCreateOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>鏂板鐗╁搧</h2>
                <p>蹇€熷綍鍏ヤ竴鏉＄墿鍝佽褰曪紝涓嶇寮€褰撳墠椤甸潰銆?/p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setQuickCreateOpen(false)}>脳</button>
            </div>

            <form onSubmit={onQuickCreate}>
              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    鐗╁搧鍚嶇О
                    <input required value={quickForm.name} onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })} />
                  </label>
                  <label>
                    鍒嗙被
                    <select value={quickForm.categoryId} onChange={(e) => setQuickForm({ ...quickForm, categoryId: Number(e.target.value) })}>
                      {sortedQuickCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>
                    浠锋牸
                    <div className="price-field">
                      <span className="price-label">楼</span>
                      <input
                        value={quickForm.price}
                        onChange={(e) => {
                          const formatted = formatPriceInput(e.target.value);
                          if (formatted !== null) setQuickForm({ ...quickForm, price: formatted });
                        }}
                      />
                    </div>
                  </label>
                  <label>
                    璐拱鏃ユ湡
                    <DatePickerField label="鏃ユ湡" value={quickForm.purchaseDate} onChange={(next) => setQuickForm({ ...quickForm, purchaseDate: next })} />
                  </label>
                </div>
              </section>

              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    褰撳墠鐘舵€?
                    <select value={quickForm.status} onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}>
                      <option value="IN_USE">浣跨敤涓?/option>
                      <option value="IDLE">闂茬疆涓?/option>
                      <option value="REPLACE_SOON">寰呮洿鎹?/option>
                      <option value="RESTOCK_SOON">寰呰ˉ璐?/option>
                    </select>
                  </label>
                  <label>
                    澶囨敞
                    <input value={quickForm.note} onChange={(e) => setQuickForm({ ...quickForm, note: e.target.value })} placeholder="鍙€夛細琛ュ厖璇存槑" />
                  </label>
                </div>
              </section>

              <div className="edit-footer">
                <button className="ghost-btn" type="button" onClick={() => setQuickCreateOpen(false)}>鍙栨秷</button>
                <button className="primary-btn" type="submit">淇濆瓨鐗╁搧</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export {
  DATA_CHANGED_EVENT,
  useToast,
  emitDataChanged,
  formatMoney,
  formatDate,
  formatDateTime,
  formatDays,
  formatPercent,
  calcElapsedDaysFrom,
  statusText,
  statusTagClass,
  reminderTypeText,
  reminderStatusText,
  reminderStatusTagClass,
  reminderReason,
  reminderSuggestion,
  isAttentionItem,
  CategoryJump,
  EmptyStateAction,
  sortCategoriesByRule,
  formatPriceInput,
  normalizeDateInput,
  toDateInputValue,
  DatePickerField,
  toDisplayDate,
  Layout,
  ToastContext,
};

export type { ToastItem, ToastType };
