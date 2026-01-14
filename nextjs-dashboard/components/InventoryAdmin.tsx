'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/page.module.css';
import Inventory from './inventory'; 

export default function InventoryAdmin() {
  const [userStats, setUserStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [newRoundTitle, setNewRoundTitle] = useState('');
  const [currentRound, setCurrentRound] = useState<{ id: number; title: string } | null>(null);

  const [isAdminMode, setIsAdminMode] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const loggedInUser = localStorage.getItem('loggedInUser');
      setAdminId(loggedInUser);

      const [resRequests, resRound] = await Promise.all([
        fetch('/api/inventoryrequests'),
        fetch('/api/inventoryrounds')
      ]);

      const dataRequests = await resRequests.json();
      const dataRound = await resRound.json();

      setUserStats(dataRequests.userStats || {});
      setCurrentRound(dataRound.currentRound || null);
    } catch (error) {
      console.error('Load Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startNewRound = async () => {
    if (!newRoundTitle) return alert('棚卸しの名称を入力してください');
    if (!window.confirm('新しい棚卸しを開始しますか？')) return;
    const res = await fetch('/api/inventoryrounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newRoundTitle, adminId: adminId || 'admin' })
    });
    if (res.ok) { setNewRoundTitle(''); load(); alert('開始しました'); }
  };

  const endCurrentRound = async () => {
    if (!currentRound) return alert('実施中の棚卸しがありません。');
    if (!window.confirm(`「${currentRound.title}」を終了しますか？\n報告データは保持されます。`)) return;
    const res = await fetch('/api/inventoryrounds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: currentRound.id })
    });
    if (res.ok) { load(); alert('棚卸しを終了しました。'); }
    else { const err = await res.json(); alert(err.error || '終了に失敗しました。'); }
  };

  const cancelCurrentRound = async () => {
    if (!currentRound) return alert('実施中の棚卸しがありません。');
    if (!window.confirm(`「${currentRound.title}」をキャンセルしますか？\n\n⚠️ 警告：棚卸しと全ての報告データが削除されます。この操作は取り消せません。`)) return;
    const res = await fetch(`/api/inventoryrounds?roundId=${currentRound.id}`, { method: 'DELETE' });
    if (res.ok) { load(); alert('棚卸しをキャンセルしました。'); }
    else { const err = await res.json(); alert(err.error || 'キャンセルに失敗しました。'); }
  };

  const applyToMaster = async (userId: string) => {
    if (!window.confirm(`${userId} の棚卸し報告を全て資産台帳に適用し、完了状態にしますか？`)) return;
    const res = await fetch('/api/inventoryrequests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'APPROVE_ALL' })
    });
    if (res.ok) { alert('資産台帳への適用が完了しました'); load(); }
  };

  const translateStatus = (s: string) => {
    const map: any = { USED: '使用中', UNUSED: '未使用', UNKNOWN: '不明', DISPOSED: '除却' };
    return map[s] || s;
  };

  const formatDateTime = (date: any) => date ? new Date(date).toLocaleString('ja-JP') : '-';

  if (!isAdminMode && adminId) {
    return (
      <div className={styles.tabContent}>
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <button className={styles.secondaryButton} onClick={() => setIsAdminMode(true)}>← 管理画面に戻る</button>
        </div>
        <Inventory ownerId={adminId} />
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tableContainer}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <button className={styles.reloadButton} onClick={load} disabled={loading}>↻ 更新</button>
          <button className={styles.editButton} style={{ backgroundColor: '#607d8b' }} onClick={() => setIsAdminMode(false)}>
            👤 自分の資産を棚卸しする
          </button>
        </div>

        {/* 現在の棚卸し状況 */}
        {currentRound ? (
          <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '1px', marginBottom: '25px', border: '1px solid #4caf50' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <h4 style={{ color: '#2e7d32', margin: '0 0 5px 0' }}>実施中の棚卸し</h4>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1b5e20' }}>{currentRound.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={styles.secondaryButton}
                  style={{ backgroundColor: '#ff9800', color: '#fff', border: 'none' }}
                  onClick={endCurrentRound}
                >
                  終了する
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={cancelCurrentRound}
                >
                  キャンセル
                </button>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              ※「終了」: 報告データを保持したまま完了　/　「キャンセル」: 棚卸しと報告データを全て削除
            </p>
          </div>
        ) : (
          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '1px', marginBottom: '25px', border: '1px solid #ddd' }}>
            <h4 style={{ color: '#999', margin: '0' }}>現在実施中の棚卸しはありません</h4>
          </div>
        )}

        {/* 新規棚卸し開始 */}
        <div style={{ background: '#f0f4f8', padding: '20px', borderRadius: '1px', marginBottom: '25px', border: '1px solid #4a6fa5' }}>
          <h4 style={{ color: '#4a6fa5', margin: '0 0 10px 0' }}>新しい棚卸しを開始</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input className={styles.inputField} style={{ flex: 1 }} value={newRoundTitle} onChange={e => setNewRoundTitle(e.target.value)} placeholder="例: 2025年度 棚卸し" />
            <button className={styles.addButton} onClick={startNewRound}>開始</button>
          </div>
          {currentRound && (
            <p style={{ fontSize: '12px', color: '#e65100', marginTop: '10px', marginBottom: 0 }}>
              ※新しい棚卸しを開始すると、現在の棚卸しは自動的に終了します。
            </p>
          )}
        </div>

        {loading ? (
          <p>読み込み中...</p>
        ) : !selectedUser ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {Object.entries(userStats).map(([user, stat]) => {
              const isAllApplied = stat.applied === stat.total && stat.total > 0;
              return (
                <div 
                  key={user} 
                  className={styles.infoCard} 
                  style={{ 
                    cursor: 'pointer', 
                    borderLeft: isAllApplied ? '8px solid #27ae60' : '8px solid #4a6fa5',
                    backgroundColor: isAllApplied ? '#f0fff4' : '#fff'
                  }} 
                  onClick={() => setSelectedUser(user)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px', color: isAllApplied ? '#27ae60' : '#4a6fa5' }}>👤 {user}</div>
                    {isAllApplied && <span style={{ fontSize: '12px', background: '#27ae60', color: 'white', padding: '2px 8px', borderRadius: '1px' }}>棚卸し完了</span>}
                  </div>
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>適用進捗: {Math.round((stat.applied / stat.total) * 100)}%</div>
                    <div style={{ height: '10px', background: '#eee', width: '100%', borderRadius: '1px' }}>
                      <div style={{ height: '100%', width: `${(stat.applied / stat.total) * 100}%`, background: isAllApplied ? '#27ae60' : '#4a6fa5' }} />
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>報告済み: <b>{stat.reported}</b> / {stat.total} 件</span>
                      <span style={{ color: stat.applied === stat.total && stat.total > 0 ? '#27ae60' : '#999' }}>
                        適用済み: <b>{stat.applied}</b>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <button className={styles.secondaryButton} onClick={() => setSelectedUser(null)}>← 戻る</button>
              <h3 style={{ margin: 0 }}>👤 {selectedUser} の棚卸し詳細</h3>
              {userStats[selectedUser]?.applied === userStats[selectedUser]?.total ? (
                 <div style={{ color: '#27ae60', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '20px' }}></span>すべて資産台帳に適用済み
                 </div>
              ) : (
                <button className={styles.addButton} style={{ backgroundColor: '#27ae60' }} onClick={() => applyToMaster(selectedUser)}>
                  棚卸し結果をすべて適用
                </button>
              )}
            </div>
            
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>資産コード</th>
                  <th>資産名</th>
                  <th>報告場所</th>
                  <th>報告状態</th>
                  <th>報告個数</th>
                  <th>判定</th>
                </tr>
              </thead>
              <tbody>
                {(userStats[selectedUser]?.records || []).map((r: any) => {
                  // 個数の差異をチェック
                  const isLocationChanged = r.newLocation !== r.item.location;
                  const isStatusChanged = r.newStatus !== r.item.status;
                  const isStockChanged = r.newStock !== null && r.newStock !== r.item.stock;
                  const hasDifference = isLocationChanged || isStatusChanged || isStockChanged;

                  return (
                    <tr key={r.id} className={styles.clickableRow} onClick={() => setSelectedItem(r.item)}>
                      <td>{r.item.assetCode}</td>
                      <td className={styles.nameCell}>{r.item.name}</td>
                      <td style={{ color: isLocationChanged ? '#e67e22' : 'inherit', fontWeight: isLocationChanged ? 'bold' : 'normal' }}>
                        {r.newLocation}
                      </td>
                      <td><span className={styles.statusLabel}>{translateStatus(r.newStatus)}</span></td>
                      {/* ★ 個数の表示。変更があれば色を変える */}
                      <td style={{ color: isStockChanged ? '#e67e22' : 'inherit', fontWeight: isStockChanged ? 'bold' : 'normal' }}>
                        {r.newStock ?? r.item.stock}
                      </td>
                      <td>
                        {hasDifference ? (
                          <span style={{ color: '#e67e22' }}>● 変更あり</span>
                        ) : 'ー'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className={styles.modalOverlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.infoCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>備品詳細情報</h3>
              <button onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className={styles.infoCardContent}>
              <div className={styles.infoRow}><label>ID</label><span>{selectedItem.id.toString().padStart(6, '0')}</span></div>
              <div className={styles.infoRow}><label>資産コード</label><span>{selectedItem.assetCode || '-'}</span></div>
              <div className={styles.infoRow}><label>資産名</label><span>{selectedItem.name}</span></div>
              <div className={styles.infoRow}><label>型式</label><span>{selectedItem.modelNumber || '-'}</span></div>
              <div className={styles.infoRow}><label>取得価額</label><span>{selectedItem.acquisitionCost?.toLocaleString()}円</span></div>
              <div className={styles.infoRow}><label>現在の台帳個数</label><span>{selectedItem.stock ?? 1}</span></div> {/* ★ 個数を追加 */}
              <div className={styles.infoRow}><label>現在の場所</label><span>{selectedItem.location || '-'}</span></div>
              <div className={styles.infoRow}><label>現在の状態</label><span>{translateStatus(selectedItem.status)}</span></div>
              <div className={styles.infoRow}><label>管理者</label><span>{selectedItem.manager || '-'}</span></div>
              <div className={styles.infoRow}><label>最終更新日時</label><span>{formatDateTime(selectedItem.updatedAt)}</span></div>
            </div>
            <div className={styles.infoCardFooter}>
              <button className={styles.closeBtn} onClick={() => setSelectedItem(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}