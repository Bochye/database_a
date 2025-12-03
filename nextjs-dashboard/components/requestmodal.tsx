'use client';

import React, { useState } from 'react';
import styles from './requestmodal.module.css';

type RequestType = 'REPAIR' | 'DISPOSAL' | 'SEAL_REISSUE';

interface Props {
  itemId: number;
  requesterId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RequestModal({ itemId, requesterId, onClose, onSubmitted }: Props) {
  const [type, setType] = useState<RequestType>('REPAIR');
  const [note, setNote] = useState('');

  const submit = async () => {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, requesterId, type, note }),
    });
    if (res.ok) {
      onSubmitted();
      onClose();
      alert('申請を送信しました');
    } else {
      alert('申請に失敗しました');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>申請を作成</h3>
        <label className={styles.label}>
          種類
          <select className={styles.select} value={type} onChange={e => setType(e.target.value as RequestType)}>
            <option value="REPAIR">修理</option>
            <option value="DISPOSAL">廃棄</option>
            <option value="SEAL_REISSUE">シール再発行</option>
          </select>
        </label>
        <label className={styles.label}>
          備考
          <textarea className={styles.textarea} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose}>キャンセル</button>
          <button className={styles.submit} onClick={submit}>申請</button>
        </div>
      </div>
    </div>
  );
}