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
    location?: string | null;
    manager?: string | null;
    status: string;
  };
};

interface Props {
  user: string; // ログイン中のユーザーID
}

export default function UserRequests({ user }: Props) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<Req | null>(null);

  // --- 検索用ステート ---
  const [searchAssetName, setSearchAssetName] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      // 自分が依頼者のものだけを表示
      const myRequests = (data.requests || []).filter((r: Req) => r.requesterId === user);
      setRequests(myRequests);
    } catch (error) {
      console.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

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

  // --- フィルタリングロジック ---
  const filteredRequests = requests.filter(r => {
    const matchAssetName = r.item.name.toLowerCase().includes(searchAssetName.toLowerCase()) || 
                           r.item.assetCode.toLowerCase().includes(searchAssetName.toLowerCase());
    const matchType = filterType === '' || r.type === filterType;
    const matchStatus = filterStatus === '' || r.status === filterStatus;
    return matchAssetName && matchType && matchStatus;
  });

  const handleReset = () => {
    setSearchAssetName('');
    setFilterType('');
    setFilterStatus('');
  };

  return (
    <div className={styles.tabContent}>
      {/* 検索パネル */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '1px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <input 
          className={styles.inputField} 
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '1px', width: '250px' }}
          value={searchAssetName} 
          onChange={e => setSearchAssetName(e.target.value)} 
          placeholder="資産名・コードで絞り込み..." 
        />
        <select 
          className={styles.inputField} 
          style={{ padding: '8px 12px', width: '150px', border: '1px solid #ddd' }}
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">全ての申請種類</option>
          <option value="REPAIR">修理</option>
          <option value="DISPOSAL">廃棄</option>
          <option value="SEAL_REISSUE">ラベル再発行</option>
        </select>
        <select 
          className={styles.inputField} 
          style={{ padding: '8px 12px', width: '150px', border: '1px solid #ddd' }}
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
        <h3 style={{ marginBottom: '17px', color: '#4a6fa5', textAlign: 'center' }}>あなたの申請履歴</h3>
        {loading ? (
          <p>読み込み中...</p>
        ) : (
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>申請日</th>
                <th>資産名 / 資産コード</th>
                <th>型式</th>
                <th>種類</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(r => (
                <tr key={r.id} className={styles.clickableRow} onClick={() => setSelectedReq(r)}>
                  <td style={{ fontSize: '12px' }}>{new Date(r.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className={styles.nameCell} style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: '#666' }}>{r.item.assetCode}</div>
                    <div style={{ fontWeight: 'bold' }}>{r.item.name}</div>
                  </td>
                  <td>{r.item.modelNumber || '-'}</td>
                  <td>{translateType(r.type)}</td>
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
          <p style={{ padding: '20px', color: '#666', textAlign: 'center' }}>該当する申請履歴はありません。</p>
        )}
      </div>

      {/* 詳細モーダル */}
      {selectedReq && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReq(null)}>
          <div className={styles.infoCard} style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>申請詳細および管理者回答</h3>
              <button onClick={() => setSelectedReq(null)}>×</button>
            </div>
            
            <div className={styles.infoCardContent}>
              <div className={styles.infoRow}><label>現在の状態</label>
                <span className={styles.statusLabel} style={getStatusStyle(selectedReq.status)}>{translateStatus(selectedReq.status)}</span>
              </div>
              <div className={styles.infoRow}><label>申請の種類</label><span>{translateType(selectedReq.type)}</span></div>
              <div className={styles.infoRow}><label>資産名</label><span style={{ fontWeight: 'bold' }}>{selectedReq.item.name}</span></div>
              <div className={styles.infoRow}><label>型式</label><span>{selectedReq.item.modelNumber || '-'}</span></div>
              <div className={styles.infoRow}><label>申請日</label><span>{new Date(selectedReq.createdAt).toLocaleString('ja-JP')}</span></div>
              
              <div style={{ marginTop: '15px' }}>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>あなたの備考:</label>
                <div style={{ marginTop: '5px', padding: '10px', background: '#f9f9f9', border: '1px solid #eee', fontSize: '14px', borderRadius: '2px', minHeight: '40px' }}>
                  {selectedReq.note || '(未入力)'}
                </div>
              </div>

              {/* 管理者からのメモセクション（強調表示） */}
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: selectedReq.status === 'REJECTED' ? '#fff5f5' : '#f0f7ff', 
                borderRadius: '4px', 
                borderLeft: `4px solid ${selectedReq.status === 'REJECTED' ? '#c62828' : '#4a6fa5'}` 
              }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  marginBottom: '8px', 
                  color: selectedReq.status === 'REJECTED' ? '#c62828' : '#4a6fa5' 
                }}>
                  管理者からのメッセージ
                </label>
                <div style={{ fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {selectedReq.adminNote || (selectedReq.status === 'PENDING' ? '現在、管理者が内容を確認中です。しばらくお待ちください。' : '回答メモはありません。')}
                </div>
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