import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
  DatePickerField,
  Layout,
  emitDataChanged,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPriceInput,
  normalizeDateInput,
  statusTagClass,
  statusText,
  toDateInputValue,
  useToast,
} from "../app/shared";

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
      await loadDetail(editForm.id);
      setEditOpen(false);
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
      pushToast("鐗╁搧宸插垹闄?, "success");
      navigate("/items");
    } catch (error) {
      const text = error instanceof Error ? error.message : "鍒犻櫎澶辫触";
      pushToast(text, "error");
    }
  };

  if (!item) return <Layout><div className="panel">鍔犺浇涓?..</div></Layout>;

  return (
    <Layout>
      <div className="panel">
        <div className="detail-top">
          <div>
            <h2>{item.name}</h2>
            <p className="muted"><CategoryJump id={item.categoryId} name={item.category.name} /></p>
          </div>
          <div className="detail-actions">
            <button className="ghost-btn" type="button" onClick={openEdit}>缂栬緫鐗╁搧</button>
            <button className="primary-btn" type="button" onClick={async () => {
              await api.markUsed(item.id);
              await loadDetail(item.id);
              pushToast("宸茶褰曚竴娆′娇鐢?, "success");
            }}>璁板綍涓€娆′娇鐢?/button>
          </div>
        </div>

        <div className="detail-columns">
          <div className="detail-col">
            <div className="detail-item"><span>璐拱鏃ユ湡</span><strong>{formatDate(item.purchaseDate)}</strong></div>
            <div className="detail-item"><span>鏃ュ潎鎴愭湰</span><strong>{formatMoney(item.dailyCost)}/澶?/strong></div>
            <div className="detail-item"><span>鏈€杩戜娇鐢?/span><strong>{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "-"}</strong></div>
          </div>
          <div className="detail-col">
            <div className="detail-item"><span>浠锋牸</span><strong>{formatMoney(item.price)}</strong></div>
            <div className="detail-item"><span>鎸佹湁澶╂暟</span><strong>{item.daysOwned} 澶?/strong></div>
            <div className="detail-item"><span>鐘舵€?/span><strong>{statusText(item.status)}</strong></div>
          </div>
        </div>
      </div>

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
                <div className="stat-card"><span>鎸佹湁澶╂暟</span><strong>{item.daysOwned} 澶?/strong></div>
                <div className="stat-card"><span>鏃ュ潎鎴愭湰</span><strong>{formatMoney(item.dailyCost)}/澶?/strong></div>
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


export default ItemDetailPage;
