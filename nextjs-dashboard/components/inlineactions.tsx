'use client';

import React, { useState } from 'react';
import styles from './inlineactions.module.css';

interface Props {
  itemId: number;
  currentStatus: string;
  currentLocation?: string | null;
  onUpdated: () => void;
}

export default function InlineActions({ itemId, currentStatus, currentLocation, onUpdated }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [location, setLocation] = useState(currentLocation || '');

  const save = async () => {
    const res = await fetch('/api/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, status, location }),
    });
    if (res.ok) onUpdated();
    else alert('更新に失敗しました');
  };

  return (
    <div className={styles.row}>
      <select value={status} onChange={e => setStatus(e.target.value)} className={styles.select}>
        <option value="USED">使用中</option>
        <option value="UNUSED">未使用</option>
        <option value="UNKNOWN">不明</option>
        <option value="DISPOSED">除却</option>
      </select>
      <input
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder="管理場所"
        className={styles.input}
      />
      <button className={styles.button} onClick={save}>保存</button>
    </div>
  );
}