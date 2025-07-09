import React, { useState } from "react"; //キー入力を受け付けるuseStateをimport
import styles from './page.module.css'; //CSSをインポート


export default function Page() {
//まだ中身なし
  return (
    <div className={styles.loginformmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>
          資産管理アプリ
        </h1>
      </header>
      <div className={styles.passinputs}>
        <div className={styles.passinput}>
          <input type="text" placeholder="ログインID"/>
        </div>
        <div className={styles.passinput}></div>
          <input type="text" placeholder="パスワード"/>
        </div>
      <button className={styles.login_text_1}>
      ログイン
      </button>
    </div>
  )
};