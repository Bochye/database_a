'use client';

import React, { useEffect, useState } from 'react';
import styles from './inventoryuser.module.css';

export default function InventoryUser({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [changes, setChanges] = useState<Record<number, {status?: string, location?: string}>>({});

  useEffect(() => {
    fetch(`/api/items?onlyMine=true&ownerId=${ownerId}`)
      .then(res => res.json())
      .then(data => setItems(data.items || []));
  }, [ownerId]);

  const updateChange = (id: number, field: string, value: string) => {
    setChanges(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const submitChanges = async () => {
    for (const id of Object.keys(changes)) {
      const c = changes[Number(id)];
      await fetch('/api/inventoryrequests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: Number(id),
          userId: ownerId,
          newStatus: c.status,
          newLocation: c.location
        })
      });
    }
    alert('変更を送信しました');
    setChanges({});
  };

  return (
    <div className={styles.container}>
      <h3>棚卸し（ユーザー）</h3>
      <table className={styles.table}>
        <thead>
          <tr><th>コード</th><th>資産名</th><th>場所</th><th>状態</th></tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td>{i.assetCode}</td>
              <td>{i.name}</td>
              <td>
                <input
                  defaultValue={i.location || ''}
                  onChange={e => updateChange(i.id, 'location', e.target.value)}
                />
              </td>
              <td>
                <select
                  defaultValue={i.status}
                  onChange={e => updateChange(i.id, 'status', e.target.value)}
                >
                  <option value="USED">使用中</option>
                  <option value="UNUSED">未使用</option>
                  <option value="UNKNOWN">不明</option>
                  <option value="DISPOSED">除却</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={submitChanges}>変更を送信</button>
    </div>
  );
}