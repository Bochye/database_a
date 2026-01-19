'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/page.module.css';

type Req = {
  id: number;
  requesterId: string;
  type: string;
  status: string;
  note?: string | null;      // 申請者のメモ
  adminNote?: string | null; // 管理者のメモ
  createdAt: string;
  item: {
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
    ownerid: string;
    createdAt: string;
    updatedAt?: string | null;
    department?: string | null;
  };
};

export default function AdminRequests() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState(''); 
  const [selectedReq, setSelectedReq] = useState<Req | null>(null);
  const [showAssetDetail, setShowAssetDetail] = useState(false);

  // --- 検索用ステート ---
  const [searchAssetName, setSearchAssetName] = useState('');
  const [searchRequester, setSearchRequester] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    const actionLabel = status === 'APPROVED' ? '承認' : '却下';
    if (!window.confirm(`${actionLabel}しますか？`)) return;

    const res = await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, note: adminNote }),
    });

    if (res.ok) {
      setAdminNote('');
      setSelectedReq(null);
      setShowAssetDetail(false);
      await load();
    } else {
      alert('更新に失敗しました');
    }
  };

  const translateType = (type: string) => {
    const types: { [key: string]: string } = {
      'REPAIR': '修理',
      'DISPOSAL': '廃棄',
      'SEAL_REISSUE': 'ラベル再発行'
    };
    return types[type] || type;
  };

  const translateStatus = (status: string) => {
    const statuses: { [key: string]: string } = {
      'PENDING': '保留中',
      'APPROVED': '承認済み',
      'REJECTED': '却下済み'
    };
    return statuses[status] || status;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return { background: '#fff4e5', color: '#663c00' };
      case 'APPROVED': return { background: '#e8f5e9', color: '#2e7d32' };
      case 'REJECTED': return { background: '#ffebee', color: '#c62828' };
      default: return {};
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchAssetName = r.item.name.toLowerCase().includes(searchAssetName.toLowerCase()) || 
                           r.item.assetCode.toLowerCase().includes(searchAssetName.toLowerCase());
    const matchRequester = r.requesterId.toLowerCase().includes(searchRequester.toLowerCase());
    const matchType = filterType === '' || r.type === filterType;
    const matchStatus = filterStatus === '' || r.status === filterStatus;
    return matchAssetName && matchRequester && matchType && matchStatus;
  });

  const handleReset = () => {
    setSearchAssetName('');
    setSearchRequester('');
    setFilterType('');
    setFilterStatus('');
  };

  return (
    <div className={styles.tabContent}>
      {/* 検索パネル */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '1px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <input 
          className={styles.inputField} 
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '1px', width: '200px' }}
          value={searchAssetName} 
          onChange={e => setSearchAssetName(e.target.value)} 
          placeholder="資産名・コードで検索..." 
        />
        <input 
          className={styles.inputField} 
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '1px', width: '120px' }}
          value={searchRequester} 
          onChange={e => setSearchRequester(e.target.value)} 
          placeholder="依頼者で検索..." 
        />
        <select 
          className={styles.inputField} 
          style={{ padding: '8px 12px', width: '130px', border: '1px solid #ddd' }}
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">全ての申請</option>
          <option value="REPAIR">修理</option>
          <option value="DISPOSAL">廃棄</option>
          <option value="SEAL_REISSUE">ラベル再発行</option>
        </select>
        <select 
          className={styles.inputField} 
          style={{ padding: '8px 12px', width: '130px', border: '1px solid #ddd' }}
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">全ての状態</option>
          <option value="PENDING">保留中</option>
          <option value="APPROVED">承認済み</option>
          <option value="REJECTED">却下済み</option>
        </select>
        <button className={styles.reloadButton} onClick={load}>↻ 更新</button>
        <button className={styles.resetButton} onClick={handleReset}>リセット</button>
      </div>

      <div className={styles.tableContainer}>
        <h3 style={{ marginBottom: '17px', color: '#4a6fa5', textAlign: 'center' }}>申請管理一覧</h3>
        {loading ? (
          <p>読み込み中...</p>
        ) : (
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>資産名 / 資産コード</th>
                <th>型式</th>
                <th>申請種類</th>
                <th>依頼者</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(r => (
                <tr key={r.id} className={styles.clickableRow} onClick={() => {
                  setSelectedReq(r);
                  setAdminNote(r.adminNote || '');
                  setShowAssetDetail(false);
                }}>
                  <td>{r.id.toString().padStart(4, '0')}</td>
                  <td className={styles.nameCell} style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: '#666' }}>{r.item.assetCode}</div>
                    <div style={{ fontWeight: 'bold' }}>{r.item.name}</div>
                  </td>
                  <td>{r.item.modelNumber || '-'}</td>
                  <td>{translateType(r.type)}</td>
                  <td>{r.requesterId}</td>
                  <td>
                    <span className={styles.statusLabel} style={getStatusStyle(r.status)}>
                      {translateStatus(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filteredRequests.length === 0 && (
          <p style={{ padding: '20px', color: '#666', textAlign: 'center' }}>該当する申請はありません。</p>
        )}
      </div>

      {/* 申請詳細モーダル */}
      {selectedReq && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReq(null)}>
          <div className={styles.infoCard} style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>申請詳細の確認</h3>
              <button onClick={() => setSelectedReq(null)}>×</button>
            </div>
            
            <div className={styles.infoCardContent}>
              <div className={styles.infoRow}><label>現在の状態</label>
                <span className={styles.statusLabel} style={getStatusStyle(selectedReq.status)}>{translateStatus(selectedReq.status)}</span>
              </div>
              <div className={styles.infoRow}><label>申請の種類</label><span>{translateType(selectedReq.type)}</span></div>
              <div className={styles.infoRow}><label>申請日時</label><span>{new Date(selectedReq.createdAt).toLocaleString('ja-JP')}</span></div>
              <div className={styles.infoRow}><label>依頼者ユーザー</label><span>{selectedReq.requesterId}</span></div>
              <div className={styles.infoRow}><label>依頼者の備考</label>
                <span style={{ textAlign: 'left', background: '#fff', border: '1px solid #eee', padding: '8px', borderRadius: '2px', fontSize: '13px', width: '60%' }}>
                  {selectedReq.note || '(なし)'}
                </span>
              </div>
              
              <hr style={{ margin: '15px 0', border: 'none', borderBottom: '1px solid #eee' }} />
              
              {/* 対象資産のセクション */}
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <label style={{ fontSize: '11px', color: '#666', display: 'block' }}>対象資産</label>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedReq.item.name}</span>
                  </div>
                  <button 
                    className={styles.secondaryButton} 
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                    onClick={() => setShowAssetDetail(!showAssetDetail)}
                  >
                    {showAssetDetail ? '詳細を隠す' : '資産の全詳細を見る'}
                  </button>
                </div>

                {showAssetDetail && (
                  <div style={{ marginTop: '12px', borderTop: '1px dashed #ccc', paddingTop: '10px', fontSize: '13px' }}>
                    <div className={styles.infoRow}><label>資産コード</label><span>{selectedReq.item.assetCode}</span></div>
                    <div className={styles.infoRow}><label>型式</label><span>{selectedReq.item.modelNumber || '-'}</span></div>
                    <div className={styles.infoRow}><label>取得年月日</label><span>{selectedReq.item.acquisitionDate || '-'}</span></div>
                    <div className={styles.infoRow}><label>設置・管理場所</label><span>{selectedReq.item.location || '-'}</span></div>
                    <div className={styles.infoRow}><label>現在の使用者</label><span>{selectedReq.item.manager || '-'}</span></div>
                    <div className={styles.infoRow}><label>所有者ID</label><span>{selectedReq.item.ownerid}</span></div>
                    <div className={styles.infoRow}><label>所属部署</label><span>{selectedReq.item.department || '-'}</span></div>
                  </div>
                )}
              </div>

              {/* 管理者操作エリア */}
              <div style={{ marginTop: '10px', padding: '15px', border: '1px solid #4a6fa5', borderRadius: '4px', background: '#f0f4f8' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4a6fa5', textAlign: 'left' }}>
                  管理者メモ (承認/却下理由)
                </label>
                <textarea 
                  className={styles.inputField} 
                  style={{ width: '100%', height: '80px', marginBottom: '15px', resize: 'none', border: '1px solid #4a6fa5', borderRadius: '2px', padding: '8px' }}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="理由を入力してください..."
                  disabled={selectedReq.status !== 'PENDING'}
                />
                
                {selectedReq.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className={styles.editButton} style={{ padding: '10px 25px', fontSize: '14px' }} onClick={() => setStatus(selectedReq.id, 'APPROVED')}>承認する</button>
                    <button className={styles.deleteButton} style={{ padding: '10px 25px', fontSize: '14px', backgroundColor: '#c62828' }} onClick={() => setStatus(selectedReq.id, 'REJECTED')}>却下する</button>
                  </div>
                ) : (
                  <p style={{ textAlign: 'right', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>この申請は判定済みです。</p>
                )}
              </div>
            </div>

            <div className={styles.infoCardFooter}>
              <button className={styles.closeBtn} onClick={() => setSelectedReq(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}