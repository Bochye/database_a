'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/page.module.css';
import Inventory from './inventory'; 

export default function InventoryAdmin() {
  const [userStats, setUserStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [newRoundTitle, setNewRoundTitle] = useState('');
  const [currentRound, setCurrentRound] = useState<{ id: number; title: string } | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showAssetDetail, setShowAssetDetail] = useState(false);

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
      setPendingCount(dataRound.pendingCount || 0);
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

    let carryOver = false;
    if (pendingCount > 0) {
      carryOver = window.confirm(
        `前回の棚卸しに未適用のデータが ${pendingCount} 件あります。\n\n` +
        `引き継ぎますか？\n\n` +
        `【OK】→ 引き継ぐ\n` +
        `【キャンセル】→ 引き継がない`
      );
    }

    const res = await fetch('/api/inventoryrounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newRoundTitle, adminId: adminId || 'admin', carryOver })
    });
    if (res.ok) {
      const data = await res.json();
      setNewRoundTitle('');
      load();
      if (data.carriedOverCount > 0) {
        alert(`開始しました。\n\n前回の未適用データ ${data.carriedOverCount} 件を引き継ぎました。`);
      } else if (data.deletedCount > 0) {
        alert(`開始しました。\n\n前回の未適用データ ${data.deletedCount} 件を削除しました。`);
      } else {
        alert('開始しました。');
      }
    }
  };

  const endCurrentRound = async () => {
    if (!currentRound) return alert('実施中の棚卸しがありません。');
    if (!window.confirm(`「${currentRound.title}」を終了しますか？\n報告データは保持されます。`)) return;
    try {
      const res = await fetch('/api/inventoryrounds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: currentRound.id })
      });
      if (res.ok) { load(); alert('棚卸しを終了しました。'); }
      else {
        const text = await res.text();
        const err = text ? JSON.parse(text) : {};
        alert(err.error || '終了に失敗しました。');
      }
    } catch (e) {
      console.error('End round error:', e);
      alert('終了処理中にエラーが発生しました。');
    }
  };

  const cancelCurrentRound = async () => {
    if (!currentRound) return alert('実施中の棚卸しがありません。');
    if (!window.confirm(`「${currentRound.title}」をキャンセルしますか？\n\n⚠️ 警告：棚卸しと全ての報告データが削除されます。この操作は取り消せません。`)) return;
    try {
      const res = await fetch(`/api/inventoryrounds?roundId=${currentRound.id}`, { method: 'DELETE' });
      if (res.ok) { load(); alert('棚卸しをキャンセルしました。'); }
      else {
        const text = await res.text();
        const err = text ? JSON.parse(text) : {};
        alert(err.error || 'キャンセルに失敗しました。');
      }
    } catch (e) {
      console.error('Cancel round error:', e);
      alert('キャンセル処理中にエラーが発生しました。');
    }
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

  const applySingleRecord = async (record: any) => {
    if (!window.confirm(`この資産「${record.item.name}」の報告内容を資産台帳に適用しますか？`)) return;
    try {
      const res = await fetch('/api/inventoryrequests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id, action: 'APPROVE_SINGLE' })
      });
      if (res.ok) {
        alert('適用しました');
        setSelectedRecord(null);
        load();
      } else {
        const err = await res.json();
        alert(err.error || '適用に失敗しました');
      }
    } catch (e) {
      alert('エラーが発生しました');
    }
  };

  const requestResubmit = async (record: any) => {
    if (!window.confirm(`この資産「${record.item.name}」の再申請を依頼しますか？`)) return;
    try {
      const res = await fetch('/api/inventoryrequests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id, action: 'REQUEST_RESUBMIT' })
      });
      if (res.ok) {
        alert('再申請を依頼しました。');
        setSelectedRecord(null);
        load();
      } else {
        const err = await res.json();
        alert(err.error || '処理に失敗しました');
      }
    } catch (e) {
      alert('エラーが発生しました');
    }
  };

  const translateStatus = (s: string) => {
    const map: any = { USED: '使用中', UNUSED: '未使用', UNKNOWN: '不明', DISPOSED: '除却' };
    return map[s] || s;
  };

  const formatDateTime = (date: any) => date ? new Date(date).toLocaleString('ja-JP') : '-';
  const formatDate = (date: any) => date ? new Date(date).toLocaleDateString('ja-JP') : '-';

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
          <button className={styles.editButton} style={{ backgroundColor: '#607d8b', marginLeft: 'auto' }} onClick={() => setIsAdminMode(false)}>
            👤 自分の資産を棚卸しする
          </button>
        </div>

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

        <div style={{ background: '#f0f4f8', padding: '20px', borderRadius: '1px', marginBottom: '25px', border: '1px solid #4a6fa5' }}>
          <h4 style={{ color: '#4a6fa5', margin: '0 0 10px 0' }}>新しい棚卸しを開始</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input className={styles.inputField} style={{ flex: 1 }} value={newRoundTitle} onChange={e => setNewRoundTitle(e.target.value)} placeholder="例: 2025年度 棚卸し" />
            <button type="button" className={styles.addButton} onClick={startNewRound}>開始</button>
          </div>
          {currentRound && (
            <p style={{ fontSize: '12px', color: '#e65100', marginTop: '10px', marginBottom: 0 }}>
              ※新しい棚卸しを開始すると、現在の棚卸しは自動的に終了します。
            </p>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <button className={styles.reloadButton} onClick={load} disabled={loading}>↻ 更新</button>
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
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>報告進捗: {Math.round((stat.reported / stat.total) * 100)}%</div>
                    <div style={{ height: '10px', background: '#eee', width: '100%', borderRadius: '1px', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${(stat.reported / stat.total) * 100}%`, background: '#f39c12' }} />
                    </div>
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
              {(userStats[selectedUser]?.records || []).length > 0 && (
                userStats[selectedUser]?.applied === userStats[selectedUser]?.total ? (
                   <div style={{ color: '#27ae60', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     すべて資産台帳に適用済み
                   </div>
                ) : (
                  <button className={styles.addButton} style={{ backgroundColor: '#27ae60' }} onClick={() => applyToMaster(selectedUser)}>
                    棚卸し結果をすべて適用
                  </button>
                )
              )}
            </div>
            
            {(userStats[selectedUser]?.records || []).length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px', 
                background: '#fff', 
                border: '1px dashed #bbb', 
                borderRadius: '8px',
                color: '#888'
              }}>
                <p style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  まだこのユーザーの棚卸し結果は報告されていません。
                </p>
                <p style={{ fontSize: '13px' }}>
                  ユーザーが棚卸しを完了し、「報告を確定する」とここに表示されます。
                </p>
              </div>
            ) : (
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
                    const isLocationChanged = r.newLocation !== r.item.location;
                    const isStatusChanged = r.newStatus !== r.item.status;
                    const isStockChanged = r.newStock !== null && r.newStock !== r.item.stock;
                    const hasDifference = isLocationChanged || isStatusChanged || isStockChanged;
                    const recordStatus = r.status;
                    const isClickable = recordStatus === 'PENDING';

                    return (
                      <tr
                        key={r.id}
                        className={isClickable ? styles.clickableRow : ''}
                        onClick={() => {
                          if (isClickable) {
                            setSelectedRecord(r);
                            setShowAssetDetail(false);
                          }
                        }}
                        style={!isClickable ? { opacity: 0.5, backgroundColor: '#f5f5f5', cursor: 'default' } : {}}
                      >
                        <td>{r.item.assetCode}</td>
                        <td className={styles.nameCell}>{r.item.name}</td>
                        <td style={{ color: isLocationChanged && isClickable ? '#e67e22' : 'inherit', fontWeight: isLocationChanged && isClickable ? 'bold' : 'normal' }}>
                          {r.newLocation}
                        </td>
                        <td><span className={styles.statusLabel}>{translateStatus(r.newStatus)}</span></td>
                        <td style={{ color: isStockChanged && isClickable ? '#e67e22' : 'inherit', fontWeight: isStockChanged && isClickable ? 'bold' : 'normal' }}>
                          {r.newStock ?? r.item.stock}
                        </td>
                        <td>
                          {recordStatus === 'APPROVED' ? (
                            <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>適用済</span>
                          ) : recordStatus === 'RESUBMIT_REQUESTED' ? (
                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>再申請依頼中</span>
                          ) : hasDifference ? (
                            <span style={{ color: '#e67e22' }}>● 変更あり</span>
                          ) : (
                            <span style={{ color: '#666' }}>未適用</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className={styles.modalOverlay} onClick={() => setSelectedRecord(null)}>
          <div className={styles.infoCard} style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>棚卸し報告詳細</h3>
              <button onClick={() => setSelectedRecord(null)}>×</button>
            </div>
            <div className={styles.infoCardContent}>
              <div style={{ marginBottom: '15px', padding: '10px', background: '#f0f4f8', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>資産情報</div>
                  <button 
                    className={styles.secondaryButton} 
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => setShowAssetDetail(!showAssetDetail)}
                  >
                    {showAssetDetail ? '詳細を隠す △' : '全情報を表示 ▽'}
                  </button>
                </div>
                <div className={styles.infoRow}><label>ID</label><span>{selectedRecord.item.id.toString().padStart(6, '0')}</span></div>
                <div className={styles.infoRow}><label>資産コード</label><span>{selectedRecord.item.assetCode || '-'}</span></div>
                <div className={styles.infoRow}><label>資産名</label><span>{selectedRecord.item.name}</span></div>
                <div className={styles.infoRow}><label>型式</label><span>{selectedRecord.item.modelNumber || '-'}</span></div>

                {showAssetDetail && (
                  <div style={{ marginTop: '10px', borderTop: '1px dashed #ccc', paddingTop: '10px', fontSize: '13px' }}>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>台帳上の個数</label><span>{selectedRecord.item.stock ?? 1}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>台帳上の状態</label><span>{translateStatus(selectedRecord.item.status)}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>台帳上の管理場所</label><span>{selectedRecord.item.location || '-'}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>取得年月日</label><span>{formatDate(selectedRecord.item.acquisitionDate)}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>取得価額</label><span>{selectedRecord.item.acquisitionCost?.toLocaleString() || '-'}円</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>学科</label><span>{selectedRecord.item.department || '-'}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>管理者</label><span>{selectedRecord.item.manager || '-'}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>作成者</label><span>{selectedRecord.item.ownerid}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>作成日時</label><span>{formatDateTime(selectedRecord.item.createdAt)}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>最終編集者</label><span>{selectedRecord.item.updatedBy || '-'}</span></div>
                    <div className={styles.infoRow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><label style={{ color: '#718096' }}>最終更新日時</label><span>{formatDateTime(selectedRecord.item.updatedAt)}</span></div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ padding: '10px', background: '#fff3e0', borderRadius: '4px', border: '1px solid #ffe0b2' }}>
                  <div style={{ fontSize: '12px', color: '#e65100', marginBottom: '10px', fontWeight: 'bold' }}>現在の台帳データ</div>
                  <div className={styles.infoRow}><label>場所</label><span>{selectedRecord.item.location || '-'}</span></div>
                  <div className={styles.infoRow}><label>状態</label><span>{translateStatus(selectedRecord.item.status)}</span></div>
                  <div className={styles.infoRow}><label>個数</label><span>{selectedRecord.item.stock ?? 1}</span></div>
                </div>
                <div style={{ padding: '10px', background: '#e8f5e9', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
                  <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '10px', fontWeight: 'bold' }}>報告内容</div>
                  <div className={styles.infoRow}>
                    <label>場所</label>
                    <span style={{ color: selectedRecord.newLocation !== selectedRecord.item.location ? '#e65100' : 'inherit', fontWeight: selectedRecord.newLocation !== selectedRecord.item.location ? 'bold' : 'normal' }}>
                      {selectedRecord.newLocation || '-'}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <label>状態</label>
                    <span style={{ color: selectedRecord.newStatus !== selectedRecord.item.status ? '#e65100' : 'inherit', fontWeight: selectedRecord.newStatus !== selectedRecord.item.status ? 'bold' : 'normal' }}>
                      {translateStatus(selectedRecord.newStatus)}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <label>個数</label>
                    <span style={{ color: selectedRecord.newStock !== selectedRecord.item.stock ? '#e65100' : 'inherit', fontWeight: selectedRecord.newStock !== selectedRecord.item.stock ? 'bold' : 'normal' }}>
                      {selectedRecord.newStock ?? selectedRecord.item.stock ?? 1}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                報告確定日時: {formatDateTime(selectedRecord.confirmedAt)}
              </div>
            </div>
            
            <div className={styles.infoCardFooter} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                className={styles.deleteButton}
                onClick={() => requestResubmit(selectedRecord)}
              >
                再申請を依頼
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={styles.closeBtn} onClick={() => setSelectedRecord(null)}>閉じる</button>
                {!selectedRecord.isApproved && (
                  <button
                    className={styles.addButton}
                    style={{ backgroundColor: '#27ae60' }}
                    onClick={() => applySingleRecord(selectedRecord)}
                  >
                    適用する
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}