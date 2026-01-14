'use client';

import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/page.module.css'; 
import EditUsers from './editusers';

type Account = {
  id: number;
  userid: string;
  isadmin: boolean;
  department?: string;
};

interface AdminUsersProps {
  onUserUpdate?: () => void; // ユーザー変更時にDashboardの資産一覧をリロードするための関数
}

export default function AdminUsers({ onUserUpdate }: AdminUsersProps) {
  const [users, setUsers] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Account | null>(null);
  
  // 新規追加モーダルの表示管理
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [searchName, setSearchName] = useState('');
  const [searchDept, setSearchDept] = useState('');

  // ユーザー一覧の取得、および必要に応じてDashboard側の資産一覧をリロード
  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setUsers(data.accounts || []);
      
      // ユーザー情報（名前等）が変わった可能性があるため、Dashboard側の資産一覧も再読み込みさせる
      if (onUserUpdate) {
        onUserUpdate();
      }
    } catch (error) {
      console.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 管理者権限の切り替え
  const toggleAdmin = async (user: Account) => {
    const actionText = user.isadmin ? '一般ユーザーに降格' : '管理者に昇格';
    const confirmMessage = `ユーザー「${user.userid}」を${actionText}させますか？`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isadmin: !user.isadmin }),
      });

      if (res.ok) {
        load();
      } else {
        alert('更新に失敗しました');
      }
    } catch (error) {
      alert('通信エラーが発生しました');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchName = u.userid.toLowerCase().includes(searchName.toLowerCase());
    const matchDept = searchDept === '' || u.department === searchDept;
    return matchName && matchDept;
  });

  return (
    <div className={styles.tabContent}>
      {/* 検索・操作バーセクション */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '1px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <input 
          type="text"
          placeholder="ユーザーIDで検索..." 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '1px', width: '250px' }}
        />
        <select 
          value={searchDept}
          onChange={(e) => setSearchDept(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '1px' }}
        >
          <option value="">全ての学科</option>
          <option value="AD">AD</option>
          <option value="EE">EE</option>
          <option value="ME">ME</option>
          <option value="CS">CS</option>
        </select>
        <button className={styles.reloadButton} onClick={load}>↻ 更新</button>
        
        <button 
          className={styles.addButton} 
          onClick={() => setIsAddModalOpen(true)}
          style={{ marginLeft: '10px' }}
        >
          新規ユーザー追加
        </button>
      </div>

      <div className={styles.tableContainer}>
        <h3 style={{ marginBottom: '17px', color: '#4a6fa5', textAlign: 'center' }}>ユーザー情報の管理</h3>
        {isLoading ? (
          <p>読み込み中...</p>
        ) : (
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>userid</th>
                <th>学科</th>
                <th>管理者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className={styles.clickableRow}>
                  <td onClick={() => setEditingUser(u)}>{u.id.toString().padStart(4, '0')}</td>
                  <td onClick={() => setEditingUser(u)} className={styles.nameCell} style={{ textAlign: 'left' }}>{u.userid}</td>
                  <td onClick={() => setEditingUser(u)}>{u.department || '-'}</td>
                  <td onClick={() => setEditingUser(u)}>
                    <span className={styles.statusLabel} style={{ 
                      background: u.isadmin ? '#ffebeb' : '#eef2f8', 
                      color: u.isadmin ? '#d32f2f' : '#4a6fa5' 
                    }}>
                      {u.isadmin ? '管理者' : '一般ユーザー'}
                    </span>
                  </td>
                  <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.editButton} 
                        onClick={() => setEditingUser(u)}
                      >
                        編集
                      </button>
                      
                      <button 
                        className={styles.secondaryButton} 
                        onClick={() => toggleAdmin(u)}
                      >
                        {u.isadmin ? '一般に戻す' : '昇格'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && filteredUsers.length === 0 && (
          <p style={{ padding: '20px', color: '#666' }}>該当するユーザーは見つかりませんでした。</p>
        )}
      </div>

      {/* 編集モーダル（既存ユーザー） */}
      {editingUser && (
        <EditUsers 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={load} 
        />
      )}

      {/* 新規作成モーダル（userを渡さない） */}
      {isAddModalOpen && (
        <EditUsers 
          onClose={() => setIsAddModalOpen(false)} 
          onSave={load} 
        />
      )}
    </div>
  );
}