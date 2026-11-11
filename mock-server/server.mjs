// GPU Job 監控平台的 mock backend。
// 行為以 openapi.yaml 為準；這支程式刻意模擬真實後端會出現的狀況（延遲、偶發錯誤、斷線）。
//
// 環境變數：
//   MOCK_PORT   預設 4000
//   MOCK_SEED   資料產生用的亂數種子，預設 42
//   MOCK_CHAOS  0 = 關閉偶發錯誤與隨機斷線（給 e2e 用），預設 1

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const SEED = Number(process.env.MOCK_SEED ?? 42);
const CHAOS = process.env.MOCK_CHAOS !== '0';

// ---------------------------------------------------------------------------
// 決定性亂數
// ---------------------------------------------------------------------------
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(SEED);
const chaosRand = mulberry32(SEED + 1);
const pick = arr => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------------------
// 資料
// ---------------------------------------------------------------------------
const JOB_COUNT = 10_000;
const ID_BASE = 2095791122068779008n; // snowflake 風格的 int64

const NODES = [
    { name: 'gpu-node-01', displayName: 'GPU Node 01', gpuModel: 'H100', gpuCount: 8 },
    { name: 'gpu-node-02', displayName: 'GPU Node 02', gpuModel: 'H100', gpuCount: 8 },
    { name: 'gpu-node-03', displayName: 'GPU Node 03', gpuModel: 'A100', gpuCount: 8 },
    { name: 'gpu-node-04', displayName: 'GPU Node 04', gpuModel: 'A100', gpuCount: 4 },
    { name: 'gpu-node-05', displayName: 'GPU Node 05', gpuModel: 'L40S', gpuCount: 4 },
    { name: 'gpu-node-06', displayName: '實驗室 機櫃 B 🔥', gpuModel: 'L40S', gpuCount: 4 },
    { name: 'gpu-node-07', displayName: 'GPU Node 07', gpuModel: 'RTX 6000 Ada', gpuCount: 2 },
    {
        name: 'gpu-node-08',
        displayName: 'GPU Node 08 (maintenance)',
        gpuModel: 'A100',
        gpuCount: 8,
    },
];

const OWNERS = ['alice', 'bob', 'chen.wei', 'lin.yuting', 'tanaka', 'nguyen.van.a', 'kim.minji'];
const NAME_PARTS = ['llama3', 'qwen3', 'mistral', 'resnet50', 'bert', 'whisper', 'sdxl', 'gemma'];
const TASKS = ['finetune', 'inference', 'eval', 'pretrain', 'distill', 'benchmark'];
const DESCRIPTIONS = [
    '',
    'Fine-tune on internal dataset v3',
    '客戶 A 的 POC：需在週五前完成',
    'Note: lr=3e-5, batch=32, warmup: 500 steps',
    'Reproduce paper "Scaling Laws" — table 2',
    '<b>重要</b> 請勿停止',
    'debug <img src=x onerror="alert(\'xss\')">',
    'ベンチマーク：推論スループット測定',
    'Đánh giá mô hình tiếng Việt',
    'multi-line\ndescription\nwith breaks',
];

/** @type {Map<string, any>} */
const jobs = new Map();
const jobOrder = []; // 依建立時間由新到舊

const now = Date.now();
for (let i = 0; i < JOB_COUNT; i++) {
    const id = (ID_BASE + BigInt(i)).toString();
    const r = rand();
    const status =
        r < 0.15
            ? 'PENDING'
            : r < 0.45
              ? 'RUNNING'
              : r < 0.8
                ? 'SUCCEEDED'
                : r < 0.95
                  ? 'FAILED'
                  : 'STOPPED';
    const node = status === 'PENDING' && rand() < 0.7 ? null : pick(NODES);
    let name = `${pick(NAME_PARTS)}-${pick(TASKS)}-${String(i).padStart(5, '0')}`;
    if (i % 997 === 0) {
        name +=
            '-with-an-extremely-long-name-that-nobody-expected-to-see-in-a-table-cell-v2-final-final';
    }
    if (i % 1301 === 0) name = `中文任務名稱-${i}`;
    const createdAt = new Date(now - i * 47_000 - Math.floor(rand() * 40_000)).toISOString();
    jobs.set(id, {
        id,
        name,
        status,
        node: node ? node.name : null,
        gpuCount: node ? 1 + Math.floor(rand() * node.gpuCount) : 1 + Math.floor(rand() * 4),
        owner: pick(OWNERS),
        description: pick(DESCRIPTIONS),
        createdAt,
        startedAt:
            status === 'PENDING' ? null : new Date(Date.parse(createdAt) + 30_000).toISOString(),
        finishedAt: ['SUCCEEDED', 'FAILED', 'STOPPED'].includes(status)
            ? new Date(Date.parse(createdAt) + 3_600_000).toISOString()
            : null,
        _logSeq: 0,
    });
    jobOrder.push(id);
}

// 狀態會隨時間改變，讓輪詢有意義
setInterval(() => {
    for (let k = 0; k < 20; k++) {
        const id = jobOrder[Math.floor(rand() * 2000)];
        const job = jobs.get(id);
        if (job.status === 'PENDING') {
            job.status = 'RUNNING';
            job.node ??= pick(NODES).name;
            job.startedAt = new Date().toISOString();
        } else if (job.status === 'RUNNING' && rand() < 0.3) {
            job.status = rand() < 0.8 ? 'SUCCEEDED' : 'FAILED';
            job.finishedAt = new Date().toISOString();
        }
    }
}, 3000);

// ---------------------------------------------------------------------------
// 序列化：id 是 int64，以 JSON number 輸出（不加引號）
// ---------------------------------------------------------------------------
function toJson(value) {
    return JSON.stringify(value, (key, v) => {
        if (key.startsWith('_')) return undefined;
        if (key === 'id' && typeof v === 'string' && /^\d+$/.test(v)) return `__INT64__${v}__`;
        return v;
    }).replace(/"__INT64__(\d+)__"/g, '$1');
}

function publicJob(job) {
    // eslint-disable-next-line no-unused-vars
    const { _logSeq, ...rest } = job;
    return rest;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function send(res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(typeof body === 'string' ? body : toJson(body));
}
const ok = (res, data) => send(res, 200, { data, error: null });
const fail = (res, status, code, message) =>
    send(res, status, { data: null, error: { code, message } });

function badGateway(res) {
    // 模擬前面那層 proxy 回的錯誤頁，不是 JSON
    res.writeHead(502, { 'Content-Type': 'text/html' });
    res.end(
        '<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>'
    );
}

async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
const SORTABLE = new Set(['createdAt', 'name', 'status', 'gpuCount']);

async function listJobs(req, res, url) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const statuses = (url.searchParams.get('status') ?? '').split(',').filter(Boolean);
    const node = url.searchParams.get('node');
    const [sortField, sortDir = 'desc'] = (url.searchParams.get('sort') || 'createdAt:desc').split(
        ':'
    );
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 50);

    // 關鍵字越短，搜尋越慢（模擬全文檢索）
    const latency = q ? Math.max(120, 1400 - q.length * 260) : 150 + Math.floor(chaosRand() * 250);
    await sleep(latency);

    if (CHAOS && chaosRand() < 0.06) return badGateway(res);
    if (!Number.isInteger(page) || page < 1)
        return fail(res, 400, 'INVALID_PAGE', 'page must be >= 1');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
        return fail(res, 400, 'INVALID_PAGE_SIZE', 'pageSize must be between 1 and 200');
    }
    if (!SORTABLE.has(sortField))
        return fail(res, 400, 'INVALID_SORT', `cannot sort by ${sortField}`);

    let items = jobOrder.map(id => jobs.get(id));
    if (statuses.length) items = items.filter(j => statuses.includes(j.status));
    if (node) items = items.filter(j => j.node === node);
    if (q) items = items.filter(j => j.name.toLowerCase().includes(q) || j.owner.includes(q));
    if (sortField !== 'createdAt' || sortDir !== 'desc') {
        const dir = sortDir === 'asc' ? 1 : -1;
        items = [...items].sort((a, b) =>
            a[sortField] > b[sortField] ? dir : a[sortField] < b[sortField] ? -dir : 0
        );
    }
    const total = items.length;
    const slice = items.slice((page - 1) * pageSize, page * pageSize).map(publicJob);
    return ok(res, { items: slice, total, page, pageSize });
}

async function getJob(res, id) {
    await sleep(120 + Math.floor(chaosRand() * 200));
    const job = jobs.get(id);
    if (!job) return fail(res, 404, 'JOB_NOT_FOUND', `job ${id} not found`);
    return ok(res, publicJob(job));
}

async function getMetrics(res, id, url) {
    await sleep(300 + Math.floor(chaosRand() * 500));
    const job = jobs.get(id);
    if (!job) return fail(res, 404, 'JOB_NOT_FOUND', `job ${id} not found`);
    const index = Number(BigInt(id) - ID_BASE);
    // metrics 服務對部分 job 長期不可用 —— 詳情頁其他部分仍要能用
    if (index % 7 === 3) return fail(res, 503, 'METRICS_UNAVAILABLE', 'metrics backend timeout');
    if (job.status === 'PENDING') return ok(res, { gpus: [], points: [] });

    const range = url.searchParams.get('range') ?? '15m';
    const minutes = { '15m': 15, '1h': 60, '6h': 360 }[range];
    if (!minutes) return fail(res, 400, 'INVALID_RANGE', 'range must be one of 15m, 1h, 6h');
    const step = (minutes * 60_000) / 90;
    const gpus = Array.from({ length: job.gpuCount }, (_, g) => g);
    const end = Date.now();
    const r = mulberry32(index);
    const points = [];
    for (let t = end - minutes * 60_000; t <= end; t += step) {
        points.push({
            ts: new Date(t).toISOString(),
            gpu: gpus.map(() => {
                // 偶爾有缺值（exporter 漏採）
                if (r() < 0.04) return { util: null, memUsedMiB: null };
                return {
                    util: Math.round(40 + r() * 60),
                    memUsedMiB: Math.round(20000 + r() * 50000),
                };
            }),
        });
    }
    return ok(res, { gpus, points });
}

async function stopJob(req, res, id) {
    await readBody(req).catch(() => ({}));
    await sleep(700 + Math.floor(chaosRand() * 600));
    const job = jobs.get(id);
    if (!job) return fail(res, 404, 'JOB_NOT_FOUND', `job ${id} not found`);
    // 業務錯誤以 HTTP 200 + error 欄位回傳（見 openapi.yaml「錯誤回應」）
    if (!['PENDING', 'RUNNING'].includes(job.status)) {
        return send(res, 200, {
            data: null,
            error: { code: 'INVALID_STATE', message: `job is ${job.status}` },
        });
    }
    if (CHAOS && chaosRand() < 0.25) {
        return send(res, 200, {
            data: null,
            error: {
                code: 'STOP_FAILED',
                message: 'scheduler did not acknowledge the stop request',
            },
        });
    }
    job.status = 'STOPPING';
    setTimeout(() => {
        job.status = 'STOPPED';
        job.finishedAt = new Date().toISOString();
    }, 3000);
    return ok(res, publicJob(job));
}

const LOG_LEVELS = ['INFO', 'INFO', 'INFO', 'DEBUG', 'WARN', 'ERROR'];
function logLine(seq) {
    const level = LOG_LEVELS[seq % LOG_LEVELS.length];
    const color = { INFO: 32, DEBUG: 90, WARN: 33, ERROR: 31 }[level];
    if (seq % 977 === 0)
        return `\u001b[${color}m${level}\u001b[0m step=${seq} dump=${'x'.repeat(8000)}`;
    if (seq % 499 === 0)
        return `\u001b[${color}m${level}\u001b[0m <tensor shape=[32, 4096]> loss=${(1 / (seq + 1)).toFixed(6)}`;
    return `\u001b[${color}m${level}\u001b[0m step=${seq} loss=${(2.5 * Math.exp(-seq / 5000)).toFixed(4)} lr=3e-5`;
}

function streamLogs(req, res, id, url) {
    const job = jobs.get(id);
    if (!job) return fail(res, 404, 'JOB_NOT_FOUND', `job ${id} not found`);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    const lastId = req.headers['last-event-id'] ?? url.searchParams.get('lastEventId');
    // 沒帶 Last-Event-ID 就從頭重播
    let seq = lastId !== undefined && lastId !== null ? Number(lastId) + 1 : 0;
    const live = ['RUNNING', 'PENDING', 'STOPPING'].includes(job.status);
    const target = () => (live ? Math.max(job._logSeq, seq) : 3000);

    if (live) {
        // 有歷史 log：先補到目前進度
        job._logSeq = Math.max(job._logSeq, 2000);
    }

    const emit = n => {
        let chunk = '';
        for (let k = 0; k < n && seq < target(); k++, seq++) {
            chunk += `id: ${seq}\ndata: ${logLine(seq)}\n\n`;
        }
        if (chunk) res.write(chunk);
    };

    let tick = 0;
    const timer = setInterval(() => {
        tick++;
        if (live) job._logSeq += tick % 50 === 0 ? 3000 : 20; // 每 5 秒左右一波爆量
        emit(500);
        if (!live && seq >= 3000) {
            res.write('event: end\ndata: {}\n\n');
            cleanup();
            res.end();
        }
        if (tick % 150 === 0) res.write(': keep-alive\n\n');
    }, 100);

    // 中間的 proxy 會不定時切斷長連線
    const dropAfter = 15_000 + Math.floor(chaosRand() * 10_000);
    const dropper = CHAOS ? setTimeout(() => res.destroy(), dropAfter) : null;

    const cleanup = () => {
        clearInterval(timer);
        if (dropper) clearTimeout(dropper);
    };
    req.on('close', cleanup);
}

async function listNodes(res) {
    await sleep(100);
    return ok(res, NODES);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    try {
        if (req.method === 'GET' && path === '/api/v1/nodes') return await listNodes(res);
        if (req.method === 'GET' && path === '/api/v1/jobs') return await listJobs(req, res, url);

        const m = path.match(/^\/api\/v1\/jobs\/([^/]+)(\/.*)?$/);
        if (m) {
            const [, id, rest = ''] = m;
            if (!/^\d+$/.test(id)) return fail(res, 400, 'INVALID_ID', 'id must be an integer');
            if (req.method === 'GET' && rest === '') return await getJob(res, id);
            if (req.method === 'GET' && rest === '/metrics') return await getMetrics(res, id, url);
            if (req.method === 'POST' && rest === '/stop') return await stopJob(req, res, id);
            if (req.method === 'GET' && rest === '/logs/stream')
                return streamLogs(req, res, id, url);
        }
        return fail(res, 404, 'NOT_FOUND', `${req.method} ${path} not found`);
    } catch (err) {
        console.error(err);
        if (!res.headersSent) fail(res, 500, 'INTERNAL', 'internal error');
    }
});

server.listen(PORT, () => {
    console.log(
        `mock server on http://localhost:${PORT} (seed=${SEED}, chaos=${CHAOS ? 'on' : 'off'})`
    );
});
