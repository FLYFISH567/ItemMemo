import { useEffect, useState } from "react";
import { api } from "../api";
import { Layout, useToast } from "../app/shared";

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
      pushToast("楂樻棩鍧囨垚鏈槇鍊间笉鍚堟硶", "warning");
      return;
    }
    if (!Number.isFinite(payload.idleDaysThreshold) || payload.idleDaysThreshold < 1) {
      pushToast("闂茬疆闃堝€间笉鍚堟硶", "warning");
      return;
    }

    try {
      const next = await api.patchSettings(payload);
      setSettings(next);
      setMessage("淇濆瓨鎴愬姛");
      pushToast("璁剧疆宸蹭繚瀛?, "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "淇濆瓨澶辫触";
      setMessage("淇濆瓨澶辫触");
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
      pushToast("宸叉仮澶嶉粯璁よ缃?, "success");
    } catch {
      pushToast("鎭㈠榛樿澶辫触", "error");
    }
  };

  const clearReminders = async () => {
    const ok = window.confirm("纭娓呯┖鍏ㄩ儴鎻愰啋璁板綍鍚楋紵");
    if (!ok) return;
    try {
      const result = await api.deleteAllReminders();
      pushToast(`宸叉竻绌?${result.count} 鏉℃彁閱抈, "success");
    } catch {
      pushToast("娓呯┖鎻愰啋澶辫触", "error");
    }
  };

  if (!settings) return <Layout><div className="panel">鍔犺浇涓?..</div></Layout>;

  return (
    <Layout>
      <div className="panel settings-group">
        <h2>鎻愰啋瑙勫垯</h2>
        <p className="muted">閰嶇疆鎻愰啋瑙﹀彂闃堝€硷紝鎺у埗鎴愭湰鍜岄棽缃璀︾伒鏁忓害銆?/p>
        <div className="settings-fields">
          <div className="setting-field-card">
            <label>榛樿鎻愰啋鏃堕棿</label>
            <input value={settings.defaultReminderTime} onChange={(e) => setSettings({ ...settings, defaultReminderTime: e.target.value })} />
            <small>姣忓ぉ瑙﹀彂鎻愰啋鎵弿鏃朵娇鐢ㄧ殑榛樿鏃堕棿</small>
          </div>
          <div className="setting-field-card">
            <label>楂樻棩鍧囨垚鏈槇鍊硷紙鍏?澶╋級</label>
            <input
              type="number"
              min={0}
              value={settings.highDailyCostThreshold}
              onChange={(e) => {
                const v = e.target.value;
                setSettings({ ...settings, highDailyCostThreshold: v === "" ? "" : Number(v) });
              }}
            />
            <small>瓒呰繃璇ュ€肩殑鐗╁搧浼氳繘鍏ラ珮鎴愭湰鍏虫敞鍒楄〃</small>
          </div>
          <div className="setting-field-card">
            <label>闂茬疆闃堝€硷紙澶╋級</label>
            <input
              type="number"
              min={1}
              value={settings.idleDaysThreshold}
              onChange={(e) => {
                const v = e.target.value;
                setSettings({ ...settings, idleDaysThreshold: v === "" ? "" : Number(v) });
              }}
            />
            <small>瓒呰繃璇ュぉ鏁版湭浣跨敤灏嗚鍒ゅ畾涓洪棽缃?/small>
          </div>
        </div>
        <div className="setting-actions">
          <button className="primary-btn" type="button" onClick={saveSettings}>淇濆瓨瑙勫垯</button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="panel settings-group">
        <h2>鏁版嵁绠＄悊</h2>
        <p className="muted">鎵€鏈夋暟鎹粯璁や粎淇濆瓨鍦ㄦ湰鍦拌澶囷紝寤鸿瀹氭湡瀵煎嚭澶囦唤銆?/p>
        <div className="inline-form">
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportJson(); setMessage(`宸蹭笅杞?${r.fileName}`); pushToast(`涓嬭浇鎴愬姛锛?{r.fileName}`, "success"); }}>瀵煎嚭 JSON</button>
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportCsv(); setMessage(`宸蹭笅杞?${r.fileName}`); pushToast(`涓嬭浇鎴愬姛锛?{r.fileName}`, "success"); }}>瀵煎嚭 CSV</button>
          <button className="ghost-btn" type="button" onClick={async () => { const r = await api.downloadExportBackup(); setMessage(`宸蹭笅杞?${r.fileName}`); pushToast(`涓嬭浇鎴愬姛锛?{r.fileName}`, "success"); }}>瀵煎嚭澶囦唤</button>
        </div>
      </div>

      <div className="panel settings-group">
        <h2>楂樼骇鎿嶄綔</h2>
        <p className="muted">璋ㄦ厧鎿嶄綔锛氬彲鑳藉奖鍝嶆彁閱掕褰曟垨褰撳墠閰嶇疆銆?/p>
        <div className="inline-form">
          <button className="ghost-btn" type="button" onClick={restoreDefaults}>鎭㈠榛樿璁剧疆</button>
          <button className="ghost-btn danger-btn" type="button" onClick={clearReminders}>娓呯┖鎻愰啋璁板綍</button>
          <button className="ghost-btn" type="button" disabled>瀵煎叆澶囦唤锛堝嵆灏嗘敮鎸侊級</button>
        </div>
      </div>
    </Layout>
  );
}


export default SettingsPage;
