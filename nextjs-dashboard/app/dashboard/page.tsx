'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import EditItems, { ClientItem } from '../../components/edititems'; // ClientItemをインポート

// schema.prismaに合わせたItem型
interface Item {
  id: number;
  code: string;
  name: string;
  modelNumber?: string;
  // imageUrl?: string; <--- 削除
  acquisitionAt: string | null; 
  disposalAt?: string | null;
  value?: number | null; 
  manager?: string;
  location?: string;
  status: string;
  ownerId: string;
  createdAt: string;
  stock?: number;
}

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 編集対象のアイテムを保持する state
  const [editingItem, setEditingItem] = useState<Item | null>(null); 

  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // モーダルを開くハンドラ (新規作成/編集)
  const handleOpenModal = (itemToEdit: Item | null) => {
    setEditingItem(itemToEdit);
    setIsModalOpen(true);
  };

  // モーダルを閉じるハンドラ
  const handleCloseModal = () => {
    setEditingItem(null);
    setIsModalOpen(false);
  };
    
  // アイテムリストの更新ハンドラ
  const handleSave = useCallback((savedItem: ClientItem) => {
    setItems(prevItems => {
      // 既存のアイテムを編集した場合
      const existingIndex = prevItems.findIndex(item => item.id === savedItem.id);
      if (existingIndex !== -1) {
        // 既存のリストを更新
        const newItems = [...prevItems];
        newItems[existingIndex] = savedItem as Item;
        return newItems;
      } else {
        // 新規アイテムを追加した場合 (リストの先頭に追加)
        return [savedItem as Item, ...prevItems];
      }
    });
  }, []);

  // ログインチェック
  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
      router.push('/login');
    } else {
      setUser(loggedInUser);
    }
  }, [router]);

  // アイテム取得
  useEffect(() => {
    if (user) {
      const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/items'); 
          if (!res.ok) throw new Error('Failed to fetch items');
          const data = await res.json();
          setItems(data.items);
        } catch (err) {
          console.error(err);
          setError('資産データの取得に失敗しました。');
        } finally {
          setIsLoading(false);
        }
      };
      fetchItems();
    }
  }, [user]);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    router.push('/login');
  };

  if (!user) return <p>ログイン状態を確認中...</p>;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    // dateStringがPrismaから返されるISO文字列であると仮定
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className={styles.dashboardmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>資産管理ダッシュボード</h1>
      </header>

      <div className={styles.menues}>
        <div className={styles.yourelogin}>
          ログイン中<br />{user}
        </div>
        <button className={styles.logoutButton} onClick={handleLogout}>
          ログアウト
        </button>
      </div>


      <main>
        <div>
          {/* 新規追加ボタンは editingItem を null で渡す */}
          <button 
            onClick={() => handleOpenModal(null)}
            className={styles.addButton}
          >
            新規資産を追加
          </button>
        </div>
        {isLoading && <p>データを読み込み中...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!isLoading && !error && (
          <div className={styles.tableContainer}>
            {items.length > 0 ? (
              <table className={styles.itemsTable}>
                <thead>
                  <tr><th>ID</th><th>資産コード</th><th>資産名</th><th>型式</th><th>取得年月日</th><th>廃棄年月日</th><th>取得価額</th><th>管理者</th><th>管理場所</th><th>状態</th><th>所有者ID</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id.toString().padStart(6, '0')}</td>
                      <td>{item.code || '-'}</td>
                      <td>{item.name || '-'}</td>
                      <td>{item.modelNumber || '-'}</td>
                      <td>{item.acquisitionAt ? formatDate(item.acquisitionAt) : '-'}</td>
                      <td>{item.disposalAt ? formatDate(item.disposalAt) : '-'}</td>
                      <td>{item.value != null ? `${item.value.toLocaleString()}円` : '-'}</td>
                      <td>{item.manager || '-'}</td>
                      <td>{item.location || '-'}</td>
                      <td>{item.status || '-'}</td>
                      <td>{item.ownerId || '-'}</td>
                      <td className={styles.actionCell}>
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className={styles.editButton}
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>登録されている資産はありません。</p>
            )}
          </div>
        )}
      </main>
        {isModalOpen && (
        <EditItems
          onClose={handleCloseModal}
          onSave={handleSave} // 新規作成/更新の両方を処理するハンドラ
          ownerId={user!} 
          initialItem={editingItem} // 編集対象のアイテムを渡す (新規の場合は null)
        />
      )}
    </div>
  );
}
