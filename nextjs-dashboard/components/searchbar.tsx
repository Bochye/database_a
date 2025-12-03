'use client';

import React, { useState } from 'react';
import styles from './searchbar.module.css';

interface Props {
  onSearch: (q: string, status: string, onlyMine: boolean) => void;
  initialQuery?: string;
}

export default function SearchBar({ onSearch, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  return (
    <div className={styles.container}>
      <input
        className={styles.input}
        placeholder="コード/名称/場所/管理者で検索"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className={styles.select}
        value={status}
        onChange={e => setStatus(e.target.value)}
      >
        <option value="">全ての状態</option>
        <option value="USED">使用中</option>
        <option value="UNUSED">未使用</option>
        <option value="UNKNOWN">不明</option>
        <option value="DISPOSED">除却</option>
      </select>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={() => setOnlyMine(!onlyMine)}
        />
        自分の資産のみ
      </label>
      <button
        className={styles.button}
        onClick={() => onSearch(q, status, onlyMine)}
      >
        検索
      </button>
    </div>
  );
}