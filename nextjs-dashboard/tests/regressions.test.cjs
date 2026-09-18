const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

process.env.SESSION_SECRET = 'test-only-secret-'.repeat(4);
const root = path.resolve(__dirname, '..');
const admin = { id: 1, userid: 'admin', password: 'test-password', isadmin: true, department: 'CS' };
const user = { id: 2, userid: 'user', password: 'test-password', isadmin: false, department: 'EE' };
const item = { id: 10, name: 'asset', assetCode: 'A', acquisitionCost: 1000n, manager: 'user', ownerid: 'creator', department: 'EE', stock: 0, status: 'USED', location: 'room' };

function setup(overrides = {}) {
  const accounts = [structuredClone(admin), structuredClone(user)];
  const db = {
    accounts: { findUnique: async ({ where }) => accounts.find(a => where.id ? a.id === where.id : a.userid === where.userid) ?? null },
    ...overrides,
  };
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (filename.endsWith('/utils/prisma.ts')) return { prisma: db };
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : require(id);
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    return module.exports;
  }
  const auth = load('app/api/utils/auth.ts');
  function request(url, method = 'GET', body, actor = admin, headers = {}) {
    if (actor) {
      const response = NextResponse.json({});
      auth.setSession(response, actor);
      headers.cookie = `${auth.SESSION_COOKIE}=${response.cookies.get(auth.SESSION_COOKIE).value}`;
    }
    return new NextRequest(`http://localhost${url}`, {
      method, headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { db, accounts, load, auth, request, route: name => load(`app/api/${name}/route.ts`) };
}

test('all data endpoints reject missing sessions before accessing data', async () => {
  const s = setup();
  const endpoints = { accounts: ['GET', 'POST', 'PATCH', 'DELETE'], items: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], requests: ['GET', 'POST', 'PATCH'], inventoryrequests: ['GET', 'POST', 'PATCH'], inventoryrounds: ['GET', 'POST', 'PATCH', 'DELETE'], inventory: ['POST'] };
  for (const [name, methods] of Object.entries(endpoints)) {
    for (const method of methods) {
      const response = await s.route(name)[method](s.request(`/api/${name}`, method, method === 'GET' ? undefined : {}, null));
      assert.equal(response.status, 401, `${name} ${method}`);
    }
  }
});

test('all admin mutations reject ordinary users despite body claims', async () => {
  const s = setup();
  const endpoints = { accounts: ['POST', 'PATCH', 'DELETE'], items: ['POST', 'PUT', 'PATCH', 'DELETE'], requests: ['PATCH'], inventoryrequests: ['PATCH'], inventoryrounds: ['POST', 'PATCH', 'DELETE'], inventory: ['POST'] };
  for (const [name, methods] of Object.entries(endpoints)) {
    for (const method of methods) {
      const response = await s.route(name)[method](s.request(`/api/${name}`, method, { isAdmin: true, isadmin: true, adminId: 'admin' }, user));
      assert.equal(response.status, 403, `${name} ${method}`);
    }
  }
});

test('signed session rejects tampering, expiration, password changes and deleted users; demotion takes effect', async () => {
  const s = setup();
  const req = s.request('/api/items');
  const token = req.cookies.get(s.auth.SESSION_COOKIE).value;
  const tampered = s.request('/api/items', 'GET', undefined, null, { cookie: `${s.auth.SESSION_COOKIE}=${token.slice(0, -3)}xxx` });
  assert.equal((await s.auth.authorize(tampered)).response.status, 401);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 9 * 60 * 60 * 1000;
    assert.equal((await s.auth.authorize(req)).response.status, 401);
  } finally { Date.now = realNow; }
  s.accounts[0].isadmin = false;
  assert.equal((await s.auth.authorize(req, true)).response.status, 403);
  s.accounts[0].password = 'changed';
  assert.equal((await s.auth.authorize(req)).response.status, 401);
  s.accounts.splice(0, 1);
  assert.equal((await s.auth.authorize(req)).response.status, 401);
});

test('cross-origin mutation is rejected', async () => {
  const s = setup();
  const response = await s.route('accounts').POST(s.request('/api/accounts', 'POST', {}, admin, { origin: 'https://other.example' }));
  assert.equal(response.status, 403);
});

test('login uses POST, sets HttpOnly session, denies URL credentials; logout clears cookie', async () => {
  const s = setup();
  const route = s.route('search_user');
  const response = await route.POST(s.request('/api/search_user', 'POST', { user: 'user', pass: 'test-password' }, null));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(s.auth.SESSION_COOKIE).httpOnly, true);
  assert.equal(response.cookies.get(s.auth.SESSION_COOKIE).sameSite, 'strict');
  assert.equal((await response.json()).isAdmin, false);
  assert.equal((await route.GET(s.request('/api/search_user?user=admin&pass=test-password', 'GET', undefined, null))).status, 401);
  assert.equal((await route.POST(s.request('/api/search_user', 'POST', { user: 'admin', pass: 'wrong' }, null))).status, 401);
  const logout = await route.DELETE(s.request('/api/search_user', 'DELETE'));
  assert.equal(logout.cookies.get(s.auth.SESSION_COOKIE).maxAge, 0);
});

test('hashing supports new passwords and legacy login without plaintext in responses', async () => {
  const s = setup();
  const hash = await s.auth.hashPassword('new-password');
  assert.notEqual(hash, 'new-password');
  assert.equal(await s.auth.verifyPassword('new-password', hash), true);
  assert.equal(await s.auth.verifyPassword('wrong', hash), false);
  s.accounts[1].password = hash;
  const response = await s.route('search_user').POST(s.request('/api/search_user', 'POST', { user: 'user', pass: 'new-password' }, null));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(await response.json()).includes(hash), false);
});

test('account listing selects public fields, ordinary users only receive their own account', async () => {
  const s = setup();
  let query;
  s.db.accounts.findMany = async args => {
    query = args;
    return s.accounts.filter(a => !args.where.id || a.id === args.where.id).map(a => Object.fromEntries(Object.keys(args.select).map(k => [k, a[k]])));
  };
  const response = await s.route('accounts').GET(s.request('/api/accounts?userid=admin', 'GET', undefined, user));
  assert.equal(response.status, 200);
  assert.deepEqual(query.where, { id: user.id });
  const data = await response.json();
  assert.equal(data.accounts.length, 1);
  assert.equal(data.accounts[0].password, undefined);
  assert.equal(query.select.password, undefined);
});

test('forged administrator and currentUser query cannot expand asset visibility', async () => {
  let where;
  const s = setup({ items: { findMany: async args => { where = args.where; return [item]; } } });
  const response = await s.route('items').GET(s.request('/api/items?isAdmin=true&currentUser=admin', 'GET', undefined, user));
  assert.equal(response.status, 200);
  assert.deepEqual(where.OR, [{ manager: 'user' }, { ownerid: 'user' }]);
  assert.equal((await response.json()).items[0].acquisitionCost, 1000);
  await s.route('items').GET(s.request('/api/items?isAdmin=false', 'GET', undefined, admin));
  assert.deepEqual(where.OR, [{ manager: 'admin' }, { ownerid: 'admin' }]);
});

test('request creation persists once and returns JSON when item cost is BigInt; requester comes from session', async () => {
  let created = 0;
  let saved;
  const s = setup({ items: { findUnique: async () => item }, requests: { create: async ({ data }) => { saved = data; created++; return { id: 3, ...data, item }; } } });
  const response = await s.route('requests').POST(s.request('/api/requests', 'POST', { itemId: 10, type: 'REPAIR', requesterId: 'admin' }, user));
  assert.equal(response.status, 201);
  assert.equal(created, 1);
  assert.equal(saved.requesterId, 'user');
  assert.equal((await response.json()).request.item.acquisitionCost, 1000);
});

test('requests list is scoped on server and nested BigInt is JSON-safe', async () => {
  let where;
  const s = setup({ requests: { findMany: async args => { where = args.where; return [{ item }]; } } });
  const response = await s.route('requests').GET(s.request('/api/requests?requesterId=admin', 'GET', undefined, user));
  assert.deepEqual(where, { requesterId: 'user' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).requests[0].item.acquisitionCost, 1000);
});

test('requests and inventory submissions reject someone else’s asset', async () => {
  const s = setup({ items: { findUnique: async () => ({ ...item, manager: 'other' }) } });
  for (const name of ['requests', 'inventoryrequests']) {
    const response = await s.route(name).POST(s.request(`/api/${name}`, 'POST', { itemId: 10, type: 'REPAIR', newStatus: 'USED' }, user));
    assert.equal(response.status, 403);
  }
});

test('inventory report listing serializes nested BigInt and scopes ordinary users', async () => {
  let where;
  const record = { id: 1, itemId: item.id, ownerId: 'user', item };
  const s = setup({ inventoryRounds: { findFirst: async () => ({ id: 1, title: 'round' }) }, inventoryRecords: { findMany: async args => { where = args.where; return [record]; } }, items: { findMany: async () => [item] } });
  let response = await s.route('inventoryrequests').GET(s.request('/api/inventoryrequests'));
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.equal(data.userStats.user.records[0].item.acquisitionCost, 1000);
  response = await s.route('inventoryrequests').GET(s.request('/api/inventoryrequests', 'GET', undefined, user));
  assert.equal(response.status, 200);
  assert.equal(where.ownerId, 'user');
  assert.deepEqual((await response.json()).userStats, {});
});

test('editing preserves creator/department and zero acquisition cost; updatedBy comes from session', async () => {
  let saved;
  const s = setup({ items: { update: async ({ data }) => { saved = data; return { ...item, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }; } } });
  const response = await s.route('items').PUT(s.request('/api/items', 'PUT', { id: 10, assetCode: 'A', name: 'changed', acquisitionCost: 0, ownerid: 'forged', updatedBy: 'forged' }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.item.ownerid, 'creator');
  assert.equal(data.item.department, 'EE');
  assert.equal(data.item.acquisitionCost, 0);
  assert.equal(saved.updatedBy, 'admin');
  assert.equal(saved.ownerid, undefined);
});

test('account rename updates all historical references atomically and never returns password', async () => {
  const s = setup();
  const writes = [];
  s.db.accounts.findFirst = async () => null;
  let transactionCount = 0;
  s.db.$transaction = async fn => {
    transactionCount++;
    const tx = { accounts: { update: async args => Object.fromEntries(Object.keys(args.select).map(k => [k, { ...user, ...args.data }[k]])) } };
    for (const name of ['items', 'requests', 'inventoryRecords', 'inventoryRequests', 'inventoryRounds']) {
      tx[name] = { updateMany: async args => { writes.push({ model: name, ...args }); return { count: 1 }; } };
    }
    return fn(tx);
  };
  const response = await s.route('accounts').PATCH(s.request('/api/accounts', 'PATCH', { id: 2, userid: 'new-user' }));
  assert.equal(response.status, 200);
  assert.equal(transactionCount, 1);
  assert.equal(writes.length, 7);
  assert.deepEqual(writes.map(w => Object.keys(w.data)[0]).sort(), ['manager', 'ownerid', 'updatedBy', 'requesterId', 'ownerId', 'userId', 'createdBy'].sort());
  assert.ok(writes.every(w => Object.values(w.where)[0] === 'user' && Object.values(w.data)[0] === 'new-user'));
  assert.equal((await response.json()).account.password, undefined);
});

test('request approval and asset update share a transaction and return JSON safely', async () => {
  let transactionCount = 0;
  const s = setup({ requests: { findUnique: async () => ({ requesterId: 'user', itemId: 10 }) }, $transaction: async fn => {
    transactionCount++;
    return fn({ items: { update: async () => item }, requests: { update: async () => ({ item }) } });
  } });
  const response = await s.route('requests').PATCH(s.request('/api/requests', 'PATCH', { id: 1, status: 'APPROVED' }));
  assert.equal(response.status, 200);
  assert.equal(transactionCount, 1);
  assert.equal((await response.json()).request.item.acquisitionCost, 1000);
});

test('large BigInt is serialized without losing precision', () => {
  const s = setup();
  return s.load('app/api/utils/json.ts').json({ value: 9007199254740993n }).json().then(data => assert.equal(data.value, '9007199254740993'));
});

test('new account stores a password hash and returns only public fields', async () => {
  const s = setup();
  let saved;
  s.db.accounts.findFirst = async () => null;
  s.db.accounts.create = async ({ data, select }) => {
    saved = data;
    return Object.fromEntries(Object.keys(select).map(k => [k, { id: 3, ...data }[k]]));
  };
  const response = await s.route('accounts').POST(s.request('/api/accounts', 'POST', { userid: 'new', password: 'secret' }));
  assert.equal(response.status, 201);
  assert.ok(saved.password.startsWith('scrypt$'));
  assert.equal(await s.auth.verifyPassword('secret', saved.password), true);
  assert.equal((await response.json()).account.password, undefined);
});

test('inventory resubmission uses session identity and preserves zero stock', async () => {
  let saved;
  const s = setup({ items: { findUnique: async () => item }, inventoryRounds: { findFirst: async () => ({ id: 1 }) }, inventoryRecords: {
    findUnique: async () => ({ id: 2, status: 'RESUBMIT_REQUESTED' }),
    update: async ({ data }) => { saved = data; return { id: 2, ...data }; },
  } });
  const response = await s.route('inventoryrequests').POST(s.request('/api/inventoryrequests', 'POST', { itemId: 10, userId: 'admin', newStatus: 'USED', newStock: 0 }, user));
  assert.equal(response.status, 201);
  assert.equal(saved.ownerId, 'user');
  assert.equal(saved.status, 'PENDING');
  assert.equal(saved.isApproved, false);
  assert.equal(saved.newStock, 0);
  assert.equal(saved.newLocation, 'room');
});

test('individual inventory approval rejects closed rounds and approves active pending records', async () => {
  let current = false;
  let applied;
  const s = setup({ inventoryRecords: { findUnique: async () => ({ id: 1, itemId: 10, status: 'PENDING', newStock: 0, ownerId: 'user', newStatus: 'USED', newLocation: 'new-room', round: { isCurrent: current } }) },
    $transaction: async fn => fn({ items: { update: async ({ data }) => { applied = data; } }, inventoryRecords: { update: async () => ({}), updateMany: async () => ({ count: 1 }) } }),
  });
  const body = { recordId: 1, action: 'APPROVE_SINGLE' };
  assert.equal((await s.route('inventoryrequests').PATCH(s.request('/api/inventoryrequests', 'PATCH', body))).status, 409);
  assert.equal(applied, undefined);
  current = true;
  assert.equal((await s.route('inventoryrequests').PATCH(s.request('/api/inventoryrequests', 'PATCH', body))).status, 200);
  assert.equal(applied.stock, 0);
  assert.equal(applied.location, 'new-room');
});

test('asset creation preserves zero and large cost strings, rejects unsafe numbers', async () => {
  let saved;
  const s = setup({ items: { create: async ({ data }) => { saved = data; return { id: 10, ...data }; } } });
  for (const cost of [0, '9007199254740993']) {
    const response = await s.route('items').POST(s.request('/api/items', 'POST', { assetCode: 'A', name: 'asset', acquisitionCost: cost, ownerid: 'forged' }));
    assert.equal(response.status, 201);
    assert.equal(saved.ownerid, 'admin');
    assert.equal(saved.acquisitionCost, BigInt(cost));
  }
  assert.equal((await s.route('items').POST(s.request('/api/items', 'POST', { assetCode: 'A', name: 'asset', acquisitionCost: 9007199254740992 }))).status, 400);
});

