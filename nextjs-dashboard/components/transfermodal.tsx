'use client';

import React, { useState } from 'react';
import styles from './transfermodal.module.css';

interface Props {
  itemId: number;
  currentManager?: string | null;
  currentOwnerId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TransferModal({ itemId, currentManager, currentOwnerId, onClose, onUpdated }: Props) {
  const [manager, setManager] = useState(currentManager || '');
  const [ownerId, setOwnerId] = useState(currentOwnerId);

  const submit = async () => {
    const res = await fetch('/api/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, manager, ownerid: ownerId }),
    });
    if (res.ok) {
      onUpdated();
      onClose();
      alert('引継ぎが完了しました（通知はUI内トーストの想定）');
    } else {
      alert('引継ぎに失敗しました');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>備品の引き継ぎ</h3>
        <label className={styles.label}>
          新しい管理者
          <input className={styles.input} value={manager} onChange={e => setManager(e.target.value)} />
        </label>
        <label className={styles.label}>
          新しい所有者ID
          <input className={styles.input} value={ownerId} onChange={e => setOwnerId(e.target.value)} />
        </label>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose}>キャンセル</button>
          <button className={styles.save} onClick={submit}>引き継ぐ</button>
        </div>
      </div>
    </div>
  );
}