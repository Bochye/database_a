'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import EditItems, { ClientItem } from '../../components/edititems';
import SearchBar from '../../components/searchbar';
import InlineActions from '../../components/inlineactions';
import TransferModal from '../../components/transfermodal';
import RequestModal from '../../components/requestmodal';
import Inventory from '../../components/inventory';
import AdminRequests from '../../components/adminrequests';
import AdminUsers from '../../components/adminusers';
import InventoryAdmin from '../../components/InventoryAdmin';
import InventoryUser from '../../components/InventoryUser';

interface ItemRow {
  id: number;
  assetCode: string;
  name: string;
  modelNumber?: string | null;
  acquisitionDate?: string | null;
  disposalDate?: string | null;
  acquisitionCost?: number | null;
  manager?: string | null;
  location?: string | null;
  status: string;
  ownerid: string;
  createdAt: string;
  stock?: number;
}

type TabKey = 'ITEMS' | 'INVENTORY' | 'REQUESTS' | 'USERS';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClientItem | null>(null);

  const [user, setUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('ITEMS');

  const [transferTarget, setTransferTarget] = useState<ItemRow | null>(null);
  const [requestTarget, setRequestTarget] = useState<ItemRow | null>(null);

  const router = useRouter();

  const handleOpenModal = (itemToEdit: ItemRow | null) => {
    if (itemToEdit) {
      const client: ClientItem = {
        id: itemToEdit.id,
        code: itemToEdit.assetCode,
        name: itemToEdit.name,
        modelNumber: itemToEdit.modelNumber || undefined,
        acquisitionAt: itemToEdit.acquisitionDate || null,
        disposalAt: itemToEdit.disposalDate || null,
        value: itemToEdit.acquisitionCost ?? null,
        manager: itemToEdit.manager || undefined,
        location: itemToEdit.location || undefined,
        status: itemToEdit.status,
        ownerId: itemToEdit.ownerid,
        createdAt: itemToEdit.createdAt,
        stock: itemToEdit.stock ?? 1,
      };
      setEditingItem(client);
    } else {
      setEditingItem(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingItem(null);
    setIsModalOpen(false);
  };

  const handleSave = useCallback((savedItem: ClientItem) => {
    setItems(prevItems => {
      const idx = prevItems.findIndex(i => i.id === savedItem.id);
      const mapped: ItemRow = {
        id: savedItem.id,
        assetCode: savedItem.code,
        name: savedItem.name,
        modelNumber: savedItem.modelNumber,
        acquisitionDate: savedItem.acquisitionAt,
        disposalDate: savedItem.disposalAt,
        acquisitionCost: savedItem.value ?? null,
        manager: savedItem.manager,
        location: savedItem.location,
        status: savedItem.status,
        ownerid: savedItem.ownerId,
        createdAt: savedItem.createdAt,
        stock: savedItem.stock,
      };
      if (idx !== -1) {
        const arr = [...prevItems];
        arr[idx] = mapped;
        return arr;
      } else {
        return [mapped, ...prevItems];
      }
    });
  }, []);

  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUser');
    const adminFlag = localStorage.getItem('isAdmin') === 'true';
    if (!loggedInUser) {
      router.push('/login');
    } else {
      setUser(loggedInUser);
      setIsAdmin(adminFlag);
    }
  }, [router]);

  const fetchItems = async (q = '', status = '', onlyMine = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (onlyMine) {
        params.set('onlyMine', 'true');
        if (user) params.set('ownerId', user);
      }
      const res = await fetch(`/api/items?${params.toString()}`);
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

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isAdmin');
    router.push('/login');
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const deleteItem = async (id: number) => {
    if (!confirm('この資産を削除しますか？')) return;
    const res = await fetch(`/api/items?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      alert('削除に失敗しました');
    }
  };

  if (!user) return <p>ログイン状態を確認中...</p>;

  return (
    <div className={styles.dashboardmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>資産管理ダッシュボード</h1>
      </header>

      <div className={styles.menues}>
        <div className={styles.yourelogin}>
          ログイン中<br />{user}
        </div>
        <div className={styles.tabs}>
          <button className={tab === 'ITEMS' ? styles.activeTab : styles.tab} onClick={() => setTab('ITEMS')}>資産</button>
          <button className={tab === 'INVENTORY' ? styles.activeTab : styles.tab} onClick={() => setTab('INVENTORY')}>棚卸し</button>
          <button className={tab === 'REQUESTS' ? styles.activeTab : styles.tab} onClick={() => setTab('REQUESTS')}>申請</button>
          {isAdmin && <button className={tab === 'USERS' ? styles.activeTab : styles.tab} onClick={() => setTab('USERS')}>ユーザー</button>}
        </div>
        <button className={styles.logoutButton} onClick={handleLogout}>
          ログアウト
        </button>
      </div>

      <main>
        {tab === 'ITEMS' && (
          <>
            <div className={styles.actionsRow}>
              <button onClick={() => handleOpenModal(null)} className={styles.addButton}>新規資産を追加</button>
            </div>

            <SearchBar onSearch={(q, s, mine) => fetchItems(q, s, mine)} />

            {isLoading && <p>データを読み込み中...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!isLoading && !error && (
              <div className={styles.tableContainer}>
                {items.length > 0 ? (
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>ID</th><th>資産コード</th><th>資産名</th><th>型式</th><th>取得年月日</th>
                        <th>廃棄年月日</th><th>取得価額</th><th>管理者</th><th>管理場所</th><th>状態</th>
                        <th>所有者ID</th><th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id.toString().padStart(6, '0')}</td>
                          <td>{item.assetCode || '-'}</td>
                          <td>{item.name || '-'}</td>
                          <td>{item.modelNumber || '-'}</td>
                          <td>{item.acquisitionDate ? formatDate(item.acquisitionDate) : '-'}</td>
                          <td>{item.disposalDate ? formatDate(item.disposalDate) : '-'}</td>
                          <td>{item.acquisitionCost != null ? `${item.acquisitionCost.toLocaleString()}円` : '-'}</td>
                          <td>{item.manager || '-'}</td>
                          <td>{item.location || '-'}</td>
                          <td>{item.status || '-'}</td>
                          <td>{item.ownerid || '-'}</td>
                          <td className={styles.actionCell}>
                            <div className={styles.actionButtons}>
                              <button onClick={() => handleOpenModal(item)} className={styles.editButton}>編集</button>
                              <button onClick={() => setTransferTarget(item)} className={styles.secondaryButton}>引継ぎ</button>
                              <button onClick={() => setRequestTarget(item)} className={styles.secondaryButton}>申請</button>
                              {isAdmin && (
                                <button onClick={() => deleteItem(item.id)} className={styles.deleteButton}>削除</button>
                              )}
                            </div>
                            <InlineActions
                              itemId={item.id}
                              currentStatus={item.status}
                              currentLocation={item.location}
                              onUpdated={() => fetchItems()}
                            />
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
          </>
        )}

        {tab === 'INVENTORY' && (
          isAdmin ? <InventoryAdmin /> : <InventoryUser ownerId={user!} />
        )}

        {tab === 'REQUESTS' && (
          <>
            {!isAdmin ? (
              <p>「資産」タブから対象資産の「申請」ボタンで申請を作成できます。</p>
            ) : (
              <AdminRequests />
            )}
          </>
        )}

        {tab === 'USERS' && isAdmin && (
          <AdminUsers />
        )}
      </main>

      {isModalOpen && (
        <EditItems
          onClose={handleCloseModal}
          onSave={handleSave}
          ownerId={user!}
          initialItem={editingItem}
        />
      )}

      {transferTarget && (
        <TransferModal
          itemId={transferTarget.id}
          currentManager={transferTarget.manager}
          currentOwnerId={transferTarget.ownerid}
          onClose={() => setTransferTarget(null)}
          onUpdated={() => fetchItems()}
        />
      )}

      {requestTarget && (
        <RequestModal
          itemId={requestTarget.id}
          requesterId={user!}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => {}}
        />
      )}
    </div>
  );
}