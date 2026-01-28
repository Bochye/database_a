export function generateAssetCode(
  acquisitionDate: string,
  id: number
): string {
  const date = new Date(acquisitionDate);

  const year = date.getFullYear(); // 取得年
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const random3 = Math.floor(100 + Math.random() * 900); // 100–999
  const random1 = Math.floor(Math.random() * 10);        // 0–9
  const id5 = String(id).padStart(5, '0');               // 5桁

  return `2${year}-${random3}${id5}-${month}${day}${random1}`;
}
