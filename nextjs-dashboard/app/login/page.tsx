'use client'

import React, { useState,useEffect } from "react"; //キー入力を受け付けるuseStateをimport
import { useRouter } from 'next/navigation';
import styles from './page.module.css'; //CSSをインポート
const { PrismaClient } = require('@prisma/client') ;
const prisma = new PrismaClient()

//動かなかった場合、(TypeError: Cannot read properties...) node_modulesの再インストールとprismaのリセット・再migrationを行う
//prisma/migrationsとnode_modulesを消す
//npm i

//npx prisma migrate reset
//npx prisma generate
//npx prisma migrate dev --name init

//const value = await fetch(`http://localhost:3000/api/search_user?user=${encodeURIComponent(setloginid)}&pass=${encodeURIComponent(setpassword)}`).then(res => res.json());

//git config --global user.name "USER_NAME"
//git config --global user.email "USER_EMAIL"

//213732137+Bochye@users.noreply.github.com

export default function Page() {
//まだ中身なし
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
        console.log('ログイン成功');

        localStorage.setItem('loggedInUser', str_id);
        router.push('/dashboard');
      } else {
        console.log('ログイン失敗');
        setLoginStatus('fail');
      }
    } catch (error) {
      console.error('通信エラー:', error);
      setLoginStatus('fail');
    }
  };

  //console.log({allUsers});

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
          defaultValue=""
          placeholder="ログインID"
          onChange={event => setloginid(event.target.value)}
          />
        </div>
        <div className={styles.passinput}></div>
          <input
          type="text"
          defaultValue=""
          placeholder="パスワード"
          onChange={event => setpassword(event.target.value)}
          />
        </div>

      <button className={styles.login_text_1} onClick={handleLogin}>
      ログイン
      </button>

      {loginStatus === 'fail' && <p style={{ color: 'red' }}>ログイン失敗</p>}
    </div>
  )
};