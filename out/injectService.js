"use strict";
/**
 * injectService.js - Pro 实验注入服务
 * 
 * 自动发现本地 Windsurf Language Server 进程，注入 Pro 实验配置，
 * 禁用 CASCADE_ENFORCE_QUOTA 以绕过本地限速检查。
 * 
 * 移植自 inject_standalone.py
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectService = void 0;
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const child_process = require("child_process");

const LS_SERVICE = "exa.language_server_pb.LanguageServerService";
const IDE_VERSION = "2.0.61";

// 实验 Key ID
const ExperimentKey = {
    CASCADE_ENFORCE_QUOTA: 204,
    CASCADE_ENABLE_AUTOMATED_MEMORIES: 224,
    CASCADE_ENABLE_MCP_TOOLS: 245,
    CASCADE_PLAN_BASED_CONFIG_OVERRIDE: 266,
    CASCADE_ENABLE_PROXY_WEB_SERVER: 290,
    CASCADE_WEB_APP_DEPLOYMENTS_ENABLED: 300,
    CASCADE_WINDSURF_BROWSER_TOOLS_ENABLED: 328,
};

const FORCE_DISABLE = [ExperimentKey.CASCADE_ENFORCE_QUOTA];
const FORCE_ENABLE = [
    ExperimentKey.CASCADE_PLAN_BASED_CONFIG_OVERRIDE,
    ExperimentKey.CASCADE_ENABLE_MCP_TOOLS,
    ExperimentKey.CASCADE_WEB_APP_DEPLOYMENTS_ENABLED,
    ExperimentKey.CASCADE_ENABLE_PROXY_WEB_SERVER,
    ExperimentKey.CASCADE_ENABLE_AUTOMATED_MEMORIES,
    ExperimentKey.CASCADE_WINDSURF_BROWSER_TOOLS_ENABLED,
];

/**
 * 向本地 LS 发送 Connect-protocol JSON 请求
 */
function lsCall(port, method, payload, csrfToken, timeout = 10000) {
    return new Promise((resolve) => {
        const body = JSON.stringify(payload || {});
        const headers = {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'Content-Length': Buffer.byteLength(body),
        };
        if (csrfToken) {
            headers['x-codeium-csrf-token'] = csrfToken;
        }
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: `/${LS_SERVICE}/${method}`,
            method: 'POST',
            headers: headers,
            timeout: timeout,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(data || '{}') });
                } catch {
                    resolve({ ok: false, status: res.statusCode, data: { raw: data.substring(0, 200) } });
                }
            });
        });
        req.on('error', (err) => resolve({ ok: false, status: 0, data: { error: err.message } }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: { error: 'timeout' } }); });
        req.write(body);
        req.end();
    });
}

/**
 * 构造 metadata
 */
function buildMeta(apiKey) {
    return {
        metadata: {
            apiKey: apiKey || '',
            ideName: 'windsurf',
            ideVersion: IDE_VERSION,
            extensionVersion: IDE_VERSION,
            locale: 'en',
        }
    };
}

/**
 * 从 vscdb 中读取当前登录的 apiKey (同 Python 版 get_active_login_key)
 * 使用项目已有的 sql.js 依赖，兼容插件沙箱环境
 */
function discoverApiKey() {
    const home = os.homedir();
    const dbPaths = [];
    if (process.platform === 'win32') {
        const appdata = process.env.APPDATA || '';
        if (appdata) {
            dbPaths.push(path.join(appdata, 'Windsurf', 'User', 'globalStorage', 'state.vscdb'));
            dbPaths.push(path.join(appdata, 'Windsurf', 'User', 'globalStorage', 'codeium.windsurf', 'state.vscdb'));
        }
    } else {
        dbPaths.push(path.join(home, '.config', 'Windsurf', 'User', 'globalStorage', 'state.vscdb'));
        dbPaths.push(path.join(home, '.config', 'Windsurf', 'User', 'globalStorage', 'codeium.windsurf', 'state.vscdb'));
    }
    // 方式1: sql.js (项目已有依赖，插件内可用)
    try {
        const initSqlJs = require('sql.js');
        const SQL = initSqlJs();
        for (const dbPath of dbPaths) {
            try {
                if (!fs.existsSync(dbPath)) continue;
                const buf = fs.readFileSync(dbPath);
                const db = new SQL.Database(buf);
                try {
                    const stmt = db.prepare("SELECT value FROM ItemTable WHERE key='windsurfAuthStatus'");
                    if (stmt.step()) {
                        const val = stmt.get()[0];
                        const text = typeof val === 'string' ? val : (val ? val.toString() : '');
                        if (text) {
                            const obj = JSON.parse(text);
                            const key = obj.apiKey || '';
                            if (key) { stmt.free(); db.close(); return key; }
                        }
                    }
                    stmt.free();
                } finally { db.close(); }
            } catch { }
        }
    } catch { }
    // 方式2: sqlite3 CLI 兜底
    for (const dbPath of dbPaths) {
        try {
            if (!fs.existsSync(dbPath)) continue;
            const result = child_process.execSync(
                `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key='windsurfAuthStatus'" 2>/dev/null`,
                { timeout: 5000, encoding: 'utf-8' }
            ).trim();
            if (!result) continue;
            const obj = JSON.parse(result);
            const key = obj.apiKey || '';
            if (key) return key;
        } catch { }
    }
    return '';
}

class InjectService {
    constructor(logFn) {
        this._log = logFn || console.log;
    }

    log(msg) {
        this._log(msg);
    }

    /**
     * 查找所有 LS 进程 (Linux)
     */
    findAllProcesses() {
        const lsName = process.platform === 'win32' ? 'language_server_windows_x64'
            : process.platform === 'darwin' ? 'language_server_macos_x64'
            : 'language_server_linux_x64';
        const results = [];
        
        if (process.platform === 'win32') {
            return this._findProcessesWindows(lsName);
        }

        // Linux/macOS: scan /proc
        if (fs.existsSync('/proc')) {
            try {
                const entries = fs.readdirSync('/proc').filter(e => /^\d+$/.test(e));
                for (const entry of entries) {
                    try {
                        const cmdline = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf-8');
                        if (!cmdline.includes(lsName)) continue;
                        const full = cmdline.replace(/\0/g, ' ');
                        const pid = parseInt(entry);
                        const portMatch = full.match(/--port[=\s]+(\d+)/);
                        const port = portMatch ? parseInt(portMatch[1]) : null;
                        results.push({ pid, port, cmdline: full });
                    } catch { }
                }
            } catch { }
        }

        // Fallback: ps
        if (results.length === 0) {
            try {
                const stdout = child_process.execSync('ps axww -o pid=,command=', { timeout: 10000, encoding: 'utf-8' });
                for (const line of stdout.split('\n')) {
                    if (!line.includes(lsName)) continue;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 2) continue;
                    const pid = parseInt(parts[0]);
                    const cmd = parts.slice(1).join(' ');
                    const portMatch = cmd.match(/--port[=\s]+(\d+)/);
                    results.push({ pid, port: portMatch ? parseInt(portMatch[1]) : null, cmdline: cmd });
                }
            } catch { }
        }

        return results;
    }

    _findProcessesWindows(lsName) {
        const results = [];
        try {
            const stdout = child_process.execSync(
                `powershell -Command "Get-Process ${lsName} -EA SilentlyContinue | Select Id,@{N='Cmd';E={(Get-CimInstance Win32_Process -Filter \\"ProcessId=$($_.Id)\\").CommandLine}} | ConvertTo-Json"`,
                { timeout: 10000, encoding: 'utf-8' }
            );
            if (!stdout.trim()) return results;
            let data = JSON.parse(stdout);
            if (!Array.isArray(data)) data = [data];
            for (const proc of data) {
                const pid = proc.Id;
                const cmd = proc.Cmd || '';
                const portMatch = cmd.match(/--port[=\s]+(\d+)/);
                if (pid) results.push({ pid, port: portMatch ? parseInt(portMatch[1]) : null, cmdline: cmd });
            }
        } catch { }
        return results;
    }

    /**
     * 从文件读取 CSRF token
     */
    readCsrfFromFile() {
        const home = os.homedir();
        const candidates = [
            path.join(home, '.codeium', 'windsurf', 'csrf_token.txt'),
            path.join(home, '.windsurf', 'csrf_token.txt'),
        ];
        if (process.platform === 'win32') {
            const appdata = process.env.APPDATA || '';
            if (appdata) {
                candidates.push(path.join(appdata, 'Windsurf', 'csrf_token.txt'));
                candidates.push(path.join(appdata, 'windsurf', 'csrf_token.txt'));
            }
        }
        for (const p of candidates) {
            try {
                const token = fs.readFileSync(p, 'utf-8').trim();
                if (token) return token;
            } catch { }
        }
        return '';
    }

    /**
     * 从进程环境变量读取 CSRF token (Linux/macOS)
     */
    readCsrfFromProcess(pid) {
        if (process.platform === 'win32') return '';
        for (const file of [`/proc/${pid}/cmdline`, `/proc/${pid}/environ`]) {
            try {
                const raw = fs.readFileSync(file, 'utf-8');
                const match = raw.match(/WINDSURF_CSRF_TOKEN[=]([^\x00\s"]+)/);
                if (match) return match[1];
            } catch { }
        }
        return '';
    }

    /**
     * 获取进程监听端口
     */
    getListenPorts(pid) {
        const ports = [];
        try {
            const stdout = child_process.execSync(`ss -tlnp`, { timeout: 5000, encoding: 'utf-8' });
            for (const line of stdout.split('\n')) {
                if (!line.includes(`pid=${pid},`)) continue;
                const match = line.match(/:(\d+)\s/);
                if (match) ports.push(parseInt(match[1]));
            }
        } catch { }
        if (ports.length > 0) return ports;
        // Fallback: /proc/net/tcp
        try {
            const tcp = fs.readFileSync(`/proc/${pid}/net/tcp`, 'utf-8');
            for (const line of tcp.split('\n')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 4 || parts[3] !== '0A') continue;
                const portHex = parts[1].split(':')[1];
                ports.push(parseInt(portHex, 16));
            }
        } catch { }
        return ports;
    }

    /**
     * 探测可用端口
     */
    async probePort(ports, csrfToken) {
        for (const port of ports) {
            const r = await lsCall(port, 'Heartbeat', { metadata: {} }, csrfToken, 2000);
            if (r.ok || r.status !== 0) return port;
        }
        return null;
    }

    /**
     * 一键注入
     */
    async inject(apiKey) {
        // 自动发现 apiKey (同 Python 版)
        if (!apiKey) {
            this.log('🔑 正在从登录态获取 apiKey...');
            apiKey = discoverApiKey();
            if (apiKey) {
                const tail = apiKey.length >= 8 ? apiKey.slice(-8) : apiKey;
                this.log(`🔑 使用登录态 apiKey: ****${tail}`);
            } else {
                this.log('⚠️ 未找到 apiKey，将仅注入实验 flags');
            }
        }
        this.log('🔍 正在查找 Language Server 进程...');
        const procs = this.findAllProcesses();
        if (procs.length === 0) {
            this.log('❌ 未找到 Windsurf Language Server 进程');
            return { success: false, error: '未找到 LS 进程，请确认 Windsurf 已启动' };
        }
        this.log(`📡 发现 ${procs.length} 个 LS 进程`);

        let successCount = 0;
        for (let i = 0; i < procs.length; i++) {
            const proc = procs[i];
            let port = proc.port;
            const pid = proc.pid;

            // 获取 CSRF
            let csrf = this.readCsrfFromFile();
            if (!csrf && pid) csrf = this.readCsrfFromProcess(pid);

            // 端口探测
            if (!port && pid) {
                const listenPorts = this.getListenPorts(pid);
                port = await this.probePort(listenPorts, csrf);
                if (!port) {
                    this.log(`⚠️ [${i + 1}/${procs.length}] PID=${pid} 端口探测失败，跳过`);
                    continue;
                }
            }
            if (!port) continue;

            this.log(`🔧 [${i + 1}/${procs.length}] port=${port} pid=${pid}`);

            // 1. Heartbeat
            const hb = await lsCall(port, 'Heartbeat', { metadata: {} }, csrf);
            if (!hb.ok) {
                this.log(`  ❌ Heartbeat 失败`);
                continue;
            }

            // 2. SetBaseExperiments
            const expR = await lsCall(port, 'SetBaseExperiments', {
                forceDisableExperiments: FORCE_DISABLE,
                forceEnableExperiments: FORCE_ENABLE,
            }, csrf);
            if (!expR.ok) {
                this.log(`  ❌ 实验注入失败`);
                continue;
            }
            this.log(`  ✅ 实验注入成功 (禁用限额检查)`);

            // 3. Inject Pro status (严格按 Python _inject_single_ls 顺序)
            if (apiKey) {
                const usR = await lsCall(port, 'GetUserStatus', buildMeta(apiKey), csrf);
                let userStatus;
                if (usR.ok && usR.data && typeof usR.data === 'object') {
                    userStatus = usR.data;
                    const us = userStatus.userStatus = userStatus.userStatus || {};
                    const ps = us.planStatus = us.planStatus || {};
                    const pi = ps.planInfo = ps.planInfo || {};
                    pi.planName = 'Pro';
                    pi.teamsTier = 2;
                    pi.billingStrategy = 1;
                    pi.hasPaidFeatures = true;
                    pi.monthlyPromptCredits = pi.monthlyPromptCredits || '15000';
                    pi.monthlyFlowCredits = pi.monthlyFlowCredits || '15000';
                    ps.availablePromptCredits = ps.availablePromptCredits || '15000';
                    ps.availableFlowCredits = ps.availableFlowCredits || '15000';
                    ps.dailyQuotaRemainingPercent = 100;
                    ps.weeklyQuotaRemainingPercent = 100;
                } else {
                    userStatus = {
                        userStatus: {
                            planStatus: {
                                planInfo: {
                                    planName: 'Pro', teamsTier: 2, billingStrategy: 1,
                                    hasPaidFeatures: true, monthlyPromptCredits: '15000', monthlyFlowCredits: '15000',
                                },
                                availablePromptCredits: '15000', availableFlowCredits: '15000',
                                dailyQuotaRemainingPercent: 100, weeklyQuotaRemainingPercent: 100,
                            }
                        }
                    };
                }
                const proR = await lsCall(port, 'UpdatePanelStateWithUserStatus', { ...buildMeta(apiKey), ...userStatus }, csrf);
                if (proR.ok) {
                    this.log(`  ✅ Pro 状态注入成功 (teamsTier=2, planName=Pro)`);
                } else {
                    this.log(`  ⚠️ Pro 状态注入失败: ${JSON.stringify(proR.data).substring(0, 100)}`);
                }
                // 4. InitializeCascadePanelState (Pro 状态注入后再重置限速缓存)
                const panelR = await lsCall(port, 'InitializeCascadePanelState', buildMeta(apiKey), csrf);
                this.log(`  ${panelR.ok ? '✅' : '⚠️'} 面板状态已重置 (清除限速缓存)`);
            } else {
                this.log(`  ⚠️ 无 apiKey，跳过 Pro 状态注入`);
            }
            successCount++;
        }

        const msg = `注入完成: ${successCount}/${procs.length} 个 LS 成功`;
        this.log(`🎉 ${msg}`);
        return { success: successCount > 0, message: msg };
    }
}

exports.InjectService = InjectService;
