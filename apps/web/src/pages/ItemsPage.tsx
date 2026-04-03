import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  DatePickerField,
  EmptyStateAction,
  Layout,
  emitDataChanged,
  formatMoney,
  formatPercent,
  formatPriceInput,
  normalizeDateInput,
  sortCategoriesByRule,
  statusTagClass,
  statusText,
  toDateInputValue,
  useToast,
} from "../app/shared";

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
      pushToast("璇疯緭鍏ユ湁鏁堜环鏍?, "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("鏃ユ湡鏍煎紡璇蜂娇鐢?骞?鏈?鏃ワ紝渚嬪 2026/04/03", "warning");
      return;
    }

    await api.createItem({ ...form, price: priceNum, purchaseDate });
    setForm({ name: "", categoryId: categories[0]?.id ?? 1, price: "", purchaseDate: "", status: "IN_USE", note: "" });
    setCreateOpen(false);
    load();
    pushToast("鐗╁搧宸叉柊澧炲苟瀹屾垚鎴愭湰璁＄畻", "success");
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
      pushToast("璇诲彇鐗╁搧璇︽儏澶辫触", "error");
    }
  };

  const saveEdit = async () => {
    const priceNum = Number(editForm.price.replace(/,/g, ""));
    const purchaseDate = normalizeDateInput(editForm.purchaseDate);
    const lastUsedAt = normalizeDateInput(editForm.lastUsedAt);
    if (!editForm.name.trim()) {
      pushToast("璇疯緭鍏ョ墿鍝佸悕绉?, "warning");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      pushToast("璇疯緭鍏ユ湁鏁堜环鏍?, "warning");
      return;
    }
    if (!purchaseDate) {
      pushToast("璐拱鏃ユ湡鏍煎紡涓嶆纭?, "warning");
      return;
    }
    if (!lastUsedAt) {
      pushToast("鏈€杩戜娇鐢ㄦ棩鏈熸牸寮忎笉姝ｇ‘", "warning");
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
      pushToast("鐗╁搧淇℃伅宸叉洿鏂?, "success");
    } catch {
      pushToast("淇濆瓨澶辫触锛岃閲嶈瘯", "error");
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      await api.deleteItem(deleteItemTarget.id);
      setDeleteItemTarget(null);
      setEditOpen(false);
      load();
      pushToast("鐗╁搧宸插垹闄?, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "鍒犻櫎澶辫触";
      pushToast(text, "error");
    }
  };

  return (
    <Layout>
      <div className="panel section-head items-search-head">
        <form className="inline-form" onSubmit={onSearchSubmit}>
          <input placeholder="鎼滅储鍚嶇О鎴栧垎绫? value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">鍏ㄩ儴鍒嗙被</option>
            {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">鍏ㄩ儴鐘舵€?/option>
            <option value="IN_USE">浣跨敤涓?/option>
            <option value="IDLE">闂茬疆涓?/option>
            <option value="REPLACE_SOON">寰呮洿鎹?/option>
            <option value="RESTOCK_SOON">寰呰ˉ璐?/option>
          </select>
          <select value={reminderFilter} onChange={(e) => setReminderFilter(e.target.value)}>
            <option value="all">鍏ㄩ儴鎻愰啋鐘舵€?/option>
            <option value="attention">闇€鍏虫敞</option>
            <option value="normal">姝ｅ父</option>
          </select>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="updatedAt:desc">鏈€杩戞洿鏂?/option>
            <option value="purchaseDate:desc">璐拱鏃ユ湡锛堟柊鍒版棫锛?/option>
            <option value="purchaseDate:asc">璐拱鏃ユ湡锛堟棫鍒版柊锛?/option>
            <option value="dailyCost:desc">鏃ュ潎鎴愭湰锛堥珮鍒颁綆锛?/option>
            <option value="dailyCost:asc">鏃ュ潎鎴愭湰锛堜綆鍒伴珮锛?/option>
            <option value="daysOwned:desc">鎸佹湁澶╂暟锛堥珮鍒颁綆锛?/option>
            <option value="daysOwned:asc">鎸佹湁澶╂暟锛堜綆鍒伴珮锛?/option>
          </select>
          <button className="ghost-btn" type="submit">鎼滅储</button>
          <button className="primary-btn" type="button" onClick={() => setCreateOpen(true)}>鏂板鐗╁搧</button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead><tr><th>鍚嶇О</th><th>鍒嗙被</th><th className="num-cell">浠锋牸</th><th className="num-cell">鎸佹湁澶╂暟</th><th className="num-cell">鏃ュ潎鎴愭湰</th><th>鐘舵€?/th><th>鎿嶄綔</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                <td><CategoryJump id={it.categoryId} name={it.category.name} /></td>
                <td className="num-cell">{formatMoney(it.price)}</td>
                <td className="num-cell">{formatDays(it.daysOwned)}</td>
                <td className="num-cell">{formatMoney(it.dailyCost)}/澶?/td>
                <td><span className={statusTagClass(it.status)}>{statusText(it.status)}</span></td>
                <td className="table-actions">
                  <button className="ghost-btn" type="button" onClick={() => openEdit(it.id)}>缂栬緫</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  <EmptyStateAction
                    title="鏆傛棤鍖归厤鐗╁搧"
                    description="鍙互閲嶇疆绛涢€夋潯浠讹紝鎴栫洿鎺ユ柊澧炰竴鏉＄墿鍝併€?
                    actionLabel="閲嶇疆绛涢€?
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
                <h2>鏂板鐗╁搧</h2>
                <p>褰曞叆鍩虹淇℃伅鍚庤嚜鍔ㄥ弬涓庢彁閱掍笌缁熻銆?/p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setCreateOpen(false)}>脳</button>
            </div>
            <form onSubmit={onCreate}>
              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    鐗╁搧鍚嶇О
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="璇疯緭鍏ュ悕绉? />
                  </label>
                  <label>
                    鍒嗙被
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
                      {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>
                    浠锋牸
                    <div className="price-field">
                      <span className="price-label">楼</span>
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
                    璐拱鏃ユ湡
                    <DatePickerField label="鏃ユ湡" value={form.purchaseDate} onChange={(next) => setForm({ ...form, purchaseDate: next })} />
                  </label>
                </div>
              </section>

              <section className="edit-section">
                <div className="edit-grid">
                  <label>
                    褰撳墠鐘舵€?
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="IN_USE">浣跨敤涓?/option>
                      <option value="IDLE">闂茬疆涓?/option>
                      <option value="REPLACE_SOON">寰呮洿鎹?/option>
                      <option value="RESTOCK_SOON">寰呰ˉ璐?/option>
                    </select>
                  </label>
                  <label>
                    澶囨敞
                    <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="鍙€夛細琛ュ厖璇存槑" />
                  </label>
                </div>
              </section>

              <div className="edit-footer">
                <button className="ghost-btn" type="button" onClick={() => setCreateOpen(false)}>鍙栨秷</button>
                <button className="primary-btn" type="submit">淇濆瓨鐗╁搧</button>
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
                <h2>缂栬緫鐗╁搧</h2>
                <p>淇敼璇ョ墿鍝佺殑鍩虹淇℃伅銆佷娇鐢ㄧ姸鎬佸拰澶囨敞鍐呭</p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>脳</button>
            </div>

            <section className="edit-section">
              <div className="edit-section-title">鍩虹淇℃伅</div>
              <div className="edit-grid">
                <label>
                  鐗╁搧鍚嶇О
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <label>
                  鍒嗙被
                  <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}>
                    {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  浠锋牸
                  <div className="price-field">
                    <span className="price-label">楼</span>
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
                  璐拱鏃ユ湡
                  <DatePickerField label="鏃ユ湡" value={editForm.purchaseDate} onChange={(next) => setEditForm({ ...editForm, purchaseDate: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">浣跨敤淇℃伅</div>
              <div className="edit-grid">
                <label>
                  褰撳墠鐘舵€?
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="IN_USE">浣跨敤涓?/option>
                    <option value="IDLE">闂茬疆涓?/option>
                    <option value="REPLACE_SOON">寰呮洿鎹?/option>
                    <option value="RESTOCK_SOON">寰呰ˉ璐?/option>
                  </select>
                </label>
                <label>
                  鏈€杩戜娇鐢ㄦ棩鏈?
                  <DatePickerField label="鏃ユ湡" value={editForm.lastUsedAt} onChange={(next) => setEditForm({ ...editForm, lastUsedAt: next })} placeholder="yyyy/mm/dd" />
                </label>
              </div>
              <label>
                澶囨敞
                <textarea rows={4} maxLength={300} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="琛ュ厖璐拱璇存槑銆佷娇鐢ㄦ劅鍙椼€佷繚淇俊鎭瓑" />
              </label>
            </section>

            <section className="edit-section">
              <div className="edit-section-title">褰撳墠缁熻</div>
              <div className="stat-grid">
                <div className="stat-card"><span>鎸佹湁澶╂暟</span><strong>{editForm.daysOwned} 澶?/strong></div>
                <div className="stat-card"><span>鏃ュ潎鎴愭湰</span><strong>{formatMoney(editForm.dailyCost)}/澶?/strong></div>
                <div className="stat-card"><span>褰撳墠鎻愰啋</span><strong>鏃?/strong></div>
              </div>
            </section>

            <div className="edit-footer">
              <button
                className="ghost-btn danger-btn"
                type="button"
                style={{ marginRight: "auto" }}
                onClick={() => setDeleteItemTarget({ id: editForm.id, name: editForm.name || "璇ョ墿鍝? })}
              >
                鍒犻櫎鐗╁搧
              </button>
              <button className="ghost-btn" type="button" onClick={() => setEditOpen(false)}>鍙栨秷</button>
              <button className="primary-btn" type="button" onClick={saveEdit}>淇濆瓨淇敼</button>
            </div>
          </div>
        </div>
      )}

      {deleteItemTarget && (
        <div className="modal-mask" onClick={() => setDeleteItemTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>鍒犻櫎鐗╁搧</h2>
                <p>纭畾瑕佸垹闄?{deleteItemTarget.name} 鍚楋紵</p>
              </div>
            </div>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setDeleteItemTarget(null)}>鍙栨秷鍒犻櫎</button>
              <button className="primary-btn danger-btn" type="button" onClick={confirmDeleteItem}>纭畾鍒犻櫎</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}


export default ItemsPage;
