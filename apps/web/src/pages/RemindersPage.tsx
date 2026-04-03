import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  EmptyStateAction,
  Layout,
  formatDate,
  formatDateTime,
  reminderReason,
  reminderStatusTagClass,
  reminderStatusText,
  reminderSuggestion,
  reminderTypeText,
  useToast,
} from "../app/shared";

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
      pushToast("褰撳墠娌℃湁鍙鐞嗙殑鎻愰啋", "info");
      return;
    }
    const ok = window.confirm("纭灏嗗叏閮ㄦ彁閱掓爣璁颁负宸插畬鎴愬悧锛?);
    if (!ok) return;
    const result = await api.completeAllReminders();
    load();
    pushToast(`宸插畬鎴?${result.count} 鏉℃彁閱抈, "success");
  };

  const removeAll = async () => {
    if (items.length === 0) {
      pushToast("褰撳墠娌℃湁鍙垹闄ょ殑鎻愰啋", "info");
      return;
    }
    const ok = window.confirm("纭涓€閿垹闄ゅ叏閮ㄦ彁閱掑唴瀹瑰悧锛熸鎿嶄綔涓嶅彲鎭㈠銆?);
    if (!ok) return;
    const result = await api.deleteAllReminders();
    load();
    pushToast(`宸插垹闄?${result.count} 鏉℃彁閱抈, "success");
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
            <h2>鎻愰啋鍒楄〃</h2>
            <p>鎸夌被鍨嬪拰鐘舵€佸垎鎵瑰鐞嗭紝浼樺厛瀹屾垚楂樹环鍊兼彁閱掋€?/p>
          </div>
          <div className="inline-form">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">鍏ㄩ儴绫诲瀷</option>
              <option value="HIGH_DAILY_COST">楂樻棩鍧囨垚鏈?/option>
              <option value="RESTOCK">琛ヨ揣鎻愰啋</option>
              <option value="OWNED_DAYS">鎸佹湁澶╂暟</option>
              <option value="FIXED_CYCLE">鍥哄畾鍛ㄦ湡</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">鍏ㄩ儴鐘舵€?/option>
              <option value="PENDING">寰呭鐞?/option>
              <option value="SNOOZED">宸茬◢鍚?/option>
              <option value="DONE">宸插畬鎴?/option>
            </select>
            <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
              <option value="ALL">鍏ㄩ儴鏃堕棿</option>
              <option value="TODAY">浠婂ぉ鍒版湡</option>
              <option value="7D">7澶╁唴鍒版湡</option>
              <option value="OVERDUE">宸查€炬湡</option>
            </select>
            <button className={canComplete ? "primary-btn" : "ghost-btn"} type="button" onClick={completeAll} disabled={!canComplete}>涓€閿畬鎴?/button>
          </div>
        </div>
        <table>
          <thead><tr><th>鏍囬</th><th>鐗╁搧</th><th>绫诲瀷</th><th>鐘舵€?/th><th>瑙﹀彂鍘熷洜</th><th>寤鸿鍔ㄤ綔</th><th>鍒版湡鏃堕棿</th><th>鎿嶄綔</th></tr></thead>
          <tbody>
            {filteredItems.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  {r.itemId ? (
                    <NavLink className="table-link" to={`/items/${r.itemId}`}>{r.item?.name ?? "鏈叧鑱旂墿鍝?}</NavLink>
                  ) : (
                    r.item?.name ?? "鏈叧鑱旂墿鍝?
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
                    pushToast("鎻愰啋宸叉爣璁板畬鎴?, "success");
                  }}>瀹屾垚</button>
                  <button className="ghost-btn" onClick={async () => {
                    await api.snoozeReminder(r.id, new Date(Date.now() + 24 * 3600 * 1000).toISOString());
                    load();
                    pushToast("鎻愰啋宸茬◢鍚庝竴澶?, "info");
                  }}>绋嶅悗涓€澶?/button>
                  {r.itemId && <button className="ghost-btn" onClick={() => navigate(`/items/${r.itemId}`)}>鏌ョ湅鐗╁搧</button>}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">
                  <EmptyStateAction
                    title="鏆傛棤鎻愰啋"
                    description="褰撳墠绛涢€変笅鏃犳彁閱掞紝寤鸿閲嶇疆绛涢€夋垨杩斿洖棣栭〉鏌ョ湅浠婃棩鍏虫敞銆?
                    actionLabel="閲嶇疆绛涢€?
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
            <h3>鍗遍櫓鎿嶄綔</h3>
            <p className="muted">娓呯┖鍏ㄩ儴鎻愰啋璁板綍涓嶅彲鎭㈠锛岃纭宸插畬鎴愬鍑恒€?/p>
          </div>
          <button className="ghost-btn danger-btn" type="button" onClick={removeAll}>娓呯┖鎻愰啋璁板綍</button>
        </div>
      </div>
    </Layout>
  );
}


export default RemindersPage;
