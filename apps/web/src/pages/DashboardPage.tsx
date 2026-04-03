import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  CategoryJump,
  EmptyStateAction,
  Layout,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  isAttentionItem,
  reminderSuggestion,
  reminderTypeText,
  useToast,
} from "../app/shared";

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
        title: "楂樻棩鍧囨垚鏈墿鍝?,
        item: high,
        tip: high ? `${high.name} 路 ${formatMoney(high.dailyCost)}/澶ー : "褰撳墠鏃犺秴闃堝€肩墿鍝?,
        actionLabel: "鏌ョ湅缁熻鍒嗘瀽",
        actionTo: "/analytics",
      },
      {
        key: "idle",
        title: "闀挎湡闂茬疆鐗╁搧",
        item: idle,
        tip: idle ? `${idle.name} 路 闂茬疆 ${formatDays(idle.idleDays)}` : "褰撳墠鏃犻暱鏈熼棽缃墿鍝?,
        actionLabel: "鏌ョ湅鐗╁搧鍒楄〃",
        actionTo: "/items",
      },
      {
        key: "restock",
        title: "寰呰ˉ璐墿鍝?,
        item: restock,
        tip: restock ? `${restock.name} 路 寤鸿灏藉揩琛ヨ喘` : "褰撳墠鏃犲緟琛ヨ喘椤?,
        actionLabel: "鍘绘彁閱掍腑蹇?,
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

  if (!data) return <Layout><div className="panel">鍔犺浇涓?..</div></Layout>;

  return (
    <Layout>
      <section className="kpi-grid">
        <article className="panel kpi-card"><span>鎬荤墿鍝佹暟</span><strong>{data.totalItems}</strong><small>褰撳墠绾冲叆绠＄悊鐨勭墿鍝佹€绘暟</small></article>
        <article className="panel kpi-card"><span>绱鑺辫垂</span><strong>{formatMoney(data.totalSpend)}</strong><small>鎵€鏈夌墿鍝佺疮璁¤喘鍏ラ噾棰?/small></article>
        <article className="panel kpi-card"><span>寰呭鐞嗘彁閱?/span><strong>{pendingReminders.length}</strong><small>闇€瑕佷綘灏藉揩澶勭悊鐨勬彁閱掍换鍔?/small></article>
        <article className="panel kpi-card"><span>骞冲潎鏃ュ潎鎴愭湰</span><strong>{formatMoney(data.averageDailyCost)}</strong><small>鍗曚欢鐗╁搧骞冲潎鏃ユ垚鏈?/small></article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>浠婃棩鍏虫敞</h2>
            <p>浼樺厛澶勭悊鏈€褰卞搷鎴愭湰鍜岀姸鎬佺殑浜嬮」銆?/p>
          </div>
        </div>
        <div className="attention-grid">
          {todayFocus.map((focus) => (
            <article key={focus.key} className="attention-card">
              <h3>{focus.title}</h3>
              <p>{focus.tip}</p>
              <NavLink className="ghost-btn" to={focus.item ? `/items/${focus.item.id}` : focus.actionTo}>
                {focus.item ? "鏌ョ湅鐗╁搧" : focus.actionLabel}
              </NavLink>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="section-head">
            <div>
              <h2>鏈€杩戣褰曠殑鐗╁搧</h2>
              <p>鐢ㄥ垪琛ㄥ揩閫熸煡鐪嬩环鏍笺€佹寔鏈夋椂闂村拰鎴愭湰鍙樺寲銆?/p>
            </div>
            <div className="inline-form">
              <NavLink className="ghost-btn" to="/items">鏌ョ湅鍏ㄩ儴</NavLink>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("7d")}>杩?7 澶?/button>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("abnormal")}>浠呯湅寮傚父椤?/button>
              <button className="ghost-btn" type="button" onClick={() => setRecentFilter("all")}>閲嶇疆</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>鍚嶇О</th><th>鍒嗙被</th><th>浠锋牸</th><th>璐拱鏃ユ湡</th><th>鎸佹湁鏃堕棿</th><th>鏃ュ潎鎴愭湰</th><th>鐘舵€?/th></tr>
              </thead>
              <tbody>
                {recentItems.map((it: any) => (
                  <tr key={it.id}>
                    <td><NavLink className="table-link" to={`/items/${it.id}`}>{it.name}</NavLink></td>
                    <td><CategoryJump id={it.categoryId} name={it.category.name} /></td>
                    <td className="num-cell">{formatMoney(it.price)}</td>
                    <td>{formatDate(it.purchaseDate)}</td>
                    <td className="num-cell">{formatDays(it.daysOwned)}</td>
                    <td className="num-cell">{formatMoney(it.dailyCost)}/澶?/td>
                    <td><span className={statusTagClass(it.status)}>{statusText(it.status)}</span></td>
                  </tr>
                ))}
                {recentItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      <EmptyStateAction title="鏆傛棤璁板綍" description="褰撳墠绛涢€夋潯浠朵笅娌℃湁鍖归厤鐗╁搧銆? actionLabel="鍘荤墿鍝佸垪琛? to="/items" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="right-col">
          <div className="panel">
            <h2>鎻愰啋涓績</h2>
            <div className="summary-line">
              <span>寰呭鐞嗭細{pendingReminders.length}</span>
              <span>鏈€杩戝埌鏈燂細{nearestDueAt ? formatDateTime(nearestDueAt) : "-"}</span>
            </div>
            <div className="mini-list">
              {pendingReminders.length === 0 && <div className="mini-item"><strong>鏆傛棤寰呭鐞嗘彁閱?/strong><small>褰撳墠鐘舵€佽壇濂斤紝缁х画淇濇寔銆?/small></div>}
              {pendingReminders.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  className="mini-item mini-click"
                  onClick={() => {
                    if (r.itemId) {
                      navigate(`/items/${r.itemId}`);
                      pushToast("宸茶烦杞埌鍏宠仈鐗╁搧璇︽儏", "info");
                    } else {
                      navigate("/reminders");
                    }
                  }}
                >
                  <strong>{r.title}</strong>
                  <span>{formatDate(r.dueAt)}</span>
                  <small>{r.item?.name ?? "鏈叧鑱旂墿鍝?} 路 {reminderTypeText(r.type)} 路 {reminderSuggestion(r)}</small>
                </button>
              ))}
            </div>
            <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => navigate("/reminders")}>鍘绘彁閱掍腑蹇冨鐞?/button>
          </div>

          <div className="panel">
            <h2>鍒嗙被姒傝</h2>
            <div className="category-list">
              {sortedOverview.map((c: any) => (
                <div key={c.id} className="category-row category-overview-row">
                  <div className="category-overview-main">
                    <span><CategoryJump id={c.id} name={c.name} /></span>
                    <em>{c.count} 浠?路 {formatPercent(totalCategoryCount ? (c.count / totalCategoryCount) * 100 : 0)}</em>
                  </div>
                  <div className="ratio-track"><div className="ratio-fill" style={{ width: `${totalCategoryCount ? (c.count / totalCategoryCount) * 100 : 0}%` }} /></div>
                </div>
              ))}
              {sortedOverview.length === 0 && (
                <EmptyStateAction title="鏆傛棤鍒嗙被鏁版嵁" description="娣诲姞绗竴鏉＄墿鍝佸悗鍗冲彲鐢熸垚鍒嗙被鍒嗗竷銆? actionLabel="鏂板鐗╁搧" to="/items" />
              )}
            </div>
          </div>
        </aside>
      </section>
    </Layout>
  );
}


export default DashboardPage;
