'use client'

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Page() {
  const [str_id, setloginid] = useState("");
  const [str_pass, setpassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'fail'>('idle');

  const router = useRouter();

  const handleLogin = async () => {
    const url = `/api/search_user?user=${encodeURIComponent(str_id)}&pass=${encodeURIComponent(str_pass)}`;
    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.success === true) {
        localStorage.setItem('loggedInUser', str_id);
        // Pull role info (admin) for UI toggles
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
    <div className={styles.loginformmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>
          資産管理アプリ
        </h1>
      </header>

      <div className={styles.passinputs}>
        <div className={styles.passinput}>
          <input
            type="text"
            placeholder="ログインID"
            onChange={event => setloginid(event.target.value)}
          />
        </div>
        <div className={styles.passinput}>
          <input
            type="password"
            placeholder="パスワード"
            onChange={event => setpassword(event.target.value)}
          />
        </div>
      </div>

      <button className={styles.login_text_1} onClick={handleLogin}>
        ログイン
      </button>

      {loginStatus === 'fail' && <p style={{ color: 'red' }}>ログイン失敗</p>}
    </div>
  )
}