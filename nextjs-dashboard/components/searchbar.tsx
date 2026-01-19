'use client';

import React, { useState } from 'react';
import styles from './searchbar.module.css';

interface Props {
  onSearch: (filters: SearchFilters) => void;
  isAdmin: boolean;
}

export interface SearchFilters {
  assetCode?: string;    // ★ ? を追加
  name?: string;         // ★ ? を追加
  modelNumber?: string;  // ★ ? を追加
  manager?: string;      // ★ ? を追加
  location?: string;     // ★ ? を追加
  department?: string;   // ★ ? を追加
  status?: string;       // ★ ? を追加
  onlyMine?: boolean;    // ★ ? を追加
}

export default function SearchBar({ onSearch, isAdmin }: Props) {
  // ページ側のkeyが更新されると、このuseStateも初期値に戻る
  const [filters, setFilters] = useState<SearchFilters>({
    assetCode: '',
    name: '',
    modelNumber: '',
    manager: '',
    location: '',
    department: '',
    status: '',
    onlyMine: !isAdmin,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFilters(prev => ({ ...prev, [name]: val }));
  };

  const handleSearch = () => {
    onSearch({ ...filters, onlyMine: isAdmin ? filters.onlyMine : true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputGroup}>
        <input name="assetCode" className={styles.input} placeholder="資産コード" value={filters.assetCode} onChange={handleChange} onKeyDown={handleKeyDown} />
        <input name="name" className={styles.input} placeholder="資産名" value={filters.name} onChange={handleChange} onKeyDown={handleKeyDown} />
        <input name="modelNumber" className={styles.input} placeholder="型式名" value={filters.modelNumber} onChange={handleChange} onKeyDown={handleKeyDown} />
        <input name="manager" className={styles.input} placeholder="使用者名" value={filters.manager} onChange={handleChange} onKeyDown={handleKeyDown} />
        <input name="location" className={styles.input} placeholder="管理場所" value={filters.location} onChange={handleChange} onKeyDown={handleKeyDown} />
      </div>

      <div className={styles.filterGroup}>
        <select name="department" className={styles.select} value={filters.department} onChange={handleChange}>
          <option value="">全ての学科</option>
          <option value="AD">AD</option><option value="EE">EE</option><option value="ME">ME</option><option value="CS">CS</option>
        </select>

        <select name="status" className={styles.select} value={filters.status} onChange={handleChange}>
          <option value="">全ての状態</option>
          <option value="USED">使用中</option><option value="UNUSED">未使用</option><option value="UNKNOWN">不明</option><option value="DISPOSED">除却</option>
        </select>

        {isAdmin && (
          <label className={styles.checkboxLabel}>
            <input type="checkbox" name="onlyMine" checked={filters.onlyMine} onChange={handleChange} />
            自分の資産のみ
          </label>
        )}

        <button className={styles.button} onClick={handleSearch}>検索</button>
      </div>
    </div>
  );
}