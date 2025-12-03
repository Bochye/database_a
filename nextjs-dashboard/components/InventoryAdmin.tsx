'use client';

import React, { useEffect, useState } from 'react';
import styles from './inventoryadmin.module.css';

export default function InventoryAdmin() {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/inventoryrequests');
    const data = await res.json();
    setRequests(data.requests || []);
  };

  useEffect(() => { load(); }, []);

  const grouped = requests.reduce((acc, r) => {
    acc[r.userId] = acc[r.userId] || [];
    acc[r.userId].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const act = async (id: number, action: 'APPROVE' | 'RESUBMIT') => {
    await fetch('/api/inventoryrequests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    });
    await load();
  };

  return (
    <div className={styles.container}>
      <h3>棚卸し（管理者）</h3>
      {!selectedUser ? (
        <ul>
          {Object.keys(grouped).map(u => (
            <li key={u}>
              <button onClick={() => setSelectedUser(u)}>
                {u} ({grouped[u].length}件のリクエスト)
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h4>{selectedUser} のリクエスト</h4>
          <table className={styles.table}>
            <thead>
              <tr><th>資産コード</th><th>資産名</th><th>新場所</th><th>新状態</th><th>操作</th></tr>
            </thead>
            <tbody>
              {grouped[selectedUser] && grouped[selectedUser].map(r => (
                <tr key={r.id}>
                  <td>{r.item.assetCode}</td>
                  <td>{r.item.name}</td>
                  <td>{r.newLocation || '-'}</td>
                  <td>{r.newStatus || '-'}</td>
                  <td>
                    <button className={styles.button} onClick={() => act(r.id, 'APPROVE')}>承認</button>
                    <button className={styles.button} onClick={() => act(r.id, 'RESUBMIT')}>再提出依頼</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setSelectedUser(null)}>戻る</button>
        </>
      )}
    </div>
  );
}