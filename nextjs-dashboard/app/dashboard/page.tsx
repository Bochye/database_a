'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { apiFetch, ApiError } from '../utils/apiClient';

import EditItems, { ClientItem } from '../../components/edititems';
import SearchBar, { SearchFilters } from '../../components/searchbar';
import TransferModal from '../../components/transfermodal';
import RequestModal from '../../components/requestmodal';
import AdminRequests from '../../components/adminrequests';
import UserRequests from '../../components/userrequests';
import AdminUsers from '../../components/adminusers';
import InventoryAdmin from '../../components/InventoryAdmin';
import Inventory from '../../components/inventory';

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
  updatedAt?: string | null;
  updatedBy?: string | null;
  department?: string | null;
  stock?: number;
}

type TabKey = 'ITEMS' | 'INVENTORY' | 'REQUESTS' | 'USERS';
type DisplayMode = 'SIMPLE' | 'DETAIL';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClientItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('ITEMS'); // 初期値
  const [transferTarget, setTransferTarget] = useState<ItemRow | null>(null);
  const [requestTarget, setRequestTarget] = useState<ItemRow | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('SIMPLE');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const router = useRouter();

  // ログアウト時にタブ情報もクリアする
  const performLogout = useCallback(async () => {
    try {
      const res = await fetch('/api/search_user', { method: 'DELETE' });
      if (!res.ok) throw new Error('Logout failed');
    } catch {
      alert('ログアウトに失敗しました。もう一度お試しください。');
      return;
    }
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('activeTab');
    router.push('/login');
  }, [router]);

  const fetchItems = useCallback(async (filters: SearchFilters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = localStorage.getItem('loggedInUser');
      const adminFlag = localStorage.getItem('isAdmin') === 'true';

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      
      params.set('isAdmin', adminFlag ? 'true' : 'false');
      if (loggedInUser) {
        params.set('currentUser', loggedInUser);
      }

      const data = await apiFetch<{ items: ItemRow[] }>(`/api/items?${params.toString()}`, {
        fallbackMessage: '資産データの取得に失敗しました。',
      });
      setItems(data.items);
      setCurrentFilters(filters);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        performLogout();
        return;
      }
      // 取得に失敗したことを「0件」と誤認させないため、一覧を空にせず理由を表示する。
      setError(err instanceof ApiError ? err.message : '資産データの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [performLogout]);

  // タブの状態を復元
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') as TabKey;
    if (savedTab) {
      // 非管理者がUSERSタブを開こうとした場合のガード
      const adminFlag = localStorage.getItem('isAdmin') === 'true';
      if (savedTab === 'USERS' && !adminFlag) {
        setTab('ITEMS');
      } else {
        setTab(savedTab);
      }
    }
  }, []);

  // タブが変更されたらlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('activeTab', tab);
  }, [tab]);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const res = await fetch('/api/search_user', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          setUser(null);
          localStorage.removeItem('loggedInUser');
          localStorage.removeItem('isAdmin');
          localStorage.removeItem('activeTab');
          router.push('/login');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        localStorage.setItem('loggedInUser', data.userid);
        localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');
        setUser(data.userid);
        setIsAdmin(data.isAdmin);
        if (!data.isAdmin) setTab(current => current === 'USERS' ? 'ITEMS' : current);
      } catch (err) {
        console.error('ユーザー確認エラー:', err);
      }
    };

    checkUserStatus();
    const intervalId = setInterval(() => {
      checkUserStatus();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [router, performLogout]);

  useEffect(() => {
    if (user) fetchItems({ onlyMine: !isAdmin });
  }, [user, isAdmin, fetchItems]);

  const handleReload = useCallback(() => fetchItems(currentFilters), [fetchItems, currentFilters]);

  // 削除は結果を確認してから再読み込みする。失敗した場合は理由を伝える。
  const handleDelete = useCallback(async (item: ItemRow) => {
    if (!confirm(`資産「${item.name}」を削除しますか？`)) return;
    try {
      await apiFetch(`/api/items?id=${item.id}`, {
        method: 'DELETE',
        fallbackMessage: '資産の削除に失敗しました。',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '資産の削除に失敗しました。';
      alert(`${message}${err instanceof ApiError && err.retryable ? '\n\nもう一度お試しください。' : ''}`);
      handleReload();
      return;
    }
    handleReload();
  }, [handleReload]);

  const handleSave = useCallback(() => {
    handleReload();
    setIsModalOpen(false);
    setEditingItem(null);
  }, [handleReload]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'USED': return '使用中';
      case 'UNUSED': return '未使用';
      case 'UNKNOWN': return '不明';
      case 'DISPOSED': return '除却';
      default: return status;
    }
  };

  if (!user) return <p>ログイン状態を確認中...</p>;

  return (
    <div className={styles.dashboardmain}>
      <header className={styles.header}>
        <h1 className={styles.header_title}>資産管理ダッシュボード</h1>
      </header>

      <button className={styles.menuToggleButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
        {isMenuOpen ? '✕' : '☰'}
      </button>
      {isMenuOpen && <div className={styles.overlay} onClick={() => setIsMenuOpen(false)} />}

      <div className={`${styles.menues} ${isMenuOpen ? styles.menuOpen : ''}`}>
        <div className={styles.userInfoWrapper} style={{ 
          marginTop: '40px', 
          padding: '15px 10px', 
          width: '90%', 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          borderRadius: '4px',
          textAlign: 'center' 
        }}>
          <div style={{ color: '#fff', fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>ログイン中</div>
          <div style={{ 
            color: '#fff', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '10px',
            wordBreak: 'break-all' 
          }}>
            {user}
          </div>
          
          <span className={styles.statusLabel} style={{ 
            background: isAdmin ? '#ffebeb' : '#eef2f8', 
            color: isAdmin ? '#d32f2f' : '#4a6fa5',
            fontSize: '11px',
            padding: '3px 10px',
            fontWeight: 'bold',
            borderRadius: '12px',
            display: 'inline-block'
          }}>
            {isAdmin ? '管理者' : '一般ユーザー'}
          </span>
        </div>

        <div className={styles.tabs} style={{ marginTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button className={tab === 'ITEMS' ? styles.activeTab : styles.tab} onClick={() => { setTab('ITEMS'); setIsMenuOpen(false); }}>資産</button>
          <button className={tab === 'INVENTORY' ? styles.activeTab : styles.tab} onClick={() => { setTab('INVENTORY'); setIsMenuOpen(false); }}>棚卸し</button>
          <button className={tab === 'REQUESTS' ? styles.activeTab : styles.tab} onClick={() => { setTab('REQUESTS'); setIsMenuOpen(false); }}>{isAdmin ? '申請' : '申請履歴'}</button>
          {isAdmin && (
            <button className={tab === 'USERS' ? styles.activeTab : styles.tab} onClick={() => { setTab('USERS'); setIsMenuOpen(false); }}>ユーザー</button>
          )}
        </div>
        <button className={styles.logoutButton} onClick={performLogout}>ログアウト</button>
      </div>

      <main>
        {tab === 'ITEMS' && (
          <>
            <SearchBar key={searchKey} isAdmin={isAdmin} onSearch={(filters) => fetchItems(filters)} />
            <div className={styles.tableActions}>
              <div /> 
              <div className={styles.centerGroup}>
                <div className={styles.modeSwitcher}>
                  <button className={displayMode === 'SIMPLE' ? styles.modeActive : styles.modeBtn} onClick={() => setDisplayMode('SIMPLE')}>簡易表示</button>
                  <button className={displayMode === 'DETAIL' ? styles.modeActive : styles.modeBtn} onClick={() => setDisplayMode('DETAIL')}>詳細表示</button>
                </div>
                <button className={styles.reloadButton} onClick={handleReload} disabled={isLoading}>↻ 更新</button>
                <button className={styles.resetButton} onClick={() => { setSearchKey(k => k+1); fetchItems({onlyMine: !isAdmin}); }}>リセット</button>
              </div>
              <div className={styles.rightAction}>
                {isAdmin && <button onClick={() => setIsModalOpen(true)} className={styles.addButton}>新規資産の追加</button>}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  margin: '0 0 12px', padding: '12px 16px', borderRadius: '6px',
                  border: '1px solid #f5c2c7', background: '#fdf2f3', color: '#b02a37',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </span>
                <button onClick={handleReload} disabled={isLoading} className={styles.reloadButton}>再試行</button>
              </div>
            )}

            <div className={styles.tableContainer}>
              {isLoading && <div className={styles.tableInlineLoader}>読み込み中...</div>}
              <table className={`${styles.itemsTable} ${isLoading ? styles.loadingEffect : ''}`}>
                <thead>
                  <tr>
                    {displayMode === 'DETAIL' && (<><th>ID</th><th>資産コード</th></>)}
                    <th>資産名</th><th>型式</th><th>取得年月日</th>
                    <th>使用者</th><th>管理場所</th><th>状態</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} onClick={() => !isLoading && setSelectedItem(item)} className={styles.clickableRow}>
                      {displayMode === 'DETAIL' && (<><td>{item.id.toString().padStart(6, '0')}</td><td>{item.assetCode || '-'}</td></>)}
                      <td className={styles.nameCell}>{item.name}</td>
                      <td>{item.modelNumber || '-'}</td>
                      <td>{formatDate(item.acquisitionDate)}</td>
                      <td>{item.manager || '-'}</td>
                      <td>{item.location || '-'}</td>
                      <td><span className={styles.statusLabel}>{getStatusLabel(item.status)}</span></td>
                      <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionButtons}>
                          {isAdmin ? (
                            <>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem({
                                  ...item, code: item.assetCode, acquisitionAt: item.acquisitionDate, disposalAt: item.disposalDate,
                                  value: item.acquisitionCost, ownerId: item.ownerid, createdAt: item.createdAt
                                } as any); 
                                setIsModalOpen(true);
                              }} className={styles.editButton}>編集</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTransferTarget(item); }}
                                className={styles.secondaryButton}
                                disabled={item.status === 'DISPOSED'}
                                style={item.status === 'DISPOSED' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                引継ぎ
                              </button>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item);
                              }} className={styles.deleteButton}>削除</button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setRequestTarget(item); }}
                              className={styles.requestButton}
                              disabled={item.status === 'DISPOSED'}
                              style={item.status === 'DISPOSED' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              title={item.status === 'DISPOSED' ? '除却済みの資産は申請できません' : ''}
                            >
                              申請
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'INVENTORY' && (
          <div className={styles.tabContent}>
            {isAdmin ? <InventoryAdmin /> : <Inventory ownerId={user!} />}
          </div>
        )}

        {tab === 'REQUESTS' && (
          <div className={styles.tabContent}>
            {isAdmin ? <AdminRequests /> : <UserRequests user={user!} />}
          </div>
        )}

        {tab === 'USERS' && isAdmin && (
          <div className={styles.tabContent}>
            <AdminUsers onUserUpdate={handleReload} />
          </div>
        )}
      </main>

      {selectedItem && (
        <div className={styles.modalOverlay} onClick={() => setSelectedItem(null)}>
          <div className={styles.infoCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoCardHeader}>
              <h3>備品詳細情報</h3>
              <button className={styles.closeX} onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className={styles.infoCardContent}>
              <div className={styles.infoRow}><label>ID</label><span>{selectedItem.id.toString().padStart(6, '0')}</span></div>
              <div className={styles.infoRow}><label>資産コード</label><span>{selectedItem.assetCode || '-'}</span></div>
              <div className={styles.infoRow}><label>資産名</label><span>{selectedItem.name}</span></div>
              <div className={styles.infoRow}><label>取得価額</label><span>{selectedItem.acquisitionCost?.toLocaleString()}円</span></div>
              <div className={styles.infoRow}><label>作成者</label><span>{selectedItem.ownerid || '-'}</span></div>
              <div className={styles.infoRow}><label>最終編集者</label><span>{selectedItem.updatedBy || '-'}</span></div>
              <div className={styles.infoRow}><label>最終更新日時</label><span>{formatDateTime(selectedItem.updatedAt)}</span></div>
            </div>
            <div className={styles.infoCardFooter}>
              <button className={styles.closeBtn} onClick={() => setSelectedItem(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && <EditItems onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSave={handleSave} ownerId={user!} initialItem={editingItem} />}
      {transferTarget && <TransferModal itemId={transferTarget.id} currentManager={transferTarget.manager} expectedUpdatedAt={transferTarget.updatedAt} onClose={() => setTransferTarget(null)} onUpdated={handleReload} userId={user!} />}
      {requestTarget && <RequestModal itemId={requestTarget.id} requesterId={user!} onClose={() => setRequestTarget(null)} onSubmitted={() => {}} />}
    </div>
  );
}