'use client';

import React, { useEffect, useState } from 'react';
import styles from './adminusers.module.css';

type Account = {
  id: number;
  userid: string;
  isadmin: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<Account[]>([]);
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [isadmin, setIsadmin] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const load = async () => {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    setUsers(data.accounts || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!userid || !password) return alert('userid と password が必要です');
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, password, isadmin }),
    });
    if (res.ok) {
      setUserid(''); setPassword(''); setIsadmin(false);
      load();
      alert('ユーザーを作成しました');
    } else {
      alert('作成に失敗しました');
    }
  };

  const reset = async (id: number) => {
    if (!resetPassword) return alert('新しいパスワードを入力してください');
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: resetPassword }),
    });
    if (res.ok) {
      setResetPassword('');
      load();
      alert('パスワードを更新しました');
    } else {
      alert('更新に失敗しました');
    }
  };

  const toggleAdmin = async (id: number, current: boolean) => {
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isadmin: !current }),
    });
    if (res.ok) load();
    else alert('更新に失敗しました');
  };

  return (
    <div className={styles.container}>
      <h3>ユーザー情報の管理</h3>
      <div className={styles.createRow}>
        <input placeholder="userid" value={userid} onChange={e => setUserid(e.target.value)} />
        <input placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
        <label>
          <input type="checkbox" checked={isadmin} onChange={() => setIsadmin(!isadmin)} /> 管理者
        </label>
        <button onClick={create}>作成</button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr><th>ID</th><th>userid</th><th>管理者</th><th>操作</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.userid}</td>
              <td>{u.isadmin ? 'はい' : 'いいえ'}</td>
              <td className={styles.actions}>
                <button onClick={() => toggleAdmin(u.id, u.isadmin)}>
                  {u.isadmin ? '管理者解除' : '管理者化'}
                </button>
                <input
                  className={styles.smallInput}
                  placeholder="新PW"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                />
                <button onClick={() => reset(u.id)}>PWリセット</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}