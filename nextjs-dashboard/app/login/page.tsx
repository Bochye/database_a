//動かなかった場合、(TypeError: Cannot read properties...) node_modulesの再インストールとprismaのリセット・再migrationを行う
//prisma/migrationsとnode_modulesを消す
//npm i

//npx prisma migrate reset
//npx prisma generate
//npx prisma migrate dev --name init
//npx prisma db seed

//const value = await fetch(`http://localhost:3000/api/search_user?user=${encodeURIComponent(setloginid)}&pass=${encodeURIComponent(setpassword)}`).then(res => res.json());

//git config --global user.name "USER_NAME"
//git config --global user.email "USER_EMAIL"

//213732137+Bochye@users.noreply.github.com

'use client'

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  const [str_id, setloginid] = useState("");
  const [str_pass, setpassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'fail'>('idle');

  const router = useRouter();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  const handleLogin = async () => {
    if (!str_id || !str_pass) return;
    
    setLoginStatus('loading');
    const url = `/api/search_user?user=${encodeURIComponent(str_id)}&pass=${encodeURIComponent(str_pass)}`;
    
    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.success === true) {
        localStorage.setItem('loggedInUser', str_id);
        localStorage.setItem('isAdmin', result.isAdmin ? 'true' : 'false');
        router.push('/dashboard');
      } else {
        setLoginStatus('fail');
      }
    } catch (error) {
      console.error('通信エラー:', error);
      setLoginStatus('fail');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>資産管理システム</h1>
      </header>

      <div className={styles.loginCard}>
        <div className={styles.cardHeader}>
          <h2>ログイン</h2>
          <p>IDとパスワードを入力してください</p>
        </div>

        <div className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <label>ログインID</label>
            <input
              type="text"
              placeholder="例: admin"
              value={str_id}
              onChange={e => setloginid(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>パスワード</label>
            <input
              type="password"
              placeholder=""
              value={str_pass}
              onChange={e => setpassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button 
            className={styles.loginButton} 
            onClick={handleLogin}
            disabled={loginStatus === 'loading'}
          >
            {loginStatus === 'loading' ? '...' : 'ログイン'}
          </button>

          {loginStatus === 'fail' && (
            <div className={styles.errorMessage}>
              ログインIDまたはパスワードが正しくありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}