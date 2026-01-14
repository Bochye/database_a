'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './edititems.module.css';

interface Account {
  id: number;
  userid: string;
  department?: string;
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

  const performLogout = () => {
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
        performLogout();
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
      if (!res.ok) throw new Error('削除に失敗しました');

      if (isSelf) {
        performLogout();
        return;
      }

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
    </div>
  );
}