'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/page.module.css';

interface InventoryItem {
  id: number;
  assetCode: string;
  name: string;
  modelNumber?: string | null;
  acquisitionDate?: string | null;
  disposalDate?: string | null;
  acquisitionCost?: number | null;
  manager?: string | null;
  location?: string | null;
  status: string;
  department?: string | null;
  stock?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
  ownerid: string;
  InventoryRecords?: any[]; 
}

export default function Inventory({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showFullDetail, setShowFullDetail] = useState(false); 
  const [roundTitle, setRoundTitle] = useState<string>(''); // ★ 棚卸し名称用のステート

  const [newLocation, setNewLocation] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newStock, setNewStock] = useState<number>(1); 
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'USED': return '使用中';
      case 'UNUSED': return '未使用';
      case 'UNKNOWN': return '不明（紛失など）';
      case 'DISPOSED': return '除却（廃棄済み）';
      default: return status;
    }
  };

const loadItems = async () => {
  setLoading(true);
  try {
    // 1. 資産一覧
    const resItems = await fetch(`/api/items?isAdmin=false&ownerId=${ownerId}`);
    const dataItems = await resItems.json();
    setItems((dataItems.items || []).filter((i: any) => i.status !== 'DISPOSED'));

    // 2. 棚卸し情報の取得
    const resReq = await fetch('/api/inventoryrequests');
    const dataReq = await resReq.json();

    // ★ 修正：APIが直接返す currentRound からタイトルを取得
    if (dataReq.currentRound?.title) {
      setRoundTitle(dataReq.currentRound.title);
    } else {
      setRoundTitle('-');
    }

  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadItems();
  }, [ownerId]);

  const handleRowClick = (item: InventoryItem) => {
    // 棚卸しが停止中なら入力不可
    if (!roundTitle || roundTitle === '-') return;

    const record = item.InventoryRecords?.[0] as any;
    const recordStatus = record?.status;
    // 再申請依頼中以外のレコードがあれば入力不可
    const isSubmitted = record && recordStatus !== 'RESUBMIT_REQUESTED';
    if (isSubmitted || completedIds.has(item.id)) return;

    setSelectedItem(item);
    setNewLocation(item.location || '');
    setNewStatus(item.status);
    setNewStock(item.stock || 1);
    setShowFullDetail(false);
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;

    const confirmMsg = `【最終確認】この内容で報告を確定しますか？\n\n場所: ${newLocation}\n状態: ${getStatusLabel(newStatus)}\n個数: ${newStock}`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/inventoryrequests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          userId: ownerId,
          newStatus: newStatus,
          newLocation: newLocation,
          newStock: newStock 
        })
      });

      if (res.ok) {
        setCompletedIds(prev => new Set(prev).add(selectedItem.id));
        setSelectedItem(null);
        alert('棚卸し報告を完了しました。');
        loadItems();
      } else {
        const errData = await res.json();
        alert(errData.error || '送信に失敗しました。');
      }
    } catch (err) {
      alert('通信エラーが発生しました。');
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.tableContainer}>
        <h3 style={{ marginBottom: '10px', color: '#4a6fa5', textAlign: 'center' }}>棚卸し実施画面</h3>
        
        {/* ★ 棚卸し名称の表示エリア */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          {roundTitle && roundTitle !== '-' ? (
            <span style={{
              background: '#e3f2fd',
              color: '#1976d2',
              padding: '5px 15px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: '1px solid #bbdefb'
            }}>
              実施中：{roundTitle}
            </span>
          ) : (
            <span style={{
              background: '#f5f5f5',
              color: '#999',
              padding: '5px 15px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: '1px solid #ddd'
            }}>
              停止中
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
          <button className={styles.reloadButton} onClick={loadItems} disabled={loading}>↻ 更新</button>
        </div>

        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
          ※資産を選択して現在の状況を報告してください。
        </p>

        {loading ? (
          <p>読み込み中...</p>
        ) : (
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>資産名 / コード</th>
                <th>型式</th>
                <th>取得年月日</th>
                <th>登録場所</th>
                <th>状態</th>
                <th>個数</th>
                <th>状況</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const record = item.InventoryRecords?.[0];
                const recordStatus = record?.status;
                // 再申請依頼中なら入力可能、それ以外のレコードがあれば入力不可
                const needsResubmit = recordStatus === 'RESUBMIT_REQUESTED';
                const isSubmitted = record && recordStatus !== 'RESUBMIT_REQUESTED';
                const justCompleted = completedIds.has(item.id);
                const isStopped = !roundTitle || roundTitle === '-';
                const isClickable = !isStopped && !isSubmitted && !justCompleted;

                return (
                  <tr
                    key={item.id}
                    className={isClickable ? styles.clickableRow : ''}
                    onClick={() => isClickable && handleRowClick(item)}
                    style={!isClickable ? { opacity: 0.5, backgroundColor: '#f5f5f5', cursor: 'default' } : {}}
                  >
                    <td className={styles.nameCell} style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '11px', color: '#666' }}>{item.assetCode}</div>
                      <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                    </td>
                    <td>{item.modelNumber || '-'}</td>
                    <td>{formatDate(item.acquisitionDate)}</td>
                    <td>{item.location || '-'}</td>
                    <td><span className={styles.statusLabel}>{getStatusLabel(item.status)}</span></td>
                    <td>{item.stock ?? 1}</td>
                    <td>
                      {justCompleted ? (
                        <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>送信済</span>
                      ) : recordStatus === 'APPROVED' ? (
                        <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>適用済</span>
                      ) : recordStatus === 'PENDING' ? (
                        <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>送信済</span>
                      ) : needsResubmit ? (
                        <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>再申請依頼</span>
                      ) : (
                        <span style={{ color: '#f57c00', fontWeight: 'bold' }}>未送信</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedItem && (
        <div className={styles.modalOverlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.infoCard} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>棚卸し報告の入力</h3>
              <button onClick={() => setSelectedItem(null)}>×</button>
            </div>
            
            <div className={styles.infoCardContent}>
              <div style={{ marginBottom: '25px', padding: '15px', background: '#f0f4f8', borderRadius: '1px', borderLeft: '5px solid #4a6fa5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#4a6fa5', margin: 0, fontWeight: 'bold' }}>対象資産</p>
                    <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0', color: '#333' }}>{selectedItem.name}</p>
                    <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{selectedItem.assetCode}</p>
                  </div>
                  <button 
                    onClick={() => setShowFullDetail(!showFullDetail)}
                    style={{ background: 'none', border: '1px solid #4a6fa5', color: '#4a6fa5', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '1px' }}
                  >
                    {showFullDetail ? '簡易表示 △' : '全情報を表示 ▽'}
                  </button>
                </div>
                
                {showFullDetail && (
                  <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #cbd5e0', fontSize: '13px', color: '#4a5568' }}>
                    <div className={styles.infoRow}><label>ID</label><span>{selectedItem.id.toString().padStart(6, '0')}</span></div>
                    <div className={styles.infoRow}><label>型式</label><span>{selectedItem.modelNumber || '-'}</span></div>
                    <div className={styles.infoRow}><label>取得年月日</label><span>{formatDate(selectedItem.acquisitionDate)}</span></div>
                    <div className={styles.infoRow}><label>取得価額</label><span>{selectedItem.acquisitionCost?.toLocaleString() || '-'}円</span></div>
                    <div className={styles.infoRow}><label>学科</label><span>{selectedItem.department || '-'}</span></div>
                    <div className={styles.infoRow}><label>最終編集者</label><span>{selectedItem.updatedBy || '-'}</span></div>
                    <div className={styles.infoRow}><label>最終更新日時</label><span>{formatDateTime(selectedItem.updatedAt)}</span></div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                  1. 現在の管理場所
                </label>
                <div style={{ padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '1px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 5px 0' }}>登録されている場所:</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: '#2c3e50', margin: 0 }}>
                    {selectedItem.location || '未登録'}
                  </p>
                </div>
                <input 
                  className={styles.inputField} 
                  value={newLocation} 
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="実際の管理場所を入力してください"
                  style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #4a6fa5', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                  2. 現在の状態
                </label>
                <div style={{ padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '1px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 5px 0' }}>登録されている状態:</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: '#2c3e50', margin: 0 }}>
                    {getStatusLabel(selectedItem.status)}
                  </p>
                </div>
                <select 
                  className={styles.inputField}
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #4a6fa5', appearance: 'auto' }}
                >
                  <option value="USED">使用中</option>
                  <option value="UNUSED">未使用</option>
                  <option value="UNKNOWN">不明（紛失など）</option>
                  <option value="DISPOSED">除却（廃棄済み）</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                  3. 現在の個数（在庫数）
                </label>
                <div style={{ padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '1px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 5px 0' }}>登録されている個数:</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: '#2c3e50', margin: 0 }}>
                    {selectedItem.stock ?? 1}
                  </p>
                </div>
                <input 
                  type="number"
                  className={styles.inputField} 
                  value={newStock} 
                  onChange={e => setNewStock(parseInt(e.target.value) || 0)}
                  min="0"
                  style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #4a6fa5', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginTop: '20px', padding: '10px', background: '#fff4e5', borderRadius: '1px', fontSize: '12px', color: '#663c00', border: '1px solid #ffdcb2' }}>
              確定後、この資産の棚卸し情報は変更できなくなります。
              </div>
            </div>

            <div className={styles.infoCardFooter} style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className={styles.closeBtn} style={{ background: '#eee', color: '#666' }} onClick={() => setSelectedItem(null)}>戻る</button>
              <button className={styles.saveButton} style={{ padding: '10px 30px', fontSize: '16px' }} onClick={handleSubmit}>変更を送信する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}