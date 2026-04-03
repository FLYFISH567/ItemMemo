import { FormEvent, ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "./api";

const DATA_CHANGED_EVENT = "writedown:data-changed";

type ToastType = "success" | "info" | "warning" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

const ToastContext = createContext<{ pushToast: (message: string, type?: ToastType) => void }>({
  pushToast: () => undefined,
});

function useToast() {
  return useContext(ToastContext);
}

function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

function formatMoney(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mm}`;
}

function formatDays(days: number) {
  return `${Math.max(0, Number(days || 0))} 天`;
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function calcElapsedDaysFrom(ref: string | Date | null | undefined) {
  if (!ref) return 0;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (24 * 3600 * 1000)));
}

function statusText(status: string) {
  const map: Record<string, string> = {
    IN_USE: "使用中",
    IDLE: "闲置中",
    REPLACE_SOON: "待更换",
    RESTOCK_SOON: "待补购",
  };
  return map[status] ?? status;
}

function statusTagClass(status: string) {
  const map: Record<string, string> = {
    IN_USE: "tag tag-green",
    IDLE: "tag tag-gray",
    REPLACE_SOON: "tag tag-amber",
    RESTOCK_SOON: "tag tag-pink",
  };
  return map[status] ?? "tag";
}

function reminderTypeText(type: string) {
  const map: Record<string, string> = {
    FIXED_CYCLE: "固定周期",
    OWNED_DAYS: "持有天数",
    HIGH_DAILY_COST: "高日均成本",
    RESTOCK: "补货提醒",
  };
  return map[type] ?? type;
}

function reminderStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待处理",
    DONE: "已完成",
    SNOOZED: "已稍后",
  };
  return map[status] ?? status;
}

function reminderStatusTagClass(status: string) {
  const map: Record<string, string> = {
    PENDING: "tag tag-red",
    DONE: "tag tag-gray",
    SNOOZED: "tag tag-amber",
  };
  return map[status] ?? "tag";
}

function reminderReason(reminder: any) {
  if (reminder.type === "HIGH_DAILY_COST") return "该物品日均成本超过阈值";
  if (reminder.type === "RESTOCK") return "库存或消耗状态触发补购提醒";
  if (reminder.type === "OWNED_DAYS") return "持有时长到达提醒规则";
  return "到达预设提醒条件";
}

function reminderSuggestion(reminder: any) {
  if (reminder.type === "HIGH_DAILY_COST") return "评估是否继续持有或调整使用频率";
  if (reminder.type === "RESTOCK") return "确认库存并安排补购";
  if (reminder.type === "OWNED_DAYS") return "检查物品状态并更新计划";
  return "查看物品详情后处理";
}

function isAttentionItem(item: any, highDailyCostThreshold: number, idleDaysThreshold: number) {
  const idleRef = item.lastUsedAt ?? item.statusUpdatedAt;
  const idleDays = calcElapsedDaysFrom(idleRef);
  if (item.dailyCost >= highDailyCostThreshold) return true;
  if (idleDays >= idleDaysThreshold) return true;
  return ["IDLE", "REPLACE_SOON", "RESTOCK_SOON"].includes(item.status);
}

function CategoryJump({ id, name }: { id?: number; name: string }) {
  if (!id) return <span>{name}</span>;
  return (
    <NavLink className="category-jump" to={`/categories?categoryId=${id}`}>
      {name}
    </NavLink>
  );
}

function EmptyStateAction({
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

function sortCategoriesByRule(list: any[]) {
  return [...list].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), "zh-CN-u-co-pinyin", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

function formatPriceInput(rawValue: string) {
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

function normalizeDateInput(rawValue: string) {
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

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DatePickerField({
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

function toDisplayDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
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

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const meta = routeMeta(location.pathname);
  const breadcrumbName = location.pathname === "/" ? "主页" : meta.title;
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCategories, setQuickCategories] = useState<any[]>([]);
  const [quickForm, setQuickForm] = useState({ name: "", categoryId: 1, price: "", purchaseDate: "", status: "IN_USE", note: "" });

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

function DashboardPage() {
  const [data, setData] = useState<any>();
  const [allItems, setAllItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>();
  const [pendingReminders, setPendingReminders] = useState<any[]>([]);
  const [recentFilter, setRecentFilter] = useState<"all" | "7d" | "abnormal">("all");
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const sortedOverview = useMemo(
    () => (data?.categoryOverview ? sortCategoriesByRule(data.categoryOverview) : []),
    [data],
  );

  const highThreshold = Number(settings?.highDailyCostThreshold ?? 5);
  const idleThreshold = Number(settings?.idleDaysThreshold ?? 60);

  useEffect(() => {
    Promise.all([api.dashboard(), api.reminders(), api.items("?sortBy=updatedAt&sortOrder=desc"), api.settings()]).then(([dash, reminders, items, st]) => {
      setData(dash);
      setPendingReminders(reminders.filter((r) => r.status === "PENDING"));
      setAllItems(items);
      setSettings(st);
    });
  }, []);

  const todayFocus = useMemo(() => {
    const high = [...allItems]
      .filter((it) => it.dailyCost >= highThreshold)
      .sort((a, b) => b.dailyCost - a.dailyCost)[0];

    const idle = [...allItems]
      .map((it) => ({ ...it, idleDays: calcElapsedDaysFrom(it.lastUsedAt ?? it.statusUpdatedAt) }))
      .filter((it) => it.idleDays >= idleThreshold)
      .sort((a, b) => b.idleDays - a.idleDays)[0];

    const restock = [...allItems].find((it) => it.status === "RESTOCK_SOON");

    return [
      {
        key: "high",
        title: "高日均成本物品",
        item: high,
        tip: high ? `${high.name} · ${formatMoney(high.dailyCost)}/天` : "当前无超阈值物品",
        actionLabel: "查看统计分析",
        actionTo: "/analytics",
      },
      {
        key: "idle",
        title: "长期闲置物品",
        item: idle,
        tip: idle ? `${idle.name} · 闲置 ${formatDays(idle.idleDays)}` : "当前无长期闲置物品",
        actionLabel: "查看物品列表",
        actionTo: "/items",
      },
      {
        key: "restock",
        title: "待补购物品",
        item: restock,
        tip: restock ? `${restock.name} · 建议尽快补购` : "当前无待补购项",
        actionLabel: "去提醒中心",
        actionTo: "/reminders",
      },
    ];
  }, [allItems, highThreshold, idleThreshold]);

  const recentItems = useMemo(() => {
    const source = allItems.length > 0 ? allItems : (data?.recentItems ?? []);
    const now = Date.now();
    const filtered = source.filter((it: any) => {
      if (recentFilter === "7d") {
        const t = new Date(it.purchaseDate).getTime();
        return now - t <= 7 * 24 * 3600 * 1000;
      }
      if (recentFilter === "abnormal") {
        return isAttentionItem(it, highThreshold, idleThreshold);
      }
      return true;
    });
    return filtered.slice(0, 8);
  }, [allItems, data, recentFilter, highThreshold, idleThreshold]);

  const nearestDueAt = pendingReminders
    .map((r) => new Date(r.dueAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];

  const totalCategoryCount = sortedOverview.reduce((acc, c) => acc + Number(c.count || 0), 0);

  if (!data) return <Layout><div className="panel">加载中...</div></Layout>;

  return (
    <Layout>
      <section className="kpi-grid">
        <article className="panel kpi-card"><span>总物品数</span><strong>{data.totalItems}</strong><small>当前纳入管理的物品总数</small></article>
        <article className="panel kpi-card"><span>累计花费</span><strong>{formatMoney(data.totalSpend)}</strong><small>所有物品累计购入金额</small></article>
        <article className="panel kpi-card"><span>待处理提醒</span><strong>{pendingReminders.length}</strong><small>需要你尽快处理的提醒任务</small></article>
        <article className="panel kpi-card"><span>平均日均成本</span><strong>{formatMoney(data.averageDailyCost)}</strong><small>单件物品平均日成本</small></article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>今日关注</h2>
            <p>优先处理最影响成本和状态的事项。</p>
          </div>
        </div>
        <div className="attention-grid">
          {todayFocus.map((focus) => (
            <article key={focus.key} className="attention-card">
              <h3>{focus.title}</h3>
              <p>{focus.tip}</p>
              <NavLink className="ghost-btn" to={focus.item ? `/items/${focus.item.id}` : focus.actionTo}>
                {focus.item ? "查看物品" : focus.actionLabel}
              </NavLink>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="section-head">
            <div>
              <h2>最近记录的物品</h2>
              <p>用列表快速查看价格、持有时间和成本变化。</p>
            </div>
            <div className="inline-form">
              <NavLink className="ghost-btn" to="/items">查看全部</NavLink>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("7d")}>近 7 天</button>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("abnormal")}>仅看异常项</button>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("all")}>重置</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>名称</th><th>分类</th><th>价格</th><th>购买日期</th><th>持有时间</th><th>日均成本</th><th>状态</th></tr>
              </thead>
              <tbody>
                {recentItems.map((it: any) => (
                  <tr key={it.id}>
                    <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                    <td><CategoryJump id={it.categoryId} name={it.category.name} /></td>
                    <td className="num-cell">{formatMoney(it.price)}</td>
                    <td>{formatDate(it.purchaseDate)}</td>
                    <td className="num-cell">{formatDays(it.daysOwned)}</td>
                    <td className="num-cell">{formatMoney(it.dailyCost)}/天</td>
                    <td><span className={statusTagClass(it.status)}>{statusText(it.status)}</span></td>
                  </tr>
                ))}
                {recentItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      <EmptyStateAction title="暂无记录" description="当前筛选条件下没有匹配物品。" actionLabel="去物品列表" to="/items" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="right-col">
          <div className="panel">
            <h2>提醒中心</h2>
            <div className="summary-line">
              <span>待处理：{pendingReminders.length}</span>
              <span>最近到期：{nearestDueAt ? formatDateTime(nearestDueAt) : "-"}</span>
            </div>
            <div className="mini-list">
              {pendingReminders.length === 0 && <div className="mini-item"><strong>暂无待处理提醒</strong><small>当前状态良好，继续保持。</small></div>}
              {pendingReminders.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  className="mini-item mini-click"
                  onClick={() => {
                    if (r.itemId) {
                      navigate(`/items/${r.itemId}`);
                      pushToast("已跳转到关联物品详情", "info");
                    } else {
                      navigate("/reminders");
                    }
                  }}
                >
                  <strong>{r.title}</strong>
                  <span>{formatDate(r.dueAt)}</span>
                  <small>{r.item?.name ?? "未关联物品"} · {reminderTypeText(r.type)} · {reminderSuggestion(r)}</small>
                </button>
              ))}
            </div>
            <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => navigate("/reminders")}>去提醒中心处理</button>
          </div>

          <div className="panel">
            <h2>分类概览</h2>
            <div className="category-list">
              {sortedOverview.map((c: any) => (
                <div key={c.id} className="category-row category-overview-row">
                  <div className="category-overview-main">
                    <span><CategoryJump id={c.id} name={c.name} /></span>
                    <em>{c.count} 件 · {formatPercent(totalCategoryCount ? (c.count / totalCategoryCount) * 100 : 0)}</em>
                  </div>
                  <div className="ratio-track"><div className="ratio-fill" style={{ width: `${totalCategoryCount ? (c.count / totalCategoryCount) * 100 : 0}%` }} /></div>
                </div>
              ))}
              {sortedOverview.length === 0 && (
                <EmptyStateAction title="暂无分类数据" description="添加第一条物品后即可生成分类分布。" actionLabel="新增物品" to="/items" />
              )}
            </div>
          </div>
        </aside>
      </section>
    </Layout>
  );
}

function ItemsPage() {
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>();
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [reminderFilter, setReminderFilter] = useState(searchParams.get("reminder") ?? "all");
  const [sortMode, setSortMode] = useState(searchParams.get("sort") ?? "updatedAt:desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", categoryId: 1, price: "", purchaseDate: "", status: "IN_USE", note: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: 0, name: "", categoryId: 1, price: "", purchaseDate: "", status: "IN_USE", lastUsedAt: "", note: "", daysOwned: 0, dailyCost: 0 });
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ id: number; name: string } | null>(null);

  const sortedCategories = useMemo(() => sortCategoriesByRule(categories), [categories]);
  const highThreshold = Number(settings?.highDailyCostThreshold ?? 5);
  const idleThreshold = Number(settings?.idleDaysThreshold ?? 60);

  const buildItemsQuery = (kw: string, catId: string, status: string, sort: string) => {
    const [sortBy, sortOrder] = sort.split(":");
    const params = new URLSearchParams();
    if (kw.trim()) params.set("keyword", kw.trim());
    if (catId) params.set("categoryId", catId);
    if (status) params.set("status", status);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const load = async (
    kw: string = keyword,
    catId: string = categoryFilter,
    status: string = statusFilter,
    reminder: string = reminderFilter,
    sort: string = sortMode,
  ) => {
    const list = await api.items(buildItemsQuery(kw, catId, status, sort));
    if (reminder === "attention") {
      setItems(list.filter((it: any) => isAttentionItem(it, highThreshold, idleThreshold)));
      return;
    }
    if (reminder === "normal") {
      setItems(list.filter((it: any) => !isAttentionItem(it, highThreshold, idleThreshold)));
      return;
    }
    setItems(list);
  };

  useEffect(() => {
    Promise.all([api.categories(), api.settings()]).then(([cats, st]) => {
      setCategories(cats);
      setSettings(st);
      const sorted = sortCategoriesByRule(cats);
      if (sorted[0]) setForm((f) => ({ ...f, categoryId: sorted[0].id }));
    });
  }, []);

  useEffect(() => {
    const kw = searchParams.get("keyword") ?? "";
    const cat = searchParams.get("categoryId") ?? "";
    const st = searchParams.get("status") ?? "";
    const rm = searchParams.get("reminder") ?? "all";
    const sort = searchParams.get("sort") ?? "updatedAt:desc";
    if (kw !== keyword) setKeyword(kw);
    if (cat !== categoryFilter) setCategoryFilter(cat);
    if (st !== statusFilter) setStatusFilter(st);
    if (rm !== reminderFilter) setReminderFilter(rm);
    if (sort !== sortMode) setSortMode(sort);
    load(kw, cat, st, rm, sort);
  }, [searchParams, settings]);

  const applySearch = () => {
    const next = new URLSearchParams(searchParams);
    if (keyword.trim()) next.set("keyword", keyword.trim());
    else next.delete("keyword");
    if (categoryFilter) next.set("categoryId", categoryFilter);
    else next.delete("categoryId");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (reminderFilter && reminderFilter !== "all") next.set("reminder", reminderFilter);
    else next.delete("reminder");
    if (sortMode) next.set("sort", sortMode);
    setSearchParams(next);
    load(keyword.trim(), categoryFilter, statusFilter, reminderFilter, sortMode);
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    applySearch();
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = Number(form.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(form.purchaseDate);
    if (form.price.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("请输入有效价格", "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("日期格式请使用 年/月/日，例如 2026/04/03", "warning");
      return;
    }

    await api.createItem({ ...form, price: priceNum, purchaseDate });
    setForm({ name: "", categoryId: categories[0]?.id ?? 1, price: "", purchaseDate: "", status: "IN_USE", note: "" });
    setCreateOpen(false);
    load();
    pushToast("物品已新增并完成成本计算", "success");
  };

  const openEdit = async (id: number) => {
    try {
      const detail = await api.item(id);
      setEditForm({
        id: detail.id,
        name: detail.name ?? "",
        categoryId: detail.categoryId,
        price: formatPriceInput(String(detail.price ?? 0)) ?? String(detail.price ?? 0),
        purchaseDate: toDateInputValue(detail.purchaseDate),
        status: detail.status ?? "IN_USE",
        lastUsedAt: toDateInputValue(detail.lastUsedAt ?? detail.statusUpdatedAt),
        note: detail.note ?? "",
        daysOwned: detail.daysOwned ?? 0,
        dailyCost: detail.dailyCost ?? 0,
      });
      setEditOpen(true);
    } catch {
      pushToast("读取物品详情失败", "error");
    }
  };

  const saveEdit = async () => {
    const priceNum = Number(editForm.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(editForm.purchaseDate);
    const lastUsedAt = normalizeDateInput(editForm.lastUsedAt);
    if (!editForm.name.trim()) {
      pushToast("请输入物品名称", "warning");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("请输入有效价格", "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("购买日期格式不正确", "warning");
      return;
    }
    if (!lastUsedAt) {
      pushToast("最近使用日期格式不正确", "warning");
      return;
    }

    try {
      await api.updateItem(editForm.id, {
        name: editForm.name,
        categoryId: Number(editForm.categoryId),
        price: priceNum,
        purchaseDate,
        status: editForm.status,
        lastUsedAt,
        note: editForm.note,
      });
      setEditOpen(false);
      load();
      pushToast("物品信息已更新", "success");
    } catch {
      pushToast("保存失败，请重试", "error");
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      await api.deleteItem(deleteItemTarget.id);
      setDeleteItemTarget(null);
      setEditOpen(false);
      load();
      pushToast("物品已删除", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "删除失败";
      pushToast(text, "error");
    }
  };

  return (
    <Layout>
      <div className="panel section-head items-search-head">
        <form className="inline-form" onSubmit={onSearchSubmit}>
          <input placeholder="搜索名称或分类" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">全部分类</option>
            {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="IN_USE">使用中</option>
            <option value="IDLE">闲置中</option>
            <option value="REPLACE_SOON">待更换</option>
            <option value="RESTOCK_SOON">待补购</option>
          </select>
          <select value={reminderFilter} onChange={(e) => setReminderFilter(e.target.value)}>
            <option value="all">全部提醒状态</option>
            <option value="attention">需关注</option>
            <option value="normal">正常</option>
          </select>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="updatedAt:desc">最近更新</option>
            <option value="purchaseDate:desc">购买日期（新到旧）</option>
            <option value="purchaseDate:asc">购买日期（旧到新）</option>
            <option value="dailyCost:desc">日均成本（高到低）</option>
            <option value="dailyCost:asc">日均成本（低到高）</option>
            <option value="daysOwned:desc">持有天数（高到低）</option>
            <option value="daysOwned:asc">持有天数（低到高）</option>
          </select>
          <button className="ghost-btn" type="submit">搜索</button>
          <button className="primary-btn" type="button" onClick={() => setCreateOpen(true)}>新增物品</button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead><tr><th>名称</th><th>分类</th><th className="num-cell">价格</th><th className="num-cell">持有天数</th><th className="num-cell">日均成本</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                <td><CategoryJump id={it.categoryId} name={it.category.name} /></td>
                <td className="num-cell">{formatMoney(it.price)}</td>
                <td className="num-cell">{formatDays(it.daysOwned)}</td>
                <td className="num-cell">{formatMoney(it.dailyCost)}/天</td>
                <td><span className={statusTagClass(it.status)}>{statusText(it.status)}</span></td>
                <td className="table-actions">
                  <button className="ghost-btn" type="button" onClick={() => openEdit(it.id)}>编辑</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  <EmptyStateAction
                    title="暂无匹配物品"
                    description="可以重置筛选条件，或直接新增一条物品。"
                    actionLabel="重置筛选"
                    onClick={() => {
                      setKeyword("");
                      setCategoryFilter("");
                      setStatusFilter("");
                      setReminderFilter("all");
                      setSortMode("updatedAt:desc");
                      setSearchParams(new URLSearchParams());
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="modal-mask" onClick={() => setCreateOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>新增物品</h2>
                <p>录入基础信息后自动参与提醒与统计。</p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <form onSubmit={onCreate}>
              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    物品名称
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入名称" />
                  </label>
                  <label>
                    分类
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
                      {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>
                    价格
                    <div className="price-field">
                      <span className="price-label">¥</span>
                      <input
                        value={form.price}
                        onChange={(e) => {
                          const formatted = formatPriceInput(e.target.value);
                          if (formatted !== null) setForm({ ...form, price: formatted });
                        }}
                      />
                    </div>
                  </label>
                  <label>
                    购买日期
                    <DatePickerField label="日期" value={form.purchaseDate} onChange={(next) => setForm({ ...form, purchaseDate: next })} />
                  </label>
                </div>
              </section>

              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    当前状态
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="IN_USE">使用中</option>
                      <option value="IDLE">闲置中</option>
                      <option value="REPLACE_SOON">待更换</option>
                      <option value="RESTOCK_SOON">待补购</option>
                    </select>
                  </label>
                  <label>
                    备注
                    <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="可选：补充说明" />
                  </label>
                </div>
              </section>

              <div className="edit-footer">
                <button className="ghost-btn" type="button" onClick={() => setCreateOpen(false)}>取消</button>
                <button className="primary-btn" type="submit">保存物品</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-mask" onClick={() => setEditOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>编辑物品</h2>
                <p>修改该物品的基础信息、使用状态和备注内容</p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>×</button>
            </div>

            <section className="edit-section">
              <div className="edit-section-title">基础信息</div>
              <div className="edit-grid">
                <label>
                  物品名称
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <label>
                  分类
                  <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}>
                    {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  价格
                  <div className="price-field">
                    <span className="price-label">¥</span>
                    <input
                      value={editForm.price}
                      onChange={(e) => {
                        const formatted = formatPriceInput(e.target.value);
                        if (formatted !== null) setEditForm({ ...editForm, price: formatted });
                      }}
                    />
                  </div>
                </label>
                <label>
                  购买日期
                  <DatePickerField label="日期" value={editForm.purchaseDate} onChange={(next) => setEditForm({ ...editForm, purchaseDate: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">使用信息</div>
              <div className="edit-grid">
                <label>
                  当前状态
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="IN_USE">使用中</option>
                    <option value="IDLE">闲置中</option>
                    <option value="REPLACE_SOON">待更换</option>
                    <option value="RESTOCK_SOON">待补购</option>
                  </select>
                </label>
                <label>
                  最近使用日期
                  <DatePickerField label="日期" value={editForm.lastUsedAt} onChange={(next) => setEditForm({ ...editForm, lastUsedAt: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
              <label>
                备注
                <textarea rows={4} maxLength={300} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="补充购买说明、使用感受、保修信息等" />
              </label>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">当前统计</div>
              <div className="stat-grid">
                <div className="stat-card"><span>持有天数</span><strong>{editForm.daysOwned} 天</strong></div>
                <div className="stat-card"><span>日均成本</span><strong>{formatMoney(editForm.dailyCost)}/天</strong></div>
                <div className="stat-card"><span>当前提醒</span><strong>无</strong></div>
              </div>
            </section>

            <div className="edit-footer">
              <button
                className="ghost-btn danger-btn"
                type="button"
                style={{ marginRight: "auto" }}
                onClick={() => setDeleteItemTarget({ id: editForm.id, name: editForm.name || "该物品" })}
              >
                删除物品
              </button>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>取消</button>
              <button className="primary-btn" type="button" onClick={saveEdit}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {deleteItemTarget && (
        <div className="modal-mask" onClick={() => setDeleteItemTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>删除物品</h2>
                <p>确定要删除 {deleteItemTarget.name} 吗？</p>
              </div>
            </div>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setDeleteItemTarget(null)}>取消删除</button>
              <button className="primary-btn danger-btn" type="button" onClick={confirmDeleteItem}>确定删除</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [item, setItem] = useState<any>();
  const [categories, setCategories] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ id: number; name: string } | null>(null);
  const [editForm, setEditForm] = useState({
    id: 0,
    name: "",
    categoryId: 1,
    price: "",
    purchaseDate: "",
    status: "IN_USE",
    lastUsedAt: "",
    note: "",
  });

  const sortedCategories = useMemo(() => sortCategoriesByRule(categories), [categories]);

  const loadDetail = async (itemId: number) => {
    const detail = await api.item(itemId);
    setItem(detail);
    return detail;
  };

  useEffect(() => {
    if (!id) return;
    const itemId = Number(id);
    loadDetail(itemId);
    api.categories().then(setCategories);
  }, [id]);

  const openEdit = () => {
    if (!item) return;
    setEditForm({
      id: item.id,
      name: item.name ?? "",
      categoryId: item.categoryId,
      price: formatPriceInput(String(item.price ?? 0)) ?? String(item.price ?? 0),
      purchaseDate: toDateInputValue(item.purchaseDate),
      status: item.status ?? "IN_USE",
      lastUsedAt: toDateInputValue(item.lastUsedAt ?? item.statusUpdatedAt),
      note: item.note ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const priceNum = Number(editForm.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(editForm.purchaseDate);
    const lastUsedAt = normalizeDateInput(editForm.lastUsedAt);

    if (!editForm.name.trim()) {
      pushToast("请输入物品名称", "warning");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("请输入有效价格", "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("购买日期格式不正确", "warning");
      return;
    }
    if (!lastUsedAt) {
      pushToast("最近使用日期格式不正确", "warning");
      return;
    }

    try {
      await api.updateItem(editForm.id, {
        name: editForm.name,
        categoryId: Number(editForm.categoryId),
        price: priceNum,
        purchaseDate,
        status: editForm.status,
        lastUsedAt,
        note: editForm.note,
      });
      await loadDetail(editForm.id);
      setEditOpen(false);
      pushToast("物品信息已更新", "success");
    } catch {
      pushToast("保存失败，请重试", "error");
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      await api.deleteItem(deleteItemTarget.id);
      setDeleteItemTarget(null);
      setEditOpen(false);
      pushToast("物品已删除", "success");
      navigate("/items");
    } catch (error) {
      const text = error instanceof Error ? error.message : "删除失败";
      pushToast(text, "error");
    }
  };

  if (!item) return <Layout><div className="panel">加载中...</div></Layout>;

  return (
    <Layout>
      <div className="panel">
        <div className="detail-top">
          <div>
            <h2>{item.name}</h2>
            <p className="muted"><CategoryJump id={item.categoryId} name={item.category.name} /></p>
          </div>
          <div className="detail-actions">
            <button className="ghost-btn" type="button" onClick={openEdit}>编辑物品</button>
            <button className="primary-btn" type="button" onClick={async () => {
              await api.markUsed(item.id);
              await loadDetail(item.id);
              pushToast("已记录一次使用", "success");
            }}>记录一次使用</button>
          </div>
        </div>

        <div className="detail-columns">
          <div className="detail-col">
            <div className="detail-item"><span>购买日期</span><strong>{formatDate(item.purchaseDate)}</strong></div>
            <div className="detail-item"><span>日均成本</span><strong>{formatMoney(item.dailyCost)}/天</strong></div>
            <div className="detail-item"><span>最近使用</span><strong>{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "-"}</strong></div>
          </div>
          <div className="detail-col">
            <div className="detail-item"><span>价格</span><strong>{formatMoney(item.price)}</strong></div>
            <div className="detail-item"><span>持有天数</span><strong>{item.daysOwned} 天</strong></div>
            <div className="detail-item"><span>状态</span><strong>{statusText(item.status)}</strong></div>
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="modal-mask" onClick={() => setEditOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>编辑物品</h2>
                <p>修改该物品的基础信息、使用状态和备注内容</p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>×</button>
            </div>

            <section className="edit-section">
              <div className="edit-section-title">基础信息</div>
              <div className="edit-grid">
                <label>
                  物品名称
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <label>
                  分类
                  <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}>
                    {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  价格
                  <div className="price-field">
                    <span className="price-label">¥</span>
                    <input
                      value={editForm.price}
                      onChange={(e) => {
                        const formatted = formatPriceInput(e.target.value);
                        if (formatted !== null) setEditForm({ ...editForm, price: formatted });
                      }}
                    />
                  </div>
                </label>
                <label>
                  购买日期
                  <DatePickerField label="日期" value={editForm.purchaseDate} onChange={(next) => setEditForm({ ...editForm, purchaseDate: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">使用信息</div>
              <div className="edit-grid">
                <label>
                  当前状态
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="IN_USE">使用中</option>
                    <option value="IDLE">闲置中</option>
                    <option value="REPLACE_SOON">待更换</option>
                    <option value="RESTOCK_SOON">待补购</option>
                  </select>
                </label>
                <label>
                  最近使用日期
                  <DatePickerField label="日期" value={editForm.lastUsedAt} onChange={(next) => setEditForm({ ...editForm, lastUsedAt: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
              <label>
                备注
                <textarea rows={4} maxLength={300} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="补充购买说明、使用感受、保修信息等" />
              </label>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">当前统计</div>
              <div className="stat-grid">
                <div className="stat-card"><span>持有天数</span><strong>{item.daysOwned} 天</strong></div>
                <div className="stat-card"><span>日均成本</span><strong>{formatMoney(item.dailyCost)}/天</strong></div>
                <div className="stat-card"><span>当前提醒</span><strong>无</strong></div>
              </div>
            </section>

            <div className="edit-footer">
              <button
                className="ghost-btn danger-btn"
                type="button"
                style={{ marginRight: "auto" }}
                onClick={() => setDeleteItemTarget({ id: editForm.id, name: editForm.name || "该物品" })}
              >
                删除物品
              </button>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>取消</button>
              <button className="primary-btn" type="button" onClick={saveEdit}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {deleteItemTarget && (
        <div className="modal-mask" onClick={() => setDeleteItemTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>删除物品</h2>
                <p>确定要删除 {deleteItemTarget.name} 吗？</p>
              </div>
            </div>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setDeleteItemTarget(null)}>取消删除</button>
              <button className="primary-btn danger-btn" type="button" onClick={confirmDeleteItem}>确定删除</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function CategoriesPage() {
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<any[]>([]);
  const parseCategoryId = (value: string | null) => {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(() => parseCategoryId(searchParams.get("categoryId")));
  const [categoryItems, setCategoryItems] = useState<any[]>([]);
  const [categoryItemsLoading, setCategoryItemsLoading] = useState(false);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [renameTarget, setRenameTarget] = useState<any | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mergeTarget, setMergeTarget] = useState<any | null>(null);
  const [mergeToId, setMergeToId] = useState<number>(0);
  const [migrateTarget, setMigrateTarget] = useState<any | null>(null);
  const [migrateToId, setMigrateToId] = useState<number>(0);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const sortedCategories = useMemo(() => sortCategoriesByRule(categories), [categories]);

  const selectedCategory = useMemo(
    () => sortedCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [sortedCategories, selectedCategoryId],
  );
  const totalCount = useMemo(
    () => sortedCategories.reduce((acc, c) => acc + Number(c.count || 0), 0),
    [sortedCategories],
  );

  const load = () => api.categories().then(setCategories);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onWindowClick = () => setMenuOpenId(null);
    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  useEffect(() => {
    const nextCategoryId = parseCategoryId(searchParams.get("categoryId"));
    setSelectedCategoryId(nextCategoryId);
    if (nextCategoryId) {
      void openCategoryItems(nextCategoryId, false);
      return;
    }
    setCategoryItems([]);
  }, [searchParams]);

  const openCategoryItems = async (categoryId: number, syncUrl: boolean = true) => {
    if (syncUrl) {
      const next = new URLSearchParams(searchParams);
      next.set("categoryId", String(categoryId));
      setSearchParams(next);
    }
    setSelectedCategoryId(categoryId);
    setCategoryItemsLoading(true);
    try {
      const items = await api.items(`?categoryId=${categoryId}`);
      setCategoryItems(items);
    } catch {
      pushToast("读取分类物品失败", "error");
      setCategoryItems([]);
    } finally {
      setCategoryItemsLoading(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteTarget) return;

    try {
      await api.deleteCategory(deleteTarget.id);
      if (selectedCategoryId === deleteTarget.id) {
        setSelectedCategoryId(null);
        setCategoryItems([]);
        const next = new URLSearchParams(searchParams);
        next.delete("categoryId");
        setSearchParams(next);
      }
      setDeleteTarget(null);
      await load();
      pushToast("分类及其物品已删除", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "删除失败";
      pushToast(text, "error");
    }
  };

  const confirmRenameCategory = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await api.patchCategory(renameTarget.id, { name: renameValue.trim() });
      setRenameTarget(null);
      setRenameValue("");
      load();
      pushToast("分类名称已更新", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "重命名失败";
      pushToast(text, "error");
    }
  };

  const confirmMergeCategory = async () => {
    if (!mergeTarget || !mergeToId) return;
    try {
      await api.mergeCategory(mergeTarget.id, mergeToId);
      if (selectedCategoryId === mergeTarget.id) {
        setSelectedCategoryId(mergeToId);
        void openCategoryItems(mergeToId);
      }
      setMergeTarget(null);
      setMergeToId(0);
      load();
      pushToast("分类已合并，物品已迁移", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "合并失败";
      pushToast(text, "error");
    }
  };

  const confirmMigrateCategory = async () => {
    if (!migrateTarget || !migrateToId) return;
    try {
      const result = await api.migrateCategory(migrateTarget.id, migrateToId);
      if (selectedCategoryId === migrateTarget.id) {
        void openCategoryItems(migrateTarget.id);
      }
      setMigrateTarget(null);
      setMigrateToId(0);
      load();
      pushToast(`已迁移 ${result.movedCount ?? 0} 条物品`, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "迁移失败";
      pushToast(text, "error");
    }
  };

  return (
    <Layout>
      <div className="panel">
        <h2>新增分类</h2>
        <form className="inline-form" onSubmit={async (e) => {
          e.preventDefault();
          await api.createCategory({ name });
          setName("");
          load();
          pushToast("分类已新增", "success");
        }}>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="分类名称" />
          <button className="primary-btn" type="submit">新增分类</button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead><tr><th>分类</th><th className="num-cell">数量</th><th className="num-cell">占比</th><th>操作</th></tr></thead>
          <tbody>
            {sortedCategories.map((c) => (
              <tr
                key={c.id}
                className={`click-row ${selectedCategoryId === c.id ? "selected-row" : ""}`}
                onClick={() => openCategoryItems(c.id)}
              >
                <td className="clickable-category-label">{c.name}</td>
                <td className="num-cell">{c.count}</td>
                <td className="num-cell">
                  <div className="category-mini-ratio">
                    <span>{formatPercent(totalCount ? (c.count / totalCount) * 100 : 0)}</span>
                    <div className="ratio-track"><div className="ratio-fill" style={{ width: `${totalCount ? (c.count / totalCount) * 100 : 0}%` }} /></div>
                  </div>
                </td>
                <td>
                  <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        setRenameTarget(c);
                        setRenameValue(c.name);
                      }}
                    >
                      重命名
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => setMenuOpenId((prev) => (prev === c.id ? null : c.id))}
                      title="更多操作"
                    >
                      更多
                    </button>

                    {menuOpenId === c.id && (
                      <div className="category-menu">
                        {c.count > 0 && (
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => {
                              setMigrateTarget(c);
                              const fallback = sortedCategories.find((x) => x.id !== c.id);
                              setMigrateToId(fallback?.id ?? 0);
                              setMenuOpenId(null);
                            }}
                          >
                            迁移物品
                          </button>
                        )}
                        {c.count > 0 && (
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => {
                              setMergeTarget(c);
                              const fallback = sortedCategories.find((x) => x.id !== c.id);
                              setMergeToId(fallback?.id ?? 0);
                              setMenuOpenId(null);
                            }}
                          >
                            合并分类
                          </button>
                        )}
                        <button
                          className="ghost-btn danger-btn"
                          type="button"
                          onClick={() => {
                            if (c.count > 0) {
                              pushToast("该分类下仍有物品，请先迁移或合并", "warning");
                              return;
                            }
                            setDeleteTarget(c);
                            setMenuOpenId(null);
                          }}
                        >
                          删除分类
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sortedCategories.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">
                  <EmptyStateAction
                    title="暂无分类"
                    description="先创建分类，方便后续筛选和统计。"
                    actionLabel="回到顶部新增"
                    variant="category"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCategory && (
        <div className="panel table-wrap">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2>{selectedCategory.name} · 物品列表</h2>
              <p>点击分类后，展示该分类下的全部物品。</p>
            </div>
          </div>

          {categoryItemsLoading ? (
            <p className="muted">加载中...</p>
          ) : categoryItems.length === 0 ? (
            <p className="muted">该分类下暂时没有物品。</p>
          ) : (
            <table>
              <thead><tr><th>名称</th><th>价格</th><th>持有天数</th><th>日均成本</th><th>状态</th></tr></thead>
              <tbody>
                {categoryItems.map((it) => (
                  <tr key={it.id}>
                    <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                    <td>{formatMoney(it.price)}</td>
                    <td>{it.daysOwned} 天</td>
                    <td>{formatMoney(it.dailyCost)}/天</td>
                    <td><span className={statusTagClass(it.status)}>{statusText(it.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="modal-mask" onClick={() => setDeleteTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>删除分类：{deleteTarget.name}</h2>
                <p>仅空分类允许删除；如有物品请先迁移或合并。</p>
              </div>
            </div>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setDeleteTarget(null)}>取消删除</button>
              <button className="primary-btn danger-btn" type="button" onClick={confirmDeleteCategory}>确定删除</button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="modal-mask" onClick={() => setRenameTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>重命名分类</h2>
                <p>更新分类名称，不影响分类下物品。</p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                新名称
                <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={30} />
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setRenameTarget(null)}>取消</button>
              <button className="primary-btn" type="button" onClick={confirmRenameCategory}>保存</button>
            </div>
          </div>
        </div>
      )}

      {mergeTarget && (
        <div className="modal-mask" onClick={() => setMergeTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>合并分类：{mergeTarget.name}</h2>
                <p>将该分类下所有物品迁移到目标分类，并删除当前分类。</p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                目标分类
                <select value={mergeToId} onChange={(e) => setMergeToId(Number(e.target.value))}>
                  {sortedCategories.filter((c) => c.id !== mergeTarget.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setMergeTarget(null)}>取消</button>
              <button className="primary-btn" type="button" onClick={confirmMergeCategory}>确认合并</button>
            </div>
          </div>
        </div>
      )}

      {migrateTarget && (
        <div className="modal-mask" onClick={() => setMigrateTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>迁移分类：{migrateTarget.name}</h2>
                <p>仅迁移物品到目标分类，保留当前分类。</p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                目标分类
                <select value={migrateToId} onChange={(e) => setMigrateToId(Number(e.target.value))}>
                  {sortedCategories.filter((c) => c.id !== migrateTarget.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setMigrateTarget(null)}>取消</button>
              <button className="primary-btn" type="button" onClick={confirmMigrateCategory}>确认迁移</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function RemindersPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rangeFilter, setRangeFilter] = useState("ALL");
  const load = () => api.reminders().then(setItems);
  useEffect(() => { load(); }, []);

  const completeAll = async () => {
    if (items.length === 0) {
      pushToast("当前没有可处理的提醒", "info");
      return;
    }
    const ok = window.confirm("确认将全部提醒标记为已完成吗？");
    if (!ok) return;
    const result = await api.completeAllReminders();
    load();
    pushToast(`已完成 ${result.count} 条提醒`, "success");
  };

  const removeAll = async () => {
    if (items.length === 0) {
      pushToast("当前没有可删除的提醒", "info");
      return;
    }
    const ok = window.confirm("确认一键删除全部提醒内容吗？此操作不可恢复。");
    if (!ok) return;
    const result = await api.deleteAllReminders();
    load();
    pushToast(`已删除 ${result.count} 条提醒`, "success");
  };

  const filteredItems = useMemo(() => {
    const now = Date.now();
    return items.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;

      if (rangeFilter === "TODAY") {
        return formatDate(r.dueAt) === formatDate(now);
      }
      if (rangeFilter === "7D") {
        const due = new Date(r.dueAt).getTime();
        return due >= now && due <= now + 7 * 24 * 3600 * 1000;
      }
      if (rangeFilter === "OVERDUE") {
        return new Date(r.dueAt).getTime() < now && r.status !== "DONE";
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, rangeFilter]);
  const canComplete = filteredItems.some((r) => r.status !== "DONE");

  return (
    <Layout>
      <div className="panel table-wrap">
        <div className="section-head" style={{ marginBottom: 8 }}>
          <div>
            <h2>提醒列表</h2>
            <p>按类型和状态分批处理，优先完成高价值提醒。</p>
          </div>
          <div className="inline-form">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">全部类型</option>
              <option value="HIGH_DAILY_COST">高日均成本</option>
              <option value="RESTOCK">补货提醒</option>
              <option value="OWNED_DAYS">持有天数</option>
              <option value="FIXED_CYCLE">固定周期</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">全部状态</option>
              <option value="PENDING">待处理</option>
              <option value="SNOOZED">已稍后</option>
              <option value="DONE">已完成</option>
            </select>
            <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
              <option value="ALL">全部时间</option>
              <option value="TODAY">今天到期</option>
              <option value="7D">7天内到期</option>
              <option value="OVERDUE">已逾期</option>
            </select>
            <button className={canComplete ? "primary-btn" : "ghost-btn"} type="button" onClick={completeAll} disabled={!canComplete}>一键完成</button>
          </div>
        </div>
        <table>
          <thead><tr><th>标题</th><th>物品</th><th>类型</th><th>状态</th><th>触发原因</th><th>建议动作</th><th>到期时间</th><th>操作</th></tr></thead>
          <tbody>
            {filteredItems.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  {r.itemId ? (
                    <NavLink className="table-link" to={`/items/${r.itemId}`}>{r.item?.name ?? "未关联物品"}</NavLink>
                  ) : (
                    r.item?.name ?? "未关联物品"
                  )}
                </td>
                <td>{reminderTypeText(r.type)}</td>
                <td><span className={reminderStatusTagClass(r.status)}>{reminderStatusText(r.status)}</span></td>
                <td>{reminderReason(r)}</td>
                <td>{reminderSuggestion(r)}</td>
                <td>{formatDateTime(r.dueAt)}</td>
                <td className="inline-form table-actions">
                  <button className="primary-btn" onClick={async () => {
                    await api.doneReminder(r.id);
                    load();
                    pushToast("提醒已标记完成", "success");
                  }}>完成</button>
                  <button className="ghost-btn" onClick={async () => {
                    await api.snoozeReminder(r.id, new Date(Date.now() + 24 * 3600 * 1000).toISOString());
                    load();
                    pushToast("提醒已稍后一天", "info");
                  }}>稍后一天</button>
                  {r.itemId && <button className="ghost-btn" onClick={() => navigate(`/items/${r.itemId}`)}>查看物品</button>}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">
                  <EmptyStateAction
                    title="暂无提醒"
                    description="当前筛选下无提醒，建议重置筛选或返回首页查看今日关注。"
                    actionLabel="重置筛选"
                    variant="reminder"
                    onClick={() => {
                      setTypeFilter("ALL");
                      setStatusFilter("ALL");
                      setRangeFilter("ALL");
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="danger-zone">
          <div>
            <h3>危险操作</h3>
            <p className="muted">清空全部提醒记录不可恢复，请确认已完成导出。</p>
          </div>
          <button className="ghost-btn danger-btn" type="button" onClick={removeAll}>清空提醒记录</button>
        </div>
      </div>
    </Layout>
  );
}

function AnalyticsPage() {
  const [summary, setSummary] = useState<any>();
  const [cats, setCats] = useState<any[]>([]);
  const [high, setHigh] = useState<any[]>([]);
  const [idle, setIdle] = useState<any[]>([]);
  const sortedCats = useMemo(() => sortCategoriesByRule(cats), [cats]);
  const highTop = useMemo(() => [...high].slice(0, 5), [high]);
  const idleWithDays = useMemo(
    () => idle.map((it) => ({ ...it, idleDays: calcElapsedDaysFrom(it.lastUsedAt ?? it.statusUpdatedAt) })),
    [idle],
  );
  const attentionCount = useMemo(() => {
    const ids = new Set<number>();
    highTop.forEach((it) => ids.add(it.id));
    idleWithDays.forEach((it) => ids.add(it.id));
    return ids.size;
  }, [highTop, idleWithDays]);

  useEffect(() => {
    api.analyticsSummary().then(setSummary);
    api.analyticsCategories().then(setCats);
    api.highDailyCost().then(setHigh);
    api.idleItems().then(setIdle);
  }, []);

  return (
    <Layout>
      {summary && (
        <div className="kpi-grid">
          <div className="panel kpi-card"><span>总物品</span><strong>{summary.totalItems}</strong><small>已纳入统计的物品数</small></div>
          <div className="panel kpi-card"><span>总花费</span><strong>{formatMoney(summary.totalSpend)}</strong><small>累计购入金额</small></div>
          <div className="panel kpi-card"><span>高日均成本</span><strong>{summary.highDailyCostCount}</strong><small>超过阈值的物品数</small></div>
          <div className="panel kpi-card"><span>待关注物品</span><strong>{attentionCount}</strong><small>高成本 + 闲置的并集数量</small></div>
        </div>
      )}

      <section className="analytics-grid">
        <div className="panel analytics-panel analytics-span-2">
          <h2 className="analytics-heading">分类分布</h2>
          {sortedCats.map((c) => (
            <div key={c.id} className="analytics-bar-row">
              <div className="analytics-bar-head">
                <span><CategoryJump id={c.id} name={c.name} /></span>
                <em>{c.count} · {formatPercent(c.ratio)}</em>
              </div>
              <div className="ratio-track"><div className="ratio-fill" style={{ width: `${Math.min(100, Number(c.ratio || 0))}%` }} /></div>
            </div>
          ))}
          {sortedCats.length === 0 && <div className="empty-note">暂无分类统计数据</div>}
        </div>

        <div className="panel analytics-panel">
          <h2 className="analytics-heading">高日均成本排行</h2>
          {highTop.map((i, idx) => (
            <div key={i.id} className="category-row analytics-rank-row">
              <span className="analytics-rank-index">TOP {idx + 1}</span>
              <span><NavLink className="table-link" to={`/items/${i.id}`}>{i.name}</NavLink> · <CategoryJump id={i.categoryId} name={i.category?.name ?? "未分类"} /></span>
              <em>{formatMoney(i.dailyCost)}/天</em>
            </div>
          ))}
          {highTop.length === 0 && <EmptyStateAction title="暂无高成本物品" description="当前没有超过阈值的日均成本项，可前往设置页调整阈值。" actionLabel="去设置阈值" to="/settings" variant="cost" />}
        </div>

        <div className="panel analytics-panel">
          <h2 className="analytics-heading">闲置物品</h2>
          {idleWithDays.map((i) => (
            <div key={i.id} className="category-row">
              <span><NavLink className="table-link" to={`/items/${i.id}`}>{i.name}</NavLink></span>
              <em>{formatDays(i.idleDays)} · {statusText(i.status)}</em>
            </div>
          ))}
          {idleWithDays.length === 0 && <EmptyStateAction title="暂无闲置物品" description="当前使用状态良好，继续保持。" actionLabel="查看物品" to="/items" variant="idle" />}
        </div>
      </section>
    </Layout>
  );
}

function SettingsPage() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<any>();
  const [message, setMessage] = useState("");
  const defaultSettings = {
    defaultReminderTime: "09:00",
    highDailyCostThreshold: 5,
    idleDaysThreshold: 60,
  };

  const toSettingsPayload = (src: any) => ({
    defaultReminderTime: src.defaultReminderTime,
    toastEnabled: src.toastEnabled,
    exportFormat: src.exportFormat,
    highDailyCostThreshold: Number(src.highDailyCostThreshold),
    idleDaysThreshold: Number(src.idleDaysThreshold),
  });

  useEffect(() => {
    api.settings().then(setSettings);
  }, []);

  const saveSettings = async () => {
    const payload = toSettingsPayload(settings);
    if (!Number.isFinite(payload.highDailyCostThreshold) || payload.highDailyCostThreshold < 0) {
      pushToast("高日均成本阈值不合法", "warning");
      return;
    }
    if (!Number.isFinite(payload.idleDaysThreshold) || payload.idleDaysThreshold < 1) {
      pushToast("闲置阈值不合法", "warning");
      return;
    }

    try {
      const next = await api.patchSettings(payload);
      setSettings(next);
      setMessage("保存成功");
      pushToast("设置已保存", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "保存失败";
      setMessage("保存失败");
      pushToast(text, "error");
    }
  };

  const restoreDefaults = async () => {
    try {
      const next = await api.patchSettings({
        defaultReminderTime: defaultSettings.defaultReminderTime,
        highDailyCostThreshold: defaultSettings.highDailyCostThreshold,
        idleDaysThreshold: defaultSettings.idleDaysThreshold,
      });
      setSettings(next);
      pushToast("已恢复默认设置", "success");
    } catch {
      pushToast("恢复默认失败", "error");
    }
  };

  const clearReminders = async () => {
    const ok = window.confirm("确认清空全部提醒记录吗？");
    if (!ok) return;
    try {
      const result = await api.deleteAllReminders();
      pushToast(`已清空 ${result.count} 条提醒`, "success");
    } catch {
      pushToast("清空提醒失败", "error");
    }
  };

  if (!settings) return <Layout><div className="panel">加载中...</div></Layout>;

  return (
    <Layout>
      <div className="panel settings-group">
        <h2>提醒规则</h2>
        <p className="muted">配置提醒触发阈值，控制成本和闲置预警灵敏度。</p>
        <div className="settings-fields">
          <div className="setting-field-card">
            <label>默认提醒时间</label>
            <input value={settings.defaultReminderTime} onChange={(e) => setSettings({ ...settings, defaultReminderTime: e.target.value })} />
            <small>每天触发提醒扫描时使用的默认时间</small>
          </div>
          <div className="setting-field-card">
            <label>高日均成本阈值（元/天）</label>
            <input
              type="number"
              min={0}
              value={settings.highDailyCostThreshold}
              onChange={(e) => {
                const v = e.target.value;
                setSettings({ ...settings, highDailyCostThreshold: v === "" ? "" : Number(v) });
              }}
            />
            <small>超过该值的物品会进入高成本关注列表</small>
          </div>
          <div className="setting-field-card">
            <label>闲置阈值（天）</label>
            <input
              type="number"
              min={1}
              value={settings.idleDaysThreshold}
              onChange={(e) => {
                const v = e.target.value;
                setSettings({ ...settings, idleDaysThreshold: v === "" ? "" : Number(v) });
              }}
            />
            <small>超过该天数未使用将被判定为闲置</small>
          </div>
        </div>
        <div className="setting-actions">
          <button className="primary-btn" type="button" onClick={saveSettings}>保存规则</button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="panel settings-group">
        <h2>数据管理</h2>
        <p className="muted">所有数据默认仅保存在本地设备，建议定期导出备份。</p>
        <div className="inline-form">
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportJson(); setMessage(`已下载 ${r.fileName}`); pushToast(`下载成功：${r.fileName}`, "success"); }}>导出 JSON</button>
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportCsv(); setMessage(`已下载 ${r.fileName}`); pushToast(`下载成功：${r.fileName}`, "success"); }}>导出 CSV</button>
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportBackup(); setMessage(`已下载 ${r.fileName}`); pushToast(`下载成功：${r.fileName}`, "success"); }}>导出备份</button>
        </div>
      </div>

      <div className="panel settings-group">
        <h2>高级操作</h2>
        <p className="muted">谨慎操作：可能影响提醒记录或当前配置。</p>
        <div className="inline-form">
          <button className="ghost-btn" type="button" onClick={restoreDefaults}>恢复默认设置</button>
          <button className="ghost-btn danger-btn" type="button" onClick={clearReminders}>清空提醒记录</button>
          <button className="ghost-btn" type="button" disabled>导入备份（即将支持）</button>
        </div>
      </div>
    </Layout>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onDataChanged = () => setRefreshKey((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, onDataChanged);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onDataChanged);
  }, []);

  const pushToast = (message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, type === "error" ? 4200 : 2800);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ pushToast }}>
      <Routes key={refreshKey}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
