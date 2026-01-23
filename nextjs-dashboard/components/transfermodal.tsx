'use client';

import React, { useState } from 'react';
import styles from './edititems.module.css';

interface Props {
  itemId: number;
  currentManager?: string | null;
  onClose: () => void;
  onUpdated: () => void;
  userId: string;
}

export default function TransferModal({ itemId, currentManager, onClose, onUpdated, userId }: Props) {
  const [manager, setManager] = useState(''); // 新しい管理者は空で開始
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, manager, updatedBy: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // API側で返した「ユーザーがいません」というエラーをセット
        throw new Error(data.error || '引継ぎに失敗しました');
      }

      alert('引継ぎが完了しました');
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message); // ここに「ユーザーは登録されていません」が表示される
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>備品の引き継ぎ</h2>
          <button onClick={onClose} className={styles.closeButton} disabled={isLoading}>X</button>
        </div>

        <form onSubmit={submit} className={styles.formBody}>
          {/* エラーメッセージがある場合に表示 */}
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGrid}>
            <label className={styles.formLabel}>
              <span className={styles.labelText}>現在の使用者</span>
              <input
                className={styles.inputField}
                value={currentManager || '未設定'}
                disabled
                style={{ backgroundColor: '#f5f5f5', color: '#666' }}
              />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>新しい使用者のユーザー名 <span className={styles.requiredStar}>*</span></span>
              <input
                className={styles.inputField}
                value={manager}
                onChange={e => setManager(e.target.value)}
                placeholder="登録済みのIDを入力"
                required
                disabled={isLoading}
              />
            </label>
          </div>

          <div className={styles.buttonContainer}>
            <button type="button" className={`${styles.button} ${styles.cancelButton}`} onClick={onClose} disabled={isLoading}>
              キャンセル
            </button>
            <button type="submit" className={`${styles.button} ${styles.saveButton}`} disabled={isLoading}>
              {isLoading ? '確認中...' : '引き継ぐ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}