'use client';

import React, { useState } from 'react';
import styles from './edititems.module.css';

type RequestType = 'REPAIR' | 'DISPOSAL' | 'SEAL_REISSUE';

interface Props {
  itemId: number;
  requesterId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RequestModal({ itemId, requesterId, onClose, onSubmitted }: Props) {
  const [type, setType] = useState<RequestType>('REPAIR');
  const [note, setNote] = useState(''); // 申請者の備考
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // note は自動的に DB の note カラム（申請者用）へ保存されます
        body: JSON.stringify({ 
          itemId, 
          requesterId, 
          type, 
          note 
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '申請の送信に失敗しました');
      }

      onSubmitted();
      onClose();
      alert('申請を送信しました');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* ヘッダー */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>申請の作成</h2>
          <button 
            type="button" 
            className={styles.closeButton} 
            onClick={onClose}
            disabled={isLoading}
          >
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGrid}>
            {/* 申請の種類 - 1段目 */}
            <label className={styles.formLabel}>
              <span className={styles.labelText}>
                申請の種類 <span className={styles.requiredStar}>*</span>
              </span>
              <select 
                className={`${styles.inputField} ${styles.selectField}`} 
                value={type} 
                onChange={e => setType(e.target.value as RequestType)}
                required
                disabled={isLoading}
              >
                <option value="REPAIR">修理依頼</option>
                <option value="DISPOSAL">廃棄申請</option>
                <option value="SEAL_REISSUE">管理ラベル再発行</option>
              </select>
            </label>

            {/* 空の div でグリッドの右側を埋めるか、そのまま次を全幅にする */}
            <div className={styles.formLabel} />

            {/* 備考・理由 - 2段目（全幅表示） */}
            <label className={styles.formLabel} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.labelText}>申請理由・備考</span>
              <textarea 
                className={styles.inputField} 
                style={{ height: '100px', resize: 'none', padding: '8px' }}
                value={note} 
                onChange={e => setNote(e.target.value)}
                placeholder="故障の状況や、廃棄が必要な理由を具体的に入力してください"
                disabled={isLoading}
              />
            </label>
          </div>

          {/* フッターボタン */}
          <div className={styles.buttonContainer}>
            <button 
              type="button" 
              className={`${styles.button} ${styles.cancelButton}`} 
              onClick={onClose}
              disabled={isLoading}
            >
              キャンセル
            </button>
            <button 
              type="submit" 
              className={`${styles.button} ${styles.saveButton}`}
              disabled={isLoading}
            >
              {isLoading ? '送信中...' : '申請を送信'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}