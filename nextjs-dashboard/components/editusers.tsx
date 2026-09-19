'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './edititems.module.css';

interface Account {
  id: number;
  userid: string;
  department?: string;
}

interface LinkedItem {
  id: number;
  assetCode: string;
  name: string;
  location: string | null;
  status: string;
}

interface EditUsersProps {
  user?: Account; // 編集時は必須、新規追加時は省略
  onClose: () => void;
  onSave: () => void;
}

export default function EditUsers({ user, onClose, onSave }: EditUsersProps) {
  const router = useRouter();
  
  // モード判定
  const isEditMode = !!user;

  // フォームステート
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('CS');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 引継ぎモーダル用ステート
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [transferTo, setTransferTo] = useState('');

  // 初期値のセット
  useEffect(() => {
    if (isEditMode && user) {
      setUserid(user.userid);
      setDepartment(user.department || 'CS');
    } else {
      setUserid('');
      setDepartment('CS');
    }
    setPassword('');
    setError(null);
  }, [user, isEditMode]);

  const performLogout = async () => {
    const response = await fetch('/api/search_user', { method: 'DELETE' });
    if (!response.ok) throw new Error('ログアウトに失敗しました。');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isAdmin');
    router.push('/login');
  };

  // 保存（作成・更新）処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 新規作成時はパスワード必須
    if (!isEditMode && !password) {
      setError('新規登録にはパスワードが必要です。');
      setIsLoading(false);
      return;
    }

    const loggedInUser = localStorage.getItem('loggedInUser');
    const isSelf = isEditMode && user?.userid === loggedInUser;

    try {
      const res = await fetch('/api/accounts', {
        method: isEditMode ? 'PATCH' : 'POST', // モードでメソッド切り替え
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...(isEditMode ? { id: user?.id } : {}), 
          userid, 
          department,
          ...(password ? { password } : {}) 
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存に失敗しました');
      }

      // 自分自身の情報を変更した場合は強制ログアウト
      if (isSelf && (userid !== user?.userid || password !== '')) {
        alert('ご自身のログイン情報を変更したため、再ログインが必要です。');
        await performLogout();
        return;
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // アカウント一覧を取得（引継ぎ先選択用）
  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAllAccounts(data.accounts || []);
    } catch (error) {
      console.error('Failed to load accounts');
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !user) return;

    const loggedInUser = localStorage.getItem('loggedInUser');
    const isSelf = user.userid === loggedInUser;

    const confirmMessage = isSelf
      ? "【警告】あなた自身のアカウントを削除しますか？削除すると即座にログアウトされます。"
      : `ユーザー「${user.userid}」を削除しますか？`;

    if (!window.confirm(confirmMessage)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/accounts?id=${user.id}`, { method: 'DELETE' });
      const data = await res.json();

      // 紐づき備品がある場合は引継ぎモーダルを表示
      if (res.status === 409 && data.error === 'HAS_LINKED_ITEMS') {
        setLinkedItems(data.linkedItems || []);
        await loadAccounts();
        setShowTransferModal(true);
        setIsLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      if (isSelf) {
        await performLogout();
        return;
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // 引継ぎして削除を実行
  const handleTransferAndDelete = async () => {
    if (!user || !transferTo) return;

    const loggedInUser = localStorage.getItem('loggedInUser');
    const isSelf = user.userid === loggedInUser;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/accounts?id=${user.id}&transferTo=${encodeURIComponent(transferTo)}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      if (isSelf) {
        await performLogout();
        return;
      }

      setShowTransferModal(false);
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isEditMode ? `ユーザー情報の編集 (ID: ${user?.id.toString().padStart(4, '0')})` : '新規ユーザーの追加'}
          </h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="閉じる" disabled={isLoading}>X</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGrid}>
            <label className={styles.formLabel}>
              <span className={styles.labelText}>ユーザーID <span className={styles.requiredStar}>*</span></span>
              <input 
                type="text" 
                value={userid} 
                onChange={(e) => setUserid(e.target.value)} 
                required 
                className={styles.inputField} 
                autoComplete="username"
              />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>学科 <span className={styles.requiredStar}>*</span></span>
              <select 
                value={department} 
                onChange={(e) => setDepartment(e.target.value)} 
                className={`${styles.inputField} ${styles.selectField}`}
              >
                <option value="AD">AD</option>
                <option value="EE">EE</option>
                <option value="ME">ME</option>
                <option value="CS">CS</option>
              </select>
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>
                {isEditMode ? '新パスワード (変更する場合のみ)' : 'パスワード *'}
              </span>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required={!isEditMode}
                className={styles.inputField} 
                placeholder="********"
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className={styles.buttonContainer}>
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                className={`${styles.button} ${styles.cancelButton}`}
                style={{
                  marginRight: 'auto',
                  backgroundColor: '#ffebeb',
                  color: '#d32f2f',
                  border: '1px solid #d32f2f'
                }}
                disabled={isLoading}
              >
                削除
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`${styles.button} ${styles.cancelButton}`}
              disabled={isLoading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.saveButton}`}
              disabled={isLoading}
            >
              {isLoading ? '保存中...' : (isEditMode ? '更新' : '作成')}
            </button>
          </div>
        </form>
      </div>

      {/* 引継ぎモーダル */}
      {showTransferModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1001 }}>
          <div className={styles.modalContainer} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>備品の引継ぎが必要です</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className={styles.closeButton}
                aria-label="閉じる"
                disabled={isLoading}
              >
                X
              </button>
            </div>

            <div className={styles.formBody}>
              {error && <div className={styles.errorMessage}>{error}</div>}

              <p style={{ marginBottom: '15px', color: '#666' }}>
                このアカウントには <strong>{linkedItems.length}件</strong> の備品が紐づいています。
                削除する前に引継ぎ先を選択してください。
              </p>

              {/* 紐づき備品一覧 */}
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '15px'
              }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>資産番号</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>名称</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>場所</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.assetCode}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.name}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.location || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 引継ぎ先選択 */}
              <div className={styles.formLabel}>
                <span className={styles.labelText}>引継ぎ先アカウント <span className={styles.requiredStar}>*</span></span>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className={`${styles.inputField} ${styles.selectField}`}
                  style={{ width: '100%' }}
                >
                  <option value="">-- 選択してください --</option>
                  {allAccounts
                    .filter(acc => acc.userid !== user?.userid)
                    .map(acc => (
                      <option key={acc.id} value={acc.userid}>
                        {acc.userid} ({acc.department || '-'})
                      </option>
                    ))}
                </select>
              </div>

              <div className={styles.buttonContainer} style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className={`${styles.button} ${styles.cancelButton}`}
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleTransferAndDelete}
                  className={`${styles.button} ${styles.saveButton}`}
                  style={{ backgroundColor: '#d32f2f' }}
                  disabled={isLoading || !transferTo}
                >
                  {isLoading ? '処理中...' : '引継ぎして削除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}