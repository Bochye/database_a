'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
const { PrismaClient } = require('@prisma/client') ;
const prisma = new PrismaClient()

/*const handleLogout = () => {
  localStorage.removeItem('loggedInUser');
  router.push('/');
};
*/

export default function DashboardPage() {
  const [user, setUser] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
      // ログインしていなければログインページに戻す
      router.push('/login');
    } else {
      setUser(loggedInUser);
    }
  }, [router]);

  if (!user) return <p>Checking...</p>;

  return (
    <div className={styles.dashboardmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>
          資産管理アプリ
        </h1>
      </header>
      <div className={styles.menues}>
        <div className={styles.yourelogin}>
          ログイン中<br></br>{user}
        </div>
      </div>
    </div>
  )
}