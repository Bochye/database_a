'use client';



import React, { useState, useEffect } from 'react';

import styles from './edititems.module.css'; // CSSモジュールをインポート



// ダッシュボードコンポーネントのItem型に合うように、

// サーバーから返されるデータの一部をマッピングするための型を定義

export interface ClientItem {

  id: number;

  code: string; // assetCode

  name: string;

  modelNumber?: string;

  // imageUrl?: string; <--- 削除

  acquisitionAt: string | null; // acquisitionDate

  disposalAt?: string | null; // disposalDate

  value?: number | null; // acquisitionCost

  manager?: string;

  location?: string;

  status: string;

  ownerId: string; // ownerid

  createdAt: string;

  stock?: number; // サーバー側で使われる在庫数

}



interface EditItemsProps {

  onClose: () => void;

  // 新規追加と更新の両方の結果を扱うため、onSave に変更

  onSave: (savedItem: ClientItem) => void;

  ownerId: string;

  // 編集対象のアイテム（新規作成の場合は null）

  initialItem: ClientItem | null;

}



// フォームの初期状態（クライアント側のItemプロパティと、APIで使用するstockをベースに）

const initialFormState = {

  id: undefined as number | undefined, // 編集時にのみ使用

  code: '', // assetCode

  name: '',

  modelNumber: '',

  acquisitionAt: '', // acquisitionDate

  disposalAt: '', // disposalDate

  value: undefined as number | undefined, // acquisitionCost

  manager: '',

  location: '',

  status: 'USED',

  stock: 1, // APIで使われる

};



type FormState = typeof initialFormState;



// Utility to format date string to YYYY-MM-DD for input[type="date"]

const formatDateForInput = (dateString: string | null | undefined): string => {

  if (!dateString) return '';

  try {

    // サーバーから渡されるISO文字列をDateオブジェクトに変換

    const date = new Date(dateString);

    // YYYY-MM-DD 形式に整形

    return date.toISOString().split('T')[0];

  } catch {

    return '';

  }

};



export default function EditItems({ onClose, onSave, ownerId, initialItem }: EditItemsProps) {

  const [formData, setFormData] = useState<FormState>(initialFormState);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const isEditing = !!initialItem;

  const modalTitle = isEditing ? '資産情報の編集' : '新規資産の追加';

  // actionText を handleSubmit の外で定義し、JSXで利用できるようにする

  const actionText = isEditing ? '更新' : '追加';





  // initialItem が変更されたらフォームを初期化

  useEffect(() => {

    if (initialItem) {

      setFormData({

        id: initialItem.id,

        // ★ 修正: code, name, modelNumber, manager, location は null の場合に空文字列 '' を使用

        code: initialItem.code || '',

        name: initialItem.name || '',

        modelNumber: initialItem.modelNumber || '',

        // 日付はYYYY-MM-DD形式に変換

        acquisitionAt: formatDateForInput(initialItem.acquisitionAt),

        disposalAt: formatDateForInput(initialItem.disposalAt),

        // valueはnullまたはundefinedの場合は undefined (フォームinputに空文字を表示させるため)

        value: initialItem.value ?? undefined,

        manager: initialItem.manager || '',

        location: initialItem.location || '',

        status: initialItem.status,

        stock: initialItem.stock ?? 1, // stockがなければデフォルト1

      });

    } else {

        // 新規作成の場合は初期状態に戻す

        setFormData(initialFormState);

    }

  }, [initialItem]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {

    const { name, value, type } = e.target;

    setFormData((prev) => ({

      ...prev,

      // 数値型の場合は、空文字列を undefined に変換

      [name]: type === 'number'

        ? (value ? Number(value) : undefined)

        : value,

    }));

  };



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setIsLoading(true);

    setError(null);



    // 必須チェック

    if (!formData.code || !formData.name) {

      setError('資産コードと資産名は必須です。');

      setIsLoading(false);

      return;

    }



    // サーバーのAPIエンドポイントに必要な形式にデータをマッピング

    const payload = {

      // 編集の場合はIDを含める

      ...(isEditing && { id: formData.id }),

      assetCode: formData.code,

      name: formData.name,

      modelNumber: formData.modelNumber || undefined,

      acquisitionDate: formData.acquisitionAt || undefined,

      disposalDate: formData.disposalAt || undefined,

      acquisitionCost: formData.value,

      manager: formData.manager || undefined,

      location: formData.location || undefined,

      status: formData.status,

      stock: formData.stock,

      ownerid: ownerId, // propsから渡されたIDを使用

    };

   

    // 編集ならPUT, 新規作成ならPOST

    const method = isEditing ? 'PUT' : 'POST';

    // actionText は既にコンポーネントスコープで定義されているため、ここでは再定義しない

    // const actionText = isEditing ? '更新' : '追加';



    try {

      const res = await fetch('/api/items', {

        method: method,

        headers: {

          'Content-Type': 'application/json',

        },

        body: JSON.stringify(payload),

      });



      if (!res.ok) {

        const errData = await res.json();

        // actionText はコンポーネントスコープから参照できる

        throw new Error(errData.error || `資産の${actionText}に失敗しました。`);

      }



      const { item: serverItem } = await res.json();



      // サーバーからのレスポンスをクライアントのItem型にマッピング

      const clientItem: ClientItem = {

        id: serverItem.id,

        code: serverItem.assetCode, // マッピング

        name: serverItem.name,

        modelNumber: serverItem.modelNumber,

        // imageUrl: serverItem.imageUrl, <--- 削除

        acquisitionAt: serverItem.acquisitionDate, // マッピング

        disposalAt: serverItem.disposalDate, // マッピング

        value: serverItem.acquisitionCost, // マッピング

        manager: serverItem.manager,

        location: serverItem.location,

        status: serverItem.status,

        ownerId: serverItem.ownerid, // マッピング

        createdAt: serverItem.createdAt,

        stock: serverItem.stock,

      };



      onSave(clientItem); // 成功したら親コンポーネントに通知 (onAdded/onUpdatedとして機能)

      onClose(); // モーダルを閉じる

    } catch (err: any) {

      console.error(`Error ${actionText} item:`, err);

      // actionText はコンポーネントスコープから参照できる

      setError(err.message || '予期せぬエラーが発生しました。');

    } finally {

      setIsLoading(false);

    }

  };



  return (

    // モーダルオーバーレイ

    <div className={styles.modalOverlay}>

      {/* モーダルコンテナ */}

      <div className={styles.modalContainer}>

        {/* ヘッダー */}

        <div className={styles.modalHeader}>

          <h2 className={styles.modalTitle}>

            {/* SaveIconを削除 */}

            {modalTitle} {/* タイトルを動的に変更 */}

          </h2>

          <button

            onClick={onClose}

            className={styles.closeButton}

            aria-label="閉じる"

            disabled={isLoading} // 処理中は閉じられないようにする

          >

            {/* XIconを削除 */}

            X

          </button>

        </div>



        {/* フォーム本体 */}

        <form onSubmit={handleSubmit} className={styles.formBody}>

          {error && (

            <div className={styles.errorMessage}>

              {error}

            </div>

          )}



          {/* フォームフィールド */}

          <div className={styles.formGrid}>

           

            {/* 資産コード */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>資産コード <span className={styles.requiredStar}>*</span></span>

              <input

                type="text"

                name="code"

                value={formData.code}

                onChange={handleChange}

                required

                className={styles.inputField}

              />

            </label>



            {/* 資産名 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>資産名 <span className={styles.requiredStar}>*</span></span>

              <input

                type="text"

                name="name"

                value={formData.name}

                onChange={handleChange}

                required

                className={styles.inputField}

              />

            </label>



            {/* 型式 (モデルナンバー) */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>型式 (Model No.)</span>

              <input

                type="text"

                name="modelNumber"

                value={formData.modelNumber}

                onChange={handleChange}

                className={styles.inputField}

              />

            </label>



            {/* 取得年月日 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>取得年月日</span>

              <input

                type="date"

                name="acquisitionAt"

                value={formData.acquisitionAt}

                onChange={handleChange}

                className={styles.inputField}

              />

            </label>



            {/* 取得価額 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>取得価額 (円)</span>

              <input

                type="number"

                name="value"

                // undefined の場合は空文字を表示

                value={formData.value === undefined ? '' : formData.value}

                onChange={handleChange}

                min="0"

                className={styles.inputField}

              />

            </label>



            {/* 在庫数 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>在庫数</span>

              <input

                type="number"

                name="stock"

                value={formData.stock}

                onChange={handleChange}

                min="1"

                required

                className={styles.inputField}

              />

            </label>



            {/* 管理者 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>管理者</span>

              <input

                type="text"

                name="manager"

                value={formData.manager}

                onChange={handleChange}

                className={styles.inputField}

              />

            </label>



            {/* 管理場所 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>管理場所</span>

              <input

                type="text"

                name="location"

                value={formData.location}

                onChange={handleChange}

                className={styles.inputField}

              />

            </label>

           

            {/* 状態 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>状態</span>

              <select

                name="status"

                value={formData.status}

                onChange={handleChange}

                className={`${styles.inputField} ${styles.selectField}`}

              >

                <option value="USED">使用中 (USED)</option>

                <option value="UNUSED">未使用 (UNUSED)</option>

                <option value="UNKNOWN">不明 (UNKNOWN)</option>

                <option value="DISPOSED">除却 (DISPOSED)</option>

              </select>

            </label>



            {/* 廃棄年月日 */}

            <label className={styles.formLabel}>

              <span className={styles.labelText}>廃棄年月日</span>

              <input

                type="date"

                name="disposalAt"

                value={formData.disposalAt}

                onChange={handleChange}

                className={styles.inputField}

              />

            </label>



          </div>



          {/* フッターとボタン */}

          <div className={styles.buttonContainer}>

            <button

              type="button"

              onClick={onClose}

              className={`${styles.button} ${styles.cancelButton} ${isLoading ? styles.disabled : ''}`}

              disabled={isLoading}

            >

              キャンセル

            </button>

            <button

              type="submit"

              className={`${styles.button} ${styles.saveButton} ${isLoading ? styles.disabled : ''}`}

              disabled={isLoading}

            >

              {isLoading ? (

                <>

                  {/* Loader2Iconを削除し、テキストのみ */}

                  {actionText}中... {/* actionText を使用 */}

                </>

              ) : (

                <>

                  {/* SaveIconを削除し、テキストのみ */}

                  {actionText} {/* actionText を使用 */}

                </>

              )}

            </button>

          </div>

        </form>

      </div>

      </div>

  );

}

