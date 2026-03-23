"use strict";
/**
 * apiHelper.ts - Firebase Auth 登录模块
 * 直接调用 Google Firebase REST API
 * 通过邮箱密码登录获取完整的 Token 信息
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiHelper = void 0;
const https = __importStar(require("https"));
/**
 * Firebase 配置常量
 */
const FIREBASE_CONFIG = {
    // Firebase API Key (Windsurf 项目)
    API_KEY: 'AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY',
    // Firebase Auth REST API 端点
    AUTH_SIGN_IN_URL: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
    AUTH_REFRESH_URL: 'https://securetoken.googleapis.com/v1/token',
    // Windsurf 注册 API
    WINDSURF_REGISTER_API: 'https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser',
    // Windsurf Web Backend (JSON API)
    WEB_BACKEND_URL: 'https://web-backend.windsurf.com',
    // 请求超时时间 (ms)
    REQUEST_TIMEOUT: 30000
};
/**
 * HTTP POST 请求辅助函数 (JSON 格式)
 */
async function httpPost(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = JSON.stringify(data);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers
            },
            timeout: FIREBASE_CONFIG.REQUEST_TIMEOUT
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    }
                    else {
                        reject(new Error(json.error?.message || `HTTP ${res.statusCode}`));
                    }
                }
                catch {
                    reject(new Error(`Invalid JSON response: ${body.substring(0, 100)}`));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(postData);
        req.end();
    });
}
/**
 * HTTP POST 请求辅助函数 (form-urlencoded 格式)
 * 用于 Firebase Token 刷新 API
 */
async function httpPostFormUrlEncoded(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = new URLSearchParams(data).toString();
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: FIREBASE_CONFIG.REQUEST_TIMEOUT
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    }
                    else {
                        reject(new Error(json.error?.message || `HTTP ${res.statusCode}`));
                    }
                }
                catch {
                    reject(new Error(`Invalid JSON response: ${body.substring(0, 100)}`));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(postData);
        req.end();
    });
}
/**
 * Firebase Auth 登录助手类
 */
class ApiHelper {
    constructor(logCallback) {
        this.logCallback = logCallback;
    }
    /**
     * 输出日志
     */
    log(message) {
        console.log(message);
        if (this.logCallback) {
            this.logCallback(message);
        }
    }
    /**
     * 使用邮箱密码登录获取 Firebase Token
     * 直接调用 Google Firebase Auth REST API
     */
    async loginWithEmailPassword(email, password) {
        try {
            // 直接调用 Firebase Auth REST API
            const url = `${FIREBASE_CONFIG.AUTH_SIGN_IN_URL}?key=${FIREBASE_CONFIG.API_KEY}`;
            const response = await httpPost(url, {
                email: email,
                password: password,
                returnSecureToken: true
            });
            return {
                idToken: response.idToken,
                refreshToken: response.refreshToken,
                expiresIn: parseInt(response.expiresIn || '3600')
            };
        }
        catch (error) {
            const err = error;
            // 网络连接问题
            if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
                throw new Error('无法连接到 Firebase 服务器，请检查网络连接');
            }
            // 友好的错误提示
            if (err.message.includes('EMAIL_NOT_FOUND')) {
                throw new Error('邮箱不存在');
            }
            else if (err.message.includes('INVALID_PASSWORD') || err.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                throw new Error('邮箱或密码错误');
            }
            else if (err.message.includes('USER_DISABLED')) {
                throw new Error('账号已被禁用');
            }
            else if (err.message.includes('TOO_MANY_ATTEMPTS')) {
                throw new Error('尝试次数过多，请稍后再试');
            }
            throw err;
        }
    }
    /**
     * 使用 idToken 获取 API Key
     */
    async getApiKey(idToken) {
        try {
            const response = await httpPost(FIREBASE_CONFIG.WINDSURF_REGISTER_API, {
                firebase_id_token: idToken
            });
            return {
                apiKey: response.api_key,
                name: response.name,
                apiServerUrl: response.api_server_url
            };
        }
        catch (error) {
            const err = error;
            if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
                throw new Error('无法连接到 Windsurf 服务器');
            }
            throw err;
        }
    }
    /**
     * 完整登录流程：邮箱密码 -> Token -> API Key
     */
    async login(email, password) {
        try {
            this.log('开始登录...');
            this.log(`账号: ${email}`);
            // 步骤 1: Firebase 登录
            this.log('正在验证账号...');
            const firebaseResult = await this.loginWithEmailPassword(email, password);
            this.log('账号验证成功');
            // 步骤 2: 获取 API Key
            this.log('正在获取 API Key...');
            const apiKeyResult = await this.getApiKey(firebaseResult.idToken);
            this.log(`API Key 获取成功: ${apiKeyResult.name}`);
            return {
                success: true,
                email: email,
                name: apiKeyResult.name,
                apiKey: apiKeyResult.apiKey,
                apiServerUrl: apiKeyResult.apiServerUrl,
                refreshToken: firebaseResult.refreshToken,
                idToken: firebaseResult.idToken,
                idTokenExpiresAt: Date.now() + (firebaseResult.expiresIn * 1000)
            };
        }
        catch (error) {
            const err = error;
            this.log(`登录失败: ${err.message}`);
            return {
                success: false,
                error: err.message
            };
        }
    }
    /**
     * 使用 refreshToken 刷新 token
     * 直接调用 Firebase Secure Token API
     */
    async refreshTokens(refreshToken) {
        try {
            const url = `${FIREBASE_CONFIG.AUTH_REFRESH_URL}?key=${FIREBASE_CONFIG.API_KEY}`;
            // Firebase refresh token API 使用 form-urlencoded 格式
            const response = await httpPostFormUrlEncoded(url, {
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            });
            return {
                idToken: response.id_token,
                refreshToken: response.refresh_token || refreshToken,
                expiresIn: parseInt(response.expires_in || '3600')
            };
        }
        catch (error) {
            throw new Error(`刷新 Token 失败: ${error.message}`);
        }
    }
    /**
     * 通过 web-backend JSON API 查询套餐状态 (最简单，仅需 idToken)
     */
    async getPlanStatusJson(firebaseIdToken) {
        const url = `${FIREBASE_CONFIG.WEB_BACKEND_URL}/exa.seat_management_pb.SeatManagementService/GetPlanStatus`;
        const response = await httpPost(url, {
            authToken: firebaseIdToken
        }, {
            'Connect-Protocol-Version': '1'
        });
        return response;
    }
    /**
     * 获取一次性 Auth Token (用于调用 GetPlanStatus 等接口)
     */
    async getOneTimeAuthToken(apiServerUrl, firebaseIdToken) {
        const url = `${apiServerUrl}/exa.seat_management_pb.SeatManagementService/GetOneTimeAuthToken`;
        const response = await httpPost(url, {
            firebaseIdToken: firebaseIdToken
        });
        const authToken = response.authToken || response.auth_token;
        if (!authToken) {
            throw new Error('GetOneTimeAuthToken 响应缺少 authToken');
        }
        return authToken;
    }
    /**
     * 获取套餐状态和配额信息
     */
    async getPlanStatus(apiServerUrl, authToken) {
        const url = `${apiServerUrl}/exa.seat_management_pb.SeatManagementService/GetPlanStatus`;
        const response = await httpPost(url, {
            authToken: authToken,
            includeTopUpStatus: true
        });
        return response;
    }
    /**
     * 通过 API Key 获取用户状态 (备选方案)
     */
    async getUserStatus(apiServerUrl, apiKey) {
        const now = Math.floor(Date.now() / 1000);
        const url = `${apiServerUrl}/exa.seat_management_pb.SeatManagementService/GetUserStatus`;
        const response = await httpPost(url, {
            metadata: {
                apiKey: apiKey,
                ideName: 'Windsurf',
                ideVersion: '1.0.0',
                extensionName: 'codeium.windsurf',
                extensionVersion: '1.0.0',
                locale: 'zh-CN',
                os: process.platform === 'darwin' ? 'darwin' : process.platform,
                disableTelemetry: false,
                sessionId: `ace-${now}`,
                requestId: String(now)
            }
        });
        return response;
    }
    /**
     * 查询账号配额
     * 优先用 refreshToken → GetPlanStatus，回退到 apiKey → GetUserStatus
     */
    async fetchQuota(account) {
        const apiServerUrl = account.apiServerUrl || 'https://server.codeium.com';
        let result = { planName: '', promptCredits: null, flowCredits: null, resetAt: null, modelQuotas: null, source: '' };
        // 方案 1: 通过 refreshToken → idToken → web-backend JSON API (最优)
        let idToken = null;
        if (account.refreshToken) {
            try {
                this.log('正在刷新 Token...');
                const tokens = await this.refreshTokens(account.refreshToken);
                idToken = tokens.idToken;
                // 1a: 优先用 web-backend JSON API
                try {
                    this.log('正在通过 web-backend 查询配额...');
                    const planStatusResp = await this.getPlanStatusJson(idToken);
                    result = this._parsePlanStatusQuota(planStatusResp);
                    this.log('web-backend 查询成功');
                }
                catch (err1) {
                    // 1b: 回退到 protobuf 方式
                    this.log(`web-backend 失败: ${err1.message}，尝试 protobuf...`);
                    const authToken = await this.getOneTimeAuthToken(apiServerUrl, idToken);
                    const planStatusResp = await this.getPlanStatus(apiServerUrl, authToken);
                    result = this._parsePlanStatusQuota(planStatusResp);
                }
            }
            catch (err) {
                this.log(`GetPlanStatus 方式失败: ${err.message}，尝试备选方案...`);
            }
        }
        // 方案 2 (回退): 通过 apiKey → GetUserStatus
        if (!result.promptCredits && !result.flowCredits && account.apiKey) {
            try {
                this.log('正在通过 API Key 查询配额...');
                const userStatusResp = await this.getUserStatus(apiServerUrl, account.apiKey);
                result = this._parseUserStatusQuota(userStatusResp);
            }
            catch (err) {
                this.log(`GetUserStatus 方式也失败: ${err.message}`);
            }
        }
        // 方案 3: 通过 Cloud Code API 获取每日/每周模型级配额
        if (idToken) {
            try {
                this.log('正在查询模型级配额...');
                const modelQuotas = await this.fetchModelQuotas(idToken);
                result.modelQuotas = modelQuotas;
            }
            catch (err) {
                this.log(`模型配额查询失败: ${err.message}`);
            }
        }
        if (!result.promptCredits && !result.flowCredits && !result.modelQuotas) {
            throw new Error('配额查询失败，请检查账号凭证');
        }
        return result;
    }
    /**
     * 调用 Google Cloud Code API 获取模型级配额 (daily/weekly)
     */
    async fetchModelQuotas(idToken) {
        const baseUrl = 'https://daily-cloudcode-pa.googleapis.com';
        const ideVersion = '1.48.2';
        const metadata = {
            ide_type: 'ANTIGRAVITY',
            ide_version: ideVersion,
            ide_name: 'antigravity'
        };
        // Step 1: loadCodeAssist 获取 project ID
        this.log('正在获取项目信息...');
        const loadResp = await this._cloudCodePost(baseUrl, 'v1internal:loadCodeAssist', { metadata }, idToken, ideVersion);
        this.log('[DEBUG] loadCodeAssist raw: ' + JSON.stringify(loadResp).substring(0, 500));
        const projectId = loadResp.cloudaicompanionProject || loadResp.cloudAiCompanionProject;
        if (!projectId) {
            throw new Error('未获取到 project ID');
        }
        // Step 2: fetchAvailableModels 获取每模型配额
        this.log('正在查询模型配额...');
        const modelsResp = await this._cloudCodePost(baseUrl, 'v1internal:fetchAvailableModels', {
            metadata,
            cloudaicompanionProject: projectId
        }, idToken, ideVersion);
        this.log('[DEBUG] fetchAvailableModels raw: ' + JSON.stringify(modelsResp).substring(0, 800));
        return this._parseModelQuotas(modelsResp, loadResp);
    }
    /**
     * Cloud Code API POST 请求
     */
    async _cloudCodePost(baseUrl, path, body, bearerToken, ideVersion) {
        const url = `${baseUrl}/${path}`;
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const postData = JSON.stringify(body);
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Bearer ${bearerToken}`,
                    'User-Agent': `antigravity/${ideVersion} ${process.platform}/amd64 google-api-nodejs-client/10.3.0`,
                    'Accept': 'application/json'
                },
                timeout: FIREBASE_CONFIG.REQUEST_TIMEOUT
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                        }
                    } catch {
                        reject(new Error(`Invalid response: ${data.substring(0, 200)}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Cloud Code API timeout')); });
            req.write(postData);
            req.end();
        });
    }
    /**
     * 解析模型级配额，分为 daily 和 weekly 两组
     */
    _parseModelQuotas(modelsResp, loadResp) {
        const models = modelsResp.models || {};
        const daily = [];
        const weekly = [];
        const now = Date.now();
        for (const [key, model] of Object.entries(models)) {
            const qi = model.quotaInfo || model.quota_info;
            if (!qi) continue;
            const frac = qi.remainingFraction !== undefined ? qi.remainingFraction : qi.remaining_fraction;
            if (frac === undefined || frac === null) continue;
            const resetTime = qi.resetTime || qi.reset_time;
            const resetMs = this._parseTimestamp(resetTime);
            const percent = Math.round(frac * 100);
            const displayName = model.displayName || model.display_name || key;
            const entry = { name: displayName, key, percent, resetAt: resetMs };
            // 根据重置时间间隔区分 daily/weekly: <36小时算 daily，否则 weekly
            if (resetMs) {
                const hoursUntilReset = (resetMs - now) / (1000 * 60 * 60);
                if (hoursUntilReset <= 36) {
                    daily.push(entry);
                } else {
                    weekly.push(entry);
                }
            } else {
                daily.push(entry);
            }
        }
        // 提取 credits 信息
        let credits = null;
        const paidTier = loadResp.paidTier || loadResp.paid_tier;
        if (paidTier) {
            const availableCredits = paidTier.availableCredits || paidTier.available_credits || [];
            credits = {};
            for (const c of availableCredits) {
                const ctype = (c.creditType || c.credit_type || '').toUpperCase();
                const amount = Number(c.creditAmount || c.credit_amount || 0);
                credits[ctype] = amount;
            }
        }
        return {
            daily: daily.length > 0 ? daily : null,
            weekly: weekly.length > 0 ? weekly : null,
            dailyResetAt: daily.length > 0 ? daily[0].resetAt : null,
            weeklyResetAt: weekly.length > 0 ? weekly[0].resetAt : null,
            credits
        };
    }
    /**
     * 从 GetPlanStatus 响应解析配额
     */
    _parsePlanStatusQuota(resp) {
        this.log('[DEBUG] GetPlanStatus raw: ' + JSON.stringify(resp).substring(0, 500));
        const planStatus = resp.planStatus || resp;
        const planInfo = planStatus.planInfo || resp.planInfo || {};
        const availablePrompt = this._getNum(planStatus, 'availablePromptCredits', 'available_prompt_credits');
        const usedPrompt = this._getNum(planStatus, 'usedPromptCredits', 'used_prompt_credits');
        const availableFlow = this._getNum(planStatus, 'availableFlowCredits', 'available_flow_credits');
        const usedFlow = this._getNum(planStatus, 'usedFlowCredits', 'used_flow_credits');
        const planEnd = planStatus.planEnd || planStatus.plan_end;
        const planName = planInfo.planName || planInfo.plan_name || '';
        // 解析 billingStrategy
        const rawBilling = planInfo.billingStrategy || planInfo.billing_strategy;
        const isQuotaMode = rawBilling === 2 || rawBilling === 'BILLING_STRATEGY_QUOTA' || rawBilling === 'QUOTA';
        const billingStrategy = isQuotaMode ? 'quota' : 'credits';
        // 解析日/周配额百分比 (quota 模式)
        let quotaUsage = null;
        const dailyPercent = this._getNum(planStatus, 'dailyQuotaRemainingPercent', 'daily_quota_remaining_percent');
        const weeklyPercent = this._getNum(planStatus, 'weeklyQuotaRemainingPercent', 'weekly_quota_remaining_percent');
        if (dailyPercent !== null || weeklyPercent !== null) {
            quotaUsage = {
                dailyRemainingPercent: dailyPercent ?? 0,
                weeklyRemainingPercent: weeklyPercent ?? 0,
                overageBalanceMicros: this._getNum(planStatus, 'overageBalanceMicros', 'overage_balance_micros') || 0,
                dailyResetAtUnix: this._getNum(planStatus, 'dailyQuotaResetAtUnix', 'daily_quota_reset_at_unix') || 0,
                weeklyResetAtUnix: this._getNum(planStatus, 'weeklyQuotaResetAtUnix', 'weekly_quota_reset_at_unix') || 0
            };
        }
        return {
            planName,
            promptCredits: availablePrompt !== null ? {
                remaining: availablePrompt - (usedPrompt || 0),
                used: usedPrompt || 0,
                total: availablePrompt
            } : null,
            flowCredits: availableFlow !== null ? {
                remaining: availableFlow - (usedFlow || 0),
                used: usedFlow || 0,
                total: availableFlow
            } : null,
            resetAt: planEnd ? this._parseTimestamp(planEnd) : null,
            source: 'GetPlanStatus',
            billingStrategy,
            quotaUsage
        };
    }
    /**
     * 从 GetUserStatus 响应解析配额
     */
    _parseUserStatusQuota(resp) {
        this.log('[DEBUG] GetUserStatus raw: ' + JSON.stringify(resp).substring(0, 500));
        const userStatus = resp.userStatus || resp;
        const planStatus = userStatus.planStatus || resp.planStatus || {};
        const planInfo = planStatus.planInfo || userStatus.planInfo || {};
        const availablePrompt = this._getNum(planStatus, 'availablePromptCredits', 'available_prompt_credits');
        const usedPrompt = this._getNum(planStatus, 'usedPromptCredits', 'used_prompt_credits');
        const availableFlow = this._getNum(planStatus, 'availableFlowCredits', 'available_flow_credits');
        const usedFlow = this._getNum(planStatus, 'usedFlowCredits', 'used_flow_credits');
        const planEnd = planStatus.planEnd || planStatus.plan_end;
        const planName = planInfo.planName || planInfo.plan_name || '';
        // 解析 billingStrategy (与 _parsePlanStatusQuota 相同逻辑)
        const rawBilling = planInfo.billingStrategy || planInfo.billing_strategy;
        const isQuotaMode = rawBilling === 2 || rawBilling === 'BILLING_STRATEGY_QUOTA' || rawBilling === 'QUOTA';
        const billingStrategy = isQuotaMode ? 'quota' : 'credits';
        // 解析 quotaUsage (UserStatus 的 planStatus 也可能包含日/周百分比)
        let quotaUsage = null;
        const dailyPercent = this._getNum(planStatus, 'dailyQuotaRemainingPercent', 'daily_quota_remaining_percent');
        const weeklyPercent = this._getNum(planStatus, 'weeklyQuotaRemainingPercent', 'weekly_quota_remaining_percent');
        if (dailyPercent !== null || weeklyPercent !== null) {
            quotaUsage = {
                dailyRemainingPercent: dailyPercent ?? 0,
                weeklyRemainingPercent: weeklyPercent ?? 0,
                overageBalanceMicros: this._getNum(planStatus, 'overageBalanceMicros', 'overage_balance_micros') || 0,
                dailyResetAtUnix: this._getNum(planStatus, 'dailyQuotaResetAtUnix', 'daily_quota_reset_at_unix') || 0,
                weeklyResetAtUnix: this._getNum(planStatus, 'weeklyQuotaResetAtUnix', 'weekly_quota_reset_at_unix') || 0
            };
        }
        return {
            planName,
            promptCredits: availablePrompt !== null ? {
                remaining: availablePrompt - (usedPrompt || 0),
                used: usedPrompt || 0,
                total: availablePrompt
            } : null,
            flowCredits: availableFlow !== null ? {
                remaining: availableFlow - (usedFlow || 0),
                used: usedFlow || 0,
                total: availableFlow
            } : null,
            resetAt: planEnd ? this._parseTimestamp(planEnd) : null,
            source: 'GetUserStatus',
            billingStrategy,
            quotaUsage
        };
    }
    /**
     * 辅助：从对象中获取数字字段
     */
    _getNum(obj, ...keys) {
        if (!obj) return null;
        for (const key of keys) {
            const val = obj[key];
            if (val !== undefined && val !== null) {
                const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                if (isFinite(num)) return num;
            }
        }
        return null;
    }
    /**
     * 辅助：解析 protobuf 时间戳 (多种格式)
     */
    _parseTimestamp(val) {
        if (!val) return null;
        // ISO 8601 字符串 (如 "2025-02-01T00:00:00Z")
        if (typeof val === 'string' && val.includes('-')) {
            const d = new Date(val);
            if (!isNaN(d.getTime()) && d.getTime() > 0) return d.getTime();
        }
        // 数字：判断秒还是毫秒 (秒 < 1e11, 毫秒 >= 1e11)
        if (typeof val === 'number') {
            if (val <= 0) return null;
            return val < 1e11 ? val * 1000 : val;
        }
        // 纯数字字符串
        if (typeof val === 'string') {
            const n = parseFloat(val);
            if (isFinite(n) && n > 0) return n < 1e11 ? n * 1000 : n;
        }
        // protobuf Timestamp 对象 {seconds: xxx}
        if (val && typeof val === 'object') {
            const s = val.seconds;
            if (s !== undefined) {
                const num = typeof s === 'string' ? parseFloat(s) : Number(s);
                if (isFinite(num) && num > 0) return num < 1e11 ? num * 1000 : num;
            }
        }
        return null;
    }
}
exports.ApiHelper = ApiHelper;
//# sourceMappingURL=apiHelper.js.map