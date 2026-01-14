'use client';

import React, { useState, useEffect } from 'react';
import styles from './edititems.module.css';
// 自動生成関数をインポート（パスは環境に合わせて調整してください）
import { generateAssetCode } from '../app/api/utils/generateAssetCode';

export interface ClientItem {
  id: number;
  code: string;
  name: string;
  modelNumber?: string;
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

interface EditItemsProps {
  onClose: () => void;
  onSave: (savedItem: ClientItem) => void;
  ownerId: string;
  initialItem: ClientItem | null;
}

const initialFormState = {
  id: undefined as number | undefined,
  code: '',
  name: '',
  modelNumber: '',
  acquisitionAt: '',
  disposalAt: '',
  value: undefined as number | undefined,
  manager: '',
  location: '',
  status: 'USED',
  stock: 1,
};

type FormState = typeof initialFormState;

const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export default function EditItems({ onClose, onSave, ownerId, initialItem }: EditItemsProps) {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 手動入力を有効にするかどうかのフラグ
  const [isManualCode, setIsManualCode] = useState(false);

  const isEditing = !!initialItem;
  const modalTitle = isEditing ? '資産情報の編集' : '新規資産の追加';
  const actionText = isEditing ? '更新' : '追加';

  useEffect(() => {
    if (initialItem) {
      setFormData({
        id: initialItem.id,
        code: initialItem.code || '',
        name: initialItem.name || '',
        modelNumber: initialItem.modelNumber || '',
        acquisitionAt: formatDateForInput(initialItem.acquisitionAt),
        disposalAt: formatDateForInput(initialItem.disposalAt),
        value: initialItem.value ?? undefined,
        manager: initialItem.manager || '',
        location: initialItem.location || '',
        status: initialItem.status,
        stock: initialItem.stock ?? 1,
      });
      setIsManualCode(true); // 編集時は既存コードがあるため手動モード
    } else {
      setFormData(initialFormState);
      setIsManualCode(false); // 新規時はデフォルト自動生成
    }
  }, [initialItem]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number'
        ? (value ? Number(value) : undefined)
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 基本バリデーション
    if (!formData.name) {
      setError('資産名は必須です。');
      setIsLoading(false);
      return;
    }

    if ((isEditing || isManualCode) && !formData.code) {
      setError('資産コードを入力してください。');
      setIsLoading(false);
      return;
    }

    try {
      // 1. 管理者の存在チェック
      if (formData.manager) {
        const checkRes = await fetch(`/api/accounts?userid=${formData.manager}`);
        const checkData = await checkRes.json();
        const userExists = checkData.accounts?.some((u: any) => u.userid === formData.manager);
        
        if (!userExists) {
          throw new Error(`管理者「${formData.manager}」は登録されていません。`);
        }
      }

      // 2. 資産コードの決定
      let finalAssetCode = formData.code;
      if (!isEditing && !isManualCode) {
        // 自動生成モード
        const baseDate = formData.acquisitionAt || new Date().toISOString();
        const tempId = Math.floor(Math.random() * 99999); 
        finalAssetCode = generateAssetCode(baseDate, tempId);
      }

      // 3. ペイロード作成
      const payload = {
        ...(isEditing && { id: formData.id }),
        assetCode: finalAssetCode,
        name: formData.name,
        modelNumber: formData.modelNumber || undefined,
        acquisitionDate: formData.acquisitionAt || undefined,
        disposalDate: formData.disposalAt || undefined,
        acquisitionCost: formData.value,
        manager: formData.manager || undefined,
        location: formData.location || undefined,
        status: formData.status,
        stock: formData.stock,
        ownerid: ownerId,
      };

      // 4. API送信
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/items', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `資産の${actionText}に失敗しました。`);
      }

      const { item: serverItem } = await res.json();
      
      // クライアント側へ返す型へ整形
      const clientItem: ClientItem = {
        id: serverItem.id,
        code: serverItem.assetCode,
        name: serverItem.name,
        modelNumber: serverItem.modelNumber,
        acquisitionAt: serverItem.acquisitionDate,
        disposalAt: serverItem.disposalDate,
        value: serverItem.acquisitionCost,
        manager: serverItem.manager,
        location: serverItem.location,
        status: serverItem.status,
        ownerId: serverItem.ownerid,
        createdAt: serverItem.createdAt,
        stock: serverItem.stock,
      };

      onSave(clientItem);
      onClose();
    } catch (err: any) {
      setError(err.message || '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{modalTitle}</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="閉じる" disabled={isLoading}>X</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGrid}>
            {/* 資産コード・自動生成セクション */}
            <div className={styles.assetCodeContainer}>
              <label className={styles.labelText}>
                資産コード <span className={styles.requiredStar}>*</span>
              </label>
              <input 
                type="text" 
                name="code" 
                value={(!isEditing && !isManualCode) ? '保存時に自動生成されます' : formData.code} 
                onChange={handleChange} 
                readOnly={!isManualCode && !isEditing} 
                className={`${styles.inputField} ${(!isManualCode && !isEditing) ? styles.autoGeneratedInput : ''}`} 
                placeholder={isManualCode ? "資産コードを入力" : ""}
              />
              {!isEditing && (
                <label className={styles.manualCheckLabel}>
                  <input 
                    type="checkbox" 
                    checked={isManualCode} 
                    onChange={(e) => setIsManualCode(e.target.checked)} 
                  />
                  <span>手動で入力する</span>
                </label>
              )}
            </div>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>資産名 <span className={styles.requiredStar}>*</span></span>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>型式</span>
              <input type="text" name="modelNumber" value={formData.modelNumber} onChange={handleChange} className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>取得年月日</span>
              <input type="date" name="acquisitionAt" value={formData.acquisitionAt} onChange={handleChange} className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>取得価額 (円)</span>
              <input type="number" name="value" value={formData.value === undefined ? '' : formData.value} onChange={handleChange} min="0" className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>在庫数</span>
              <input type="number" name="stock" value={formData.stock} onChange={handleChange} min="1" required className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>管理者</span>
              <input 
                type="text" 
                name="manager" 
                value={formData.manager} 
                onChange={handleChange} 
                className={styles.inputField} 
                placeholder="登録済みのユーザーID"
              />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>管理場所</span>
              <input type="text" name="location" value={formData.location} onChange={handleChange} className={styles.inputField} />
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>状態</span>
              <select name="status" value={formData.status} onChange={handleChange} className={`${styles.inputField} ${styles.selectField}`}>
                <option value="USED">使用中 (USED)</option>
                <option value="UNUSED">未使用 (UNUSED)</option>
                <option value="UNKNOWN">不明 (UNKNOWN)</option>
                <option value="DISPOSED">除却 (DISPOSED)</option>
              </select>
            </label>

            <label className={styles.formLabel}>
              <span className={styles.labelText}>廃棄年月日</span>
              <input type="date" name="disposalAt" value={formData.disposalAt} onChange={handleChange} className={styles.inputField} />
            </label>
          </div>

          <div className={styles.buttonContainer}>
            <button type="button" onClick={onClose} className={`${styles.button} ${styles.cancelButton}`} disabled={isLoading}>
              キャンセル
            </button>
            <button type="submit" className={`${styles.button} ${styles.saveButton}`} disabled={isLoading}>
              {isLoading ? `${actionText}中...` : actionText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}