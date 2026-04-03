import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import {
  EmptyStateAction,
  Layout,
  formatDays,
  formatMoney,
  formatPercent,
  statusText,
} from "../app/shared";

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
          <div className="panel kpi-card"><span>鎬荤墿鍝?/span><strong>{summary.totalItems}</strong><small>宸茬撼鍏ョ粺璁＄殑鐗╁搧鏁?/small></div>
          <div className="panel kpi-card"><span>鎬昏姳璐?/span><strong>{formatMoney(summary.totalSpend)}</strong><small>绱璐叆閲戦</small></div>
          <div className="panel kpi-card"><span>楂樻棩鍧囨垚鏈?/span><strong>{summary.highDailyCostCount}</strong><small>瓒呰繃闃堝€肩殑鐗╁搧鏁?/small></div>
          <div className="panel kpi-card"><span>寰呭叧娉ㄧ墿鍝?/span><strong>{attentionCount}</strong><small>楂樻垚鏈?+ 闂茬疆鐨勫苟闆嗘暟閲?/small></div>
        </div>
      )}

      <section className="analytics-grid">
        <div className="panel analytics-panel analytics-span-2">
          <h2 className="analytics-heading">鍒嗙被鍒嗗竷</h2>
          {sortedCats.map((c) => (
            <div key={c.id} className="analytics-bar-row">
              <div className="analytics-bar-head">
                <span><CategoryJump id={c.id} name={c.name} /></span>
                <em>{c.count} 路 {formatPercent(c.ratio)}</em>
              </div>
              <div className="ratio-track"><div className="ratio-fill" style={{ width: `${Math.min(100, Number(c.ratio || 0))}%` }} /></div>
            </div>
          ))}
          {sortedCats.length === 0 && <div className="empty-note">鏆傛棤鍒嗙被缁熻鏁版嵁</div>}
        </div>

        <div className="panel analytics-panel">
          <h2 className="analytics-heading">楂樻棩鍧囨垚鏈帓琛?/h2>
          {highTop.map((i, idx) => (
            <div key={i.id} className="category-row analytics-rank-row">
              <span className="analytics-rank-index">TOP {idx + 1}</span>
              <span><NavLink className="table-link" to={`/items/${i.id}`}>{i.name}</NavLink> 路 <CategoryJump id={i.categoryId} name={i.category?.name ?? "鏈垎绫?} /></span>
              <em>{formatMoney(i.dailyCost)}/澶?/em>
            </div>
          ))}
          {highTop.length === 0 && <EmptyStateAction title="鏆傛棤楂樻垚鏈墿鍝? description="褰撳墠娌℃湁瓒呰繃闃堝€肩殑鏃ュ潎鎴愭湰椤癸紝鍙墠寰€璁剧疆椤佃皟鏁撮槇鍊笺€? actionLabel="鍘昏缃槇鍊? to="/settings" variant="cost" />}
        </div>

        <div className="panel analytics-panel">
          <h2 className="analytics-heading">闂茬疆鐗╁搧</h2>
          {idleWithDays.map((i) => (
            <div key={i.id} className="category-row">
              <span><NavLink className="table-link" to={`/items/${i.id}`}>{i.name}</NavLink></span>
              <em>{formatDays(i.idleDays)} 路 {statusText(i.status)}</em>
            </div>
          ))}
          {idleWithDays.length === 0 && <EmptyStateAction title="鏆傛棤闂茬疆鐗╁搧" description="褰撳墠浣跨敤鐘舵€佽壇濂斤紝缁х画淇濇寔銆? actionLabel="鏌ョ湅鐗╁搧" to="/items" variant="idle" />}
        </div>
      </section>
    </Layout>
  );
}


export default AnalyticsPage;
