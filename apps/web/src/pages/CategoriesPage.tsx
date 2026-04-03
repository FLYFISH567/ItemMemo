import { useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  EmptyStateAction,
  Layout,
  formatMoney,
  formatPercent,
  sortCategoriesByRule,
  statusTagClass,
  statusText,
  useToast,
} from "../app/shared";

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
      pushToast("璇诲彇鍒嗙被鐗╁搧澶辫触", "error");
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
      pushToast("鍒嗙被鍙婂叾鐗╁搧宸插垹闄?, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "鍒犻櫎澶辫触";
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
      pushToast("鍒嗙被鍚嶇О宸叉洿鏂?, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "閲嶅懡鍚嶅け璐?;
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
      pushToast("鍒嗙被宸插悎骞讹紝鐗╁搧宸茶縼绉?, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "鍚堝苟澶辫触";
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
      pushToast(`宸茶縼绉?${result.movedCount ?? 0} 鏉＄墿鍝乣, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "杩佺Щ澶辫触";
      pushToast(text, "error");
    }
  };

  return (
    <Layout>
      <div className="panel">
        <h2>鏂板鍒嗙被</h2>
        <form className="inline-form" onSubmit={async (e) => {
          e.preventDefault();
          await api.createCategory({ name });
          setName("");
          load();
          pushToast("鍒嗙被宸叉柊澧?, "success");
        }}>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="鍒嗙被鍚嶇О" />
          <button className="primary-btn" type="submit">鏂板鍒嗙被</button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead><tr><th>鍒嗙被</th><th className="num-cell">鏁伴噺</th><th className="num-cell">鍗犳瘮</th><th>鎿嶄綔</th></tr></thead>
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
                      閲嶅懡鍚?
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => setMenuOpenId((prev) => (prev === c.id ? null : c.id))}
                      title="鏇村鎿嶄綔"
                    >
                      鏇村
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
                            杩佺Щ鐗╁搧
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
                            鍚堝苟鍒嗙被
                          </button>
                        )}
                        <button
                          className="ghost-btn danger-btn"
                          type="button"
                          onClick={() => {
                            if (c.count > 0) {
                              pushToast("璇ュ垎绫讳笅浠嶆湁鐗╁搧锛岃鍏堣縼绉绘垨鍚堝苟", "warning");
                              return;
                            }
                            setDeleteTarget(c);
                            setMenuOpenId(null);
                          }}
                        >
                          鍒犻櫎鍒嗙被
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
                    title="鏆傛棤鍒嗙被"
                    description="鍏堝垱寤哄垎绫伙紝鏂逛究鍚庣画绛涢€夊拰缁熻銆?
                    actionLabel="鍥炲埌椤堕儴鏂板"
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
              <h2>{selectedCategory.name} 路 鐗╁搧鍒楄〃</h2>
              <p>鐐瑰嚮鍒嗙被鍚庯紝灞曠ず璇ュ垎绫讳笅鐨勫叏閮ㄧ墿鍝併€?/p>
            </div>
          </div>

          {categoryItemsLoading ? (
            <p className="muted">鍔犺浇涓?..</p>
          ) : categoryItems.length === 0 ? (
            <p className="muted">璇ュ垎绫讳笅鏆傛椂娌℃湁鐗╁搧銆?/p>
          ) : (
            <table>
              <thead><tr><th>鍚嶇О</th><th>浠锋牸</th><th>鎸佹湁澶╂暟</th><th>鏃ュ潎鎴愭湰</th><th>鐘舵€?/th></tr></thead>
              <tbody>
                {categoryItems.map((it) => (
                  <tr key={it.id}>
                    <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                    <td>{formatMoney(it.price)}</td>
                    <td>{it.daysOwned} 澶?/td>
                    <td>{formatMoney(it.dailyCost)}/澶?/td>
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
                <h2>鍒犻櫎鍒嗙被锛歿deleteTarget.name}</h2>
                <p>浠呯┖鍒嗙被鍏佽鍒犻櫎锛涘鏈夌墿鍝佽鍏堣縼绉绘垨鍚堝苟銆?/p>
              </div>
            </div>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setDeleteTarget(null)}>鍙栨秷鍒犻櫎</button>
              <button className="primary-btn danger-btn" type="button" onClick={confirmDeleteCategory}>纭畾鍒犻櫎</button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="modal-mask" onClick={() => setRenameTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>閲嶅懡鍚嶅垎绫?/h2>
                <p>鏇存柊鍒嗙被鍚嶇О锛屼笉褰卞搷鍒嗙被涓嬬墿鍝併€?/p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                鏂板悕绉?
                <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={30} />
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setRenameTarget(null)}>鍙栨秷</button>
              <button className="primary-btn" type="button" onClick={confirmRenameCategory}>淇濆瓨</button>
            </div>
          </div>
        </div>
      )}

      {mergeTarget && (
        <div className="modal-mask" onClick={() => setMergeTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>鍚堝苟鍒嗙被锛歿mergeTarget.name}</h2>
                <p>灏嗚鍒嗙被涓嬫墍鏈夌墿鍝佽縼绉诲埌鐩爣鍒嗙被锛屽苟鍒犻櫎褰撳墠鍒嗙被銆?/p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                鐩爣鍒嗙被
                <select value={mergeToId} onChange={(e) => setMergeToId(Number(e.target.value))}>
                  {sortedCategories.filter((c) => c.id !== mergeTarget.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setMergeTarget(null)}>鍙栨秷</button>
              <button className="primary-btn" type="button" onClick={confirmMergeCategory}>纭鍚堝苟</button>
            </div>
          </div>
        </div>
      )}

      {migrateTarget && (
        <div className="modal-mask" onClick={() => setMigrateTarget(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-head">
              <div>
                <h2>杩佺Щ鍒嗙被锛歿migrateTarget.name}</h2>
                <p>浠呰縼绉荤墿鍝佸埌鐩爣鍒嗙被锛屼繚鐣欏綋鍓嶅垎绫汇€?/p>
              </div>
            </div>
            <section className="edit-section">
              <label>
                鐩爣鍒嗙被
                <select value={migrateToId} onChange={(e) => setMigrateToId(Number(e.target.value))}>
                  {sortedCategories.filter((c) => c.id !== migrateTarget.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </section>
            <div className="edit-footer">
              <button className="ghost-btn" type="button" onClick={() => setMigrateTarget(null)}>鍙栨秷</button>
              <button className="primary-btn" type="button" onClick={confirmMigrateCategory}>纭杩佺Щ</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}


export default CategoriesPage;
