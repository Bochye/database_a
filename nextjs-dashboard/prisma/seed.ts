import { PrismaClient, AssetStatus, Department } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('シードデータの投入を開始します...');

  // 1. アカウントデータの投入
  const accountData = [
    { userid: 'utsugi', isadmin: true },
    { userid: 'uchida', isadmin: true },
    { userid: 'sakai', isadmin: true },
    { userid: 'sushida', isadmin: false },
    { userid: 'shimakawa', isadmin: false },
  ];

  for (const acc of accountData) {
    await prisma.accounts.upsert({
      where: { id: accountData.indexOf(acc) + 1 }, // IDベースのシード
      update: {},
      create: {
        userid: acc.userid,
        password: '1234',
        isadmin: acc.isadmin,
        department: Department.CS,
      },
    });
  }

  // 2. 資産データの投入
const itemData = [
  { code: '22017-82900084-03194', name: 'パソコン', date: '2018/03/19', model: 'DELL Latitude 3490', stock: 3, manager: 'utsugi', loc: '403', owner: 'admin' },
  { code: '22017-82900084-04205', name: 'パソコン', date: '2018/04/20', model: 'DELL Latitude 3450', stock: 10, manager: 'utsugi', loc: '403', owner: 'admin' },
  { code: '22019-82900083-05177', name: '椅子', date: '2019/05/17', model: 'KOKUYO 667C-H', stock: 20, manager: 'utsugi', loc: '413', owner: 'admin' },
  { code: '22019-82900045-03220', name: '電圧計', date: '2019/08/25', model: 'YHQ-76TCY', stock: 5, manager: 'utsugi', loc: '414', owner: 'admin' },
  { code: '22019-82900105-04091', name: 'ICトレーナー', date: '2019/04/09', model: 'サンハヤトCT-311S', stock: 10, manager: 'utsugi', loc: '414', owner: 'admin' },
  { code: '22020-11400034-06072', name: 'パソコン', date: '2020/06/07', model: 'MacPro xx78', stock: 4, manager: 'utsugi', loc: '413', owner: 'admin' },
  { code: '22021-11400076-07054', name: 'ノートPC', date: '2021/07/05', model: 'MacBookPro xx89', stock: 3, manager: 'utsugi', loc: '413', owner: 'admin' },
  { code: '22023-82900103-10113', name: 'ディスプレイ', date: '2023/10/03', model: 'PHILIPS kh89-4', stock: 10, manager: 'utsugi', loc: '403', owner: 'admin' },
  { code: '22018-82900005-04034', name: 'プリンター', date: '2018/04/03', model: 'EPSON col-89bk', stock: 1, manager: 'sushida', loc: '404', owner: 'admin' },
  { code: '22019-82900034-05176', name: 'パソコン', date: '2019/05/17', model: 'HP Elite x1 kj89', stock: 1, manager: 'sushida', loc: '404', owner: 'admin' },
  { code: '22020-11400078-07065', name: 'ノートPC', date: '2020/07/06', model: 'MacBookPro xx89', stock: 4, manager: 'sushida', loc: '413', owner: 'admin' },
  { code: '22022-82900056-08121', name: 'ディスプレイ', date: '2022/08/12', model: 'DELL PH4459-ab', stock: 5, manager: 'sushida', loc: '404', owner: 'admin' },
  { code: '22016-82900045-06072', name: 'ダイキン加湿器', date: '2016/06/07', model: 'MCX40N-W', stock: 1, manager: 'uchida', loc: '405', owner: 'admin' },
  { code: '22018-82900213-11181', name: 'サーバー', date: '2018/11/18', model: 'PowerEdge XE3620', stock: 3, manager: 'uchida', loc: '411', owner: 'admin' },
  { code: '22019-82900046-06123', name: 'パソコン', date: '2019/06/12', model: 'DELL Latitude 4490', stock: 5, manager: 'uchida', loc: '405', owner: 'admin' },
  { code: '22020-11400032-06051', name: 'ノートPC', date: '2020/06/05', model: 'MacBookPro xx90', stock: 1, manager: 'uchida', loc: '405', owner: 'admin' },
  { code: '22021-82900212-12151', name: 'プロジェクター', date: '2021/12/15', model: 'Panasonic HK-PP5', stock: 1, manager: 'uchida', loc: '405', owner: 'admin' },
  { code: '22021-82900224-12201', name: 'パソコン', date: '2021/12/20', model: 'HPPro SFF 200 G1', stock: 3, manager: 'uchida', loc: '405', owner: 'admin' }
];

  for (const item of itemData) {
    await prisma.items.upsert({
      where: { assetCode: item.code },
      update: {},
      create: {
        assetCode: item.code,
        name: item.name,
        acquisitionDate: new Date(item.date),
        modelNumber: item.model,
        stock: item.stock,
        manager: item.manager,
        location: item.loc,
        status: AssetStatus.USED,
        department: Department.CS,
        ownerid: item.owner, // 便宜上managerをそのまま所有者(ownerid)としてセットしています
      },
    });
  }

  console.log('シードデータの投入が完了しました！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });