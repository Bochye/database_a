'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

// Itemsの型をschema.prismaに合わせて定義
interface Item {
  id: number;
  name: string;
  stock: number;
  ownerid: string;
  createdAt: string; // Date型ですが、JSONで文字列として受け取ることが多い
}

export default function DashboardPage() {
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // 1. ログインチェック
  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
      router.push('/login');
    } else {
      setUser(loggedInUser);
    }
  }, [router]);

  // 2. アイテムデータの取得
  useEffect(() => {
    if (user) {
      const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/items');
          if (!res.ok) {
            throw new Error('Failed to fetch items');
          }
          const data = await res.json();
          // 取得したすべてのフィールドをstateにセット
          setItems(data.items);
        } catch (err) {
          setError('アイテムの取得に失敗しました。');
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchItems();
    }
  }, [user]);

  // ログインチェック中の表示
  if (!user) return <p>Checking login status...</p>;

  // 日付を見やすい形式にフォーマットするヘルパー関数
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

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

      <main>
        <h2>一覧</h2>
        {isLoading && <p>アイテムを読み込み中...</p>}
        {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
        
        {!isLoading && !error && (
          // テーブル形式で一覧表示
          <div className={styles.tableContainer}>
            {items.length > 0 ? (
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名前</th>
                    <th>在庫数</th>
                    <th>所有者ID</th>
                    <th>作成日</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.stock}</td>
                      <td>{item.ownerid}</td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>登録されているアイテムはありません。</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}