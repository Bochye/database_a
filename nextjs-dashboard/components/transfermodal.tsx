'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './edititems.module.css';

interface AccountOption {
  id: number;
  userid: string;
  department?: string;
}

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

  // 使用者サジェスト用
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredAccounts, setFilteredAccounts] = useState<AccountOption[]>([]);
  const managerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // アカウント一覧を取得
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        setAccounts(data.accounts || []);
      } catch (error) {
        console.error('Failed to load accounts');
      }
    };
    loadAccounts();
  }, []);

  // サジェスト外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        managerInputRef.current &&
        !managerInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 使用者フィールドの入力ハンドラー
  const handleManagerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManager(value);

    // フィルタリング
    if (value.trim()) {
      const filtered = accounts.filter(acc =>
        acc.userid.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredAccounts(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredAccounts(accounts);
      setShowSuggestions(true);
    }
  };

  // サジェスト選択
  const handleSelectAccount = (userid: string) => {
    setManager(userid);
    setShowSuggestions(false);
  };

  // 入力フォーカス時にサジェスト表示
  const handleManagerFocus = () => {
    if (manager.trim()) {
      const filtered = accounts.filter(acc =>
        acc.userid.toLowerCase().includes(manager.toLowerCase())
      );
      setFilteredAccounts(filtered);
    } else {
      setFilteredAccounts(accounts);
    }
    setShowSuggestions(true);
  };

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

            <label className={styles.formLabel} style={{ position: 'relative' }}>
              <span className={styles.labelText}>新しい使用者のユーザー名 <span className={styles.requiredStar}>*</span></span>
              <input
                ref={managerInputRef}
                className={styles.inputField}
                value={manager}
                onChange={handleManagerChange}
                onFocus={handleManagerFocus}
                placeholder="登録済みのIDを入力"
                required
                disabled={isLoading}
                autoComplete="off"
              />
              {showSuggestions && filteredAccounts.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {filteredAccounts.map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc.userid)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4f8'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <span style={{ fontWeight: 'bold' }}>{acc.userid}</span>
                      <span style={{ color: '#888', marginLeft: '8px', fontSize: '12px' }}>
                        ({acc.department || '-'})
                      </span>
                    </div>
                  ))}
                </div>
              )}
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