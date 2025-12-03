'use client';

import React, { useEffect, useState } from 'react';
import styles from './adminrequests.module.css';

type Req = {
  id: number;
  requesterId: string;
  type: string;
  status: string;
  note?: string | null;
  createdAt: string;
  item: {
    id: number;
    assetCode: string;
    name: string;
    location?: string | null;
    manager?: string | null;
  };
};

export default function AdminRequests() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/requests');
    const data = await res.json();
    setRequests(data.requests || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    const res = await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, note }),
    });
    if (res.ok) {
      setNote('');
      await load();
    } else {
      alert('更新に失敗しました');
    }
  };

  if (loading) return <p>申請を読み込み中...</p>;

  return (
    <div className={styles.container}>
      <h3>申請の確認</h3>
      <div className={styles.noteRow}>
        <label>管理者メモ</label>
        <input className={styles.noteInput} value={note} onChange={e => setNote(e.target.value)} placeholder="承認/却下時のメモ" />
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th><th>資産</th><th>種類</th><th>依頼者</th><th>状態</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.item.assetCode} / {r.item.name}</td>
              <td>{r.type}</td>
              <td>{r.requesterId}</td>
              <td>{r.status}</td>
              <td className={styles.actions}>
                <button onClick={() => setStatus(r.id, 'APPROVED')} disabled={r.status !== 'PENDING'}>承認</button>
                <button onClick={() => setStatus(r.id, 'REJECTED')} disabled={r.status !== 'PENDING'}>却下</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}