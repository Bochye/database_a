'use client';

import React, { useEffect, useState } from 'react';
import styles from './inventory.module.css';

type ItemRow = {
  id: number;
  assetCode: string;
  name: string;
  location?: string | null;
  status: string;
};

export default function Inventory({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    const res = await fetch(`/api/items?onlyMine=true&ownerId=${encodeURIComponent(ownerId)}`);
    const data = await res.json();
    const mapped = (data.items || []).map((i: any) => ({
      id: i.id,
      assetCode: i.assetCode,
      name: i.name,
      location: i.location,
      status: i.status,
    }));
    setItems(mapped);
    setChecked({});
    setLoading(false);
  };

  const loadRecords = async () => {
    const res = await fetch(`/api/inventory?ownerId=${encodeURIComponent(ownerId)}`);
    const data = await res.json();
    setRecords(data.records || []);
  };

  useEffect(() => {
    loadItems();
    loadRecords();
  }, []);

  const toggle = (id: number) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const submit = async () => {
    const selectedIds = Object.keys(checked).filter(k => checked[Number(k)]).map(Number);
    if (selectedIds.length === 0) {
      alert('確認する資産を選択してください');
      return;
    }
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, itemIds: selectedIds, note }),
    });
    if (res.ok) {
      alert('棚卸し確認を送信しました');
      setNote('');
      setChecked({});
      await loadRecords();
    } else {
      alert('送信に失敗しました');
    }
  };

  if (loading) return <p>棚卸し対象を読み込み中...</p>;

  return (
    <div className={styles.container}>
      <h3>棚卸し</h3>
      <div className={styles.noteRow}>
        <label>備考</label>
        <input className={styles.noteInput} value={note} onChange={e => setNote(e.target.value)} placeholder="確認メモ（任意）" />
      </div>

      <table className={styles.table}>
        <thead>
          <tr><th></th><th>コード</th><th>資産名</th><th>場所</th><th>状態</th></tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td>
                <input type="checkbox" checked={!!checked[i.id]} onChange={() => toggle(i.id)} />
              </td>
              <td>{i.assetCode}</td>
              <td>{i.name}</td>
              <td>{i.location || '-'}</td>
              <td>{i.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className={styles.submit} onClick={submit}>選択した資産を確認済みにする</button>

      <h4 className={styles.historyTitle}>棚卸し履歴</h4>
      <ul className={styles.historyList}>
        {records.map(r => (
          <li key={r.id}>
            {new Date(r.confirmedAt).toLocaleString('ja-JP')} - {r.item.assetCode}/{r.item.name} {r.note ? `(${r.note})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}