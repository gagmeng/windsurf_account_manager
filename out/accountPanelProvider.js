"use strict";
/**
 * accountPanelProvider.ts - 账号管理面板 WebView 提供者
 * 提供可视化的账号管理界面
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
exports.AccountPanelProvider = void 0;
const vscode = __importStar(require("vscode"));
const apiHelper_1 = require("./apiHelper");
const databaseHelper_1 = require("./databaseHelper");
const injectService_1 = require("./injectService");
/**
 * 账号面板提供者
 */
class AccountPanelProvider {
    constructor(_extensionUri, accountManager, accountSwitcher) {
        this._extensionUri = _extensionUri;
        this._accountManager = accountManager;
        this._accountSwitcher = accountSwitcher;
        this._quotaCache = {};
    }
    /**
     * 解析 WebView
     */
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // 处理来自 WebView 的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'getAccounts':
                    await this._sendAccountList();
                    break;
                case 'getCurrentAccount':
                    await this._sendCurrentAccount();
                    break;
                case 'switchAccount':
                    await this._switchAccount(data.accountId);
                    break;
                case 'switchNextAccount':
                    await this._switchNextAccount();
                    break;
                case 'addAccountByLogin':
                    await this._addAccountByLogin(data.email, data.password, data.accountType);
                    break;
                case 'addAccountManual':
                    await this._addAccountManual(data);
                    break;
                case 'deleteAccount':
                    await this._deleteAccount(data.accountId);
                    break;
                case 'copyApiKey':
                    await this._copyApiKey(data.accountId);
                    break;
                case 'deleteAccountsByType':
                    await this._deleteAccountsByType(data.accountType);
                    break;
                case 'confirmDelete':
                    await this._confirmAndDeleteAccount(data.accountId);
                    break;
                case 'confirmDeleteByType':
                    await this._confirmAndDeleteByType(data.accountType);
                    break;
                case 'getRefreshSetting':
                    await this._sendRefreshSetting();
                    break;
                case 'setRefreshSetting':
                    await this._setRefreshSetting(data.value);
                    break;
                case 'resetMachineId':
                    await this._resetMachineId();
                    break;
                case 'fetchQuota':
                    await this._fetchQuota(data.accountId);
                    break;
                case 'fetchCurrentQuota':
                    await this._fetchCurrentQuota();
                    break;
                case 'getQuotaCache':
                    this._sendQuotaCache();
                    break;
                case 'exportAccounts':
                    await this._exportAccounts();
                    break;
                case 'importAccounts':
                    await this._importAccounts();
                    break;
                case 'injectPro':
                    await this._injectPro();
                    break;
            }
        });
        // 初始加载数据
        this._sendAccountList();
        this._sendCurrentAccount();
        this._sendQuotaCache();
    }
    /**
     * 刷新面板
     */
    refresh() {
        if (this._view) {
            this._sendAccountList();
            this._sendCurrentAccount();
        }
    }
    /**
     * 发送账号列表到 WebView
     */
    async _sendAccountList() {
        if (!this._view)
            return;
        const accounts = await this._accountManager.getAccounts();
        const _deriveType = (acc) => {
            const pn = (acc.planName || '').toLowerCase();
            if (pn === 'teams') return 'teams';
            if (pn === 'enterprise') return 'enterprise';
            if (pn === 'pro') return 'pro';
            if (pn === 'trial') return 'trial';
            if (pn === 'free') return 'free';
            return acc.accountType || 'OTHER';
        };
        this._view.webview.postMessage({
            type: 'accountList',
            accounts: accounts.map(acc => ({
                id: acc.id,
                email: acc.email,
                name: acc.name,
                apiKey: acc.apiKey,
                planName: acc.planName,
                accountType: _deriveType(acc)
            }))
        });
    }
    /**
     * 发送当前账号到 WebView
     */
    async _sendCurrentAccount() {
        if (!this._view)
            return;
        const current = await this._accountSwitcher.getCurrentAccount();
        let account = null;
        if (current) {
            account = { email: current.email || '', name: current.name || '', apiKey: current.apiKey || '' };
            // 如果缺少 email/name，尝试通过 apiKey 匹配已保存的账号
            if (current.apiKey && (!account.email || !account.name)) {
                try {
                    const allAccounts = await this._accountManager.getAccounts();
                    const matched = allAccounts.find(acc => acc.apiKey === current.apiKey);
                    if (matched) {
                        account.email = account.email || matched.email || '';
                        account.name = account.name || matched.name || '';
                    }
                }
                catch (e) {
                    console.error('[AccountPanel] 匹配账号失败:', e);
                }
            }
        }
        this._view.webview.postMessage({
            type: 'currentAccount',
            account: account && (account.email || account.name) ? account : null
        });
    }
    /**
     * 重置机器码
     */
    async _resetMachineId() {
        try {
            this._sendMessage('info', '正在重置机器码...');
            const machineIdReset = require("./machineIdReset");
            const ids = await machineIdReset.MachineIdResetter.resetMachineId();
            this._sendMessage('success', `机器码已重置: ${ids.machineId.substring(0, 16)}...`);
        }
        catch (error) {
            this._sendMessage('error', `重置失败: ${error.message}`);
        }
    }
    /**
     * Pro 注入 (注入实验 flags + Pro 用户状态到本地 LS)
     */
    async _injectPro() {
        try {
            this._sendMessage('info', '正在注入 Pro 实验...');
            // 获取当前账号的 apiKey
            let apiKey = '';
            try {
                const current = await this._accountSwitcher.getCurrentAccount();
                if (current && current.apiKey) {
                    apiKey = current.apiKey;
                }
            } catch { }
            const injector = new injectService_1.InjectService((msg) => {
                this._sendMessage('info', msg);
            });
            const result = await injector.inject(apiKey);
            if (result.success) {
                this._sendMessage('success', `注入成功！${result.message || ''}`);
            } else {
                this._sendMessage('error', `注入失败: ${result.error || result.message || '未知错误'}`);
            }
        }
        catch (error) {
            this._sendMessage('error', `注入异常: ${error.message}`);
        }
    }
    /**
     * 切换账号
     */
    async _switchAccount(accountId) {
        const account = await this._accountManager.getAccount(accountId);
        if (!account) {
            this._sendMessage('error', '账号不存在');
            return;
        }
        const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', false);
        this._sendMessage('info', '正在切换账号...');
        const result = await this._accountSwitcher.switchAccount(account, refreshOnSwitch);
        if (result.success) {
            // 立即更新当前账号显示
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'currentAccount',
                    account: { email: account.email, name: account.name }
                });
            }
            await this._sendAccountList();
            if (refreshOnSwitch) {
                this._sendMessage('success', '切换成功，窗口即将重载...');
            }
            else {
                this._sendMessage('success', '切换成功（无刷新模式）');
            }
        }
        else {
            this._sendMessage('error', `切换失败: ${result.error}`);
        }
    }
    /**
     * 切换到下一个账号
     */
    async _switchNextAccount() {
        const accounts = await this._accountManager.getAccounts();
        if (accounts.length === 0) {
            this._sendMessage('error', '没有可切换的账号，请先添加账号');
            return;
        }
        if (accounts.length === 1) {
            this._sendMessage('info', '只有一个账号，无需切换');
            return;
        }
        const { account, index } = await this._accountManager.getNextAccount();
        if (!account) {
            this._sendMessage('error', '获取下一个账号失败');
            return;
        }
        this._sendMessage('info', `正在切换到: ${account.email} (${index + 1}/${accounts.length})`);
        const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', false);
        const result = await this._accountSwitcher.switchAccount(account, refreshOnSwitch);
        if (result.success) {
            await this._accountManager.setCurrentAccountIndex(index);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'currentAccount',
                    account: { email: account.email, name: account.name }
                });
            }
            await this._sendAccountList();
            if (refreshOnSwitch) {
                this._sendMessage('success', `已切换到: ${account.email}，窗口即将重载...`);
            } else {
                this._sendMessage('success', `已切换到: ${account.email}`);
            }
        } else if (result.needsRestart) {
            await this._accountManager.setCurrentAccountIndex(index);
        } else {
            this._sendMessage('error', `切换失败: ${result.error}`);
        }
    }
    /**
     * 通过登录添加账号（Firebase Auth）
     */
    async _addAccountByLogin(email, password, accountType) {
        if (!email || !password) {
            this._sendMessage('error', '请输入邮箱和密码');
            return;
        }
        // 登录前去重检查
        const existingAccounts = await this._accountManager.getAccounts();
        const existingAccount = existingAccounts.find(acc => acc.email === email);
        if (existingAccount) {
            this._sendMessage('info', `账号 ${email} 已存在，正在刷新凭证...`);
        }
        else {
            this._sendMessage('info', '正在登录...');
        }
        const apiHelper = new apiHelper_1.ApiHelper((msg) => {
            this._sendMessage('info', msg);
        });
        const result = await apiHelper.login(email, password);
        if (result.success) {
            // 自动检测账号类型：通过 idToken 调用 GetPlanStatus
            let detectedPlanName = '';
            let detectedType = '';
            if (result.idToken) {
                try {
                    this._sendMessage('info', '正在检测账号类型...');
                    const planResp = await apiHelper.getPlanStatusJson(result.idToken);
                    const planStatus = planResp.planStatus || planResp;
                    const planInfo = planStatus.planInfo || planResp.planInfo || {};
                    detectedPlanName = planInfo.planName || planInfo.plan_name || '';
                    const pn = detectedPlanName.toLowerCase();
                    if (pn === 'teams') detectedType = 'teams';
                    else if (pn === 'enterprise') detectedType = 'enterprise';
                    else if (pn === 'pro') detectedType = 'pro';
                    else if (pn === 'trial') detectedType = 'trial';
                    else if (pn === 'free') detectedType = 'free';
                    this._sendMessage('info', `检测到账号类型: ${detectedPlanName || '未知'}`);
                } catch (e) {
                    console.log('[AccountPanel] 自动检测账号类型失败:', e.message);
                }
            }
            // 手动选择的类型作为后备
            const finalType = detectedType || accountType || '';
            const finalPlanName = detectedPlanName || (finalType ? finalType.charAt(0).toUpperCase() + finalType.slice(1).toLowerCase() : '');
            // 去重：按邮箱或 apiKey 匹配已有账号
            const existingAccounts = await this._accountManager.getAccounts();
            const existingByEmail = existingAccounts.find(acc => acc.email === result.email);
            const existingByKey = !existingByEmail ? existingAccounts.find(acc => acc.apiKey && acc.apiKey === result.apiKey) : null;
            const existing = existingByEmail || existingByKey;
            if (existing) {
                // 已有账号，更新信息
                await this._accountManager.updateAccount(existing.id, {
                    name: result.name,
                    apiKey: result.apiKey,
                    apiServerUrl: result.apiServerUrl,
                    refreshToken: result.refreshToken,
                    planName: finalPlanName,
                    accountType: finalType
                });
                this._sendMessage('success', `账号 ${result.email} 已更新！${finalPlanName ? '(' + finalPlanName + ')' : ''}`);
            }
            else {
                await this._accountManager.addAccount({
                    email: result.email,
                    name: result.name,
                    apiKey: result.apiKey,
                    apiServerUrl: result.apiServerUrl,
                    refreshToken: result.refreshToken,
                    planName: finalPlanName,
                    accountType: finalType
                });
                this._sendMessage('success', `账号 ${result.email} 添加成功！${finalPlanName ? '(' + finalPlanName + ')' : ''}`);
            }
            await this._sendAccountList();
        }
        else {
            this._sendMessage('error', `登录失败: ${result.error}`);
        }
    }
    /**
     * 手动添加账号（直接输入 API Key）
     */
    async _addAccountManual(accountData) {
        if (!accountData.email || !accountData.apiKey) {
            this._sendMessage('error', '邮箱和 API Key 为必填项');
            return;
        }
        try {
            // 去重：按邮箱或 apiKey 匹配
            const existingAccounts = await this._accountManager.getAccounts();
            const existingByEmail = existingAccounts.find(acc => acc.email === accountData.email);
            const existingByKey = !existingByEmail ? existingAccounts.find(acc => acc.apiKey && acc.apiKey === accountData.apiKey) : null;
            const existing = existingByEmail || existingByKey;
            if (existing) {
                await this._accountManager.updateAccount(existing.id, {
                    name: accountData.name || accountData.email.split('@')[0],
                    apiKey: accountData.apiKey,
                    apiServerUrl: accountData.apiServerUrl || 'https://server.self-serve.windsurf.com',
                    planName: accountData.accountType ? accountData.accountType.charAt(0).toUpperCase() + accountData.accountType.slice(1).toLowerCase() : '',
                    accountType: accountData.accountType
                });
                this._sendMessage('success', `账号 ${accountData.email} 已更新！`);
            }
            else {
                await this._accountManager.addAccount({
                    email: accountData.email,
                    name: accountData.name || accountData.email.split('@')[0],
                    apiKey: accountData.apiKey,
                    apiServerUrl: accountData.apiServerUrl || 'https://server.self-serve.windsurf.com',
                    refreshToken: '',
                    planName: accountData.accountType ? accountData.accountType.charAt(0).toUpperCase() + accountData.accountType.slice(1).toLowerCase() : '',
                    accountType: accountData.accountType
                });
                this._sendMessage('success', `账号 ${accountData.email} 添加成功！`);
            }
            await this._sendAccountList();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            this._sendMessage('error', `添加失败: ${errorMessage}`);
        }
    }
    /**
     * 删除账号
     */
    async _deleteAccount(accountId) {
        const account = await this._accountManager.getAccount(accountId);
        if (!account) {
            this._sendMessage('error', '账号不存在');
            return;
        }
        await this._accountManager.removeAccount(accountId);
        this._sendMessage('success', `账号 ${account.email} 已删除`);
        await this._sendAccountList();
    }
    /**
     * 确认并删除单个账号
     */
    async _confirmAndDeleteAccount(accountId) {
        const account = await this._accountManager.getAccount(accountId);
        if (!account) {
            this._sendMessage('error', '账号不存在');
            return;
        }
        const confirm = await vscode.window.showWarningMessage(`确定删除账号 ${account.email} 吗？`, { modal: true }, '删除');
        if (confirm === '删除') {
            await this._deleteAccount(accountId);
        }
    }
    /**
     * 确认并按类型批量删除账号
     */
    async _confirmAndDeleteByType(accountType) {
        const accounts = await this._accountManager.getAccounts();
        const toDelete = accounts.filter(acc => (acc.accountType || 'OTHER') === accountType);
        if (toDelete.length === 0) {
            this._sendMessage('info', `没有 ${accountType} 类型的账号`);
            return;
        }
        const confirm = await vscode.window.showWarningMessage(`确定删除所有 ${accountType} 类型的账号吗？(共 ${toDelete.length} 个)`, { modal: true }, '删除');
        if (confirm === '删除') {
            await this._deleteAccountsByType(accountType);
        }
    }
    /**
     * 按类型批量删除账号
     */
    async _deleteAccountsByType(accountType) {
        const accounts = await this._accountManager.getAccounts();
        const toDelete = accounts.filter(acc => (acc.accountType || 'OTHER') === accountType);
        if (toDelete.length === 0) {
            this._sendMessage('info', `没有 ${accountType} 类型的账号`);
            return;
        }
        for (const acc of toDelete) {
            await this._accountManager.removeAccount(acc.id);
        }
        this._sendMessage('success', `已删除 ${toDelete.length} 个 ${accountType} 类型账号`);
        await this._sendAccountList();
    }
    /**
     * 复制 API Key
     */
    async _copyApiKey(accountId) {
        const account = await this._accountManager.getAccount(accountId);
        if (!account) {
            this._sendMessage('error', '账号不存在');
            return;
        }
        const typeMap = { trial: 'Trial', pro: 'Pro', free: 'Free', enterprise: 'Enterprise', teams: 'Teams' };
        const lines = [];
        if (account.email) lines.push(`邮箱: ${account.email}`);
        if (account.name && account.name !== account.email) lines.push(`名称: ${account.name}`);
        const typeLabel = typeMap[(account.accountType || '').toLowerCase()] || account.accountType || '';
        if (typeLabel) lines.push(`类型: ${typeLabel}`);
        if (account.apiKey) lines.push(`API Key: ${account.apiKey}`);
        if (account.refreshToken) lines.push(`Refresh Token: ${account.refreshToken}`);
        await vscode.env.clipboard.writeText(lines.join('\n'));
        this._sendMessage('success', '账号信息已复制');
    }
    /**
     * 发送消息到 WebView
     */
    _sendMessage(msgType, text) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'message', msgType, text });
        }
    }
    /**
     * 查询指定账号的配额
     */
    async _fetchQuota(accountId) {
        const account = await this._accountManager.getAccount(accountId);
        if (!account) {
            this._sendMessage('error', '账号不存在');
            return;
        }
        this._sendMessage('info', `正在查询 ${account.email} 的配额...`);
        const apiHelper = new apiHelper_1.ApiHelper((msg) => {
            this._sendMessage('info', msg);
        });
        try {
            const quota = await apiHelper.fetchQuota(account);
            // 自动更新账号的 planName 和 accountType
            if (quota && quota.planName && quota.planName !== account.planName) {
                const pn = quota.planName;
                const at = pn.toLowerCase() === 'trial' ? 'trial'
                    : pn.toLowerCase() === 'pro' ? 'pro'
                    : pn.toLowerCase() === 'free' ? 'free'
                    : pn.toLowerCase() === 'enterprise' ? 'enterprise'
                    : pn.toLowerCase() === 'teams' ? 'teams'
                    : account.accountType || '';
                await this._accountManager.updateAccount(accountId, { planName: pn, accountType: at });
                await this._sendAccountList();
            }
            // 缓存配额到扩展端
            if (quota) {
                this._quotaCache[accountId] = quota;
            }
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'quotaResult',
                    accountId: accountId,
                    quota: quota
                });
            }
            this._sendMessage('success', '配额查询成功');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            this._sendMessage('error', `配额查询失败: ${errorMessage}`);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'quotaResult',
                    accountId: accountId,
                    quota: null,
                    error: errorMessage
                });
            }
        }
    }
    /**
     * 查询当前账号的配额
     */
    async _fetchCurrentQuota() {
        this._sendMessage('info', '正在查询配额...');
        // 优先通过 API 查询
        const current = await this._accountSwitcher.getCurrentAccount();
        if (!current || !current.apiKey) {
            this._sendMessage('info', '当前未登录');
            return;
        }
        const allAccounts = await this._accountManager.getAccounts();
        const matched = allAccounts.find(acc => acc.apiKey === current.apiKey);
        if (matched) {
            await this._fetchQuota(matched.id);
        }
        else {
            this._sendMessage('info', '正在通过 API 查询配额...');
            const apiHelper = new apiHelper_1.ApiHelper((msg) => {
                this._sendMessage('info', msg);
            });
            try {
                const quota = await apiHelper.fetchQuota({
                    apiKey: current.apiKey,
                    apiServerUrl: current.apiServerUrl || 'https://server.codeium.com',
                    refreshToken: ''
                });
                // 缓存配额到扩展端
                if (quota) {
                    this._quotaCache['__current__'] = quota;
                }
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'currentQuota',
                        quota: quota
                    });
                }
                this._sendMessage('success', '配额查询成功');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                this._sendMessage('error', `配额查询失败: ${errorMessage}`);
            }
        }
    }
    /**
     * 解析 Windsurf 本地缓存的 planInfo
     */
    _parseCachedPlanInfo(info) {
        const usage = info.usage || {};
        const messages = usage.messages || 0;
        const usedMessages = usage.usedMessages || 0;
        const remainingMessages = usage.remainingMessages !== undefined ? usage.remainingMessages : (messages - usedMessages);
        const flowActions = usage.flowActions || 0;
        const usedFlowActions = usage.usedFlowActions || 0;
        const remainingFlowActions = usage.remainingFlowActions !== undefined ? usage.remainingFlowActions : (flowActions - usedFlowActions);
        const flexCredits = usage.flexCredits || 0;
        const usedFlexCredits = usage.usedFlexCredits || 0;
        const remainingFlexCredits = usage.remainingFlexCredits !== undefined ? usage.remainingFlexCredits : (flexCredits - usedFlexCredits);
        return {
            planName: info.planName || '',
            promptCredits: messages > 0 ? {
                remaining: remainingMessages,
                used: usedMessages,
                total: messages
            } : null,
            flowCredits: flowActions > 0 ? {
                remaining: remainingFlowActions,
                used: usedFlowActions,
                total: flowActions
            } : null,
            flexCredits: flexCredits > 0 ? {
                remaining: remainingFlexCredits,
                used: usedFlexCredits,
                total: flexCredits
            } : null,
            // 本地缓存：用 counts 计算百分比，避免被当作 credits 处理
            quotaUsage: (messages > 0 || flowActions > 0) ? {
                dailyRemainingPercent: messages > 0 ? Math.round(remainingMessages / messages * 100) : 100,
                weeklyRemainingPercent: flowActions > 0 ? Math.round(remainingFlowActions / flowActions * 100) : 100,
            } : null,
            billingStrategy: 'quota',
            startAt: info.startTimestamp || null,
            endAt: info.endTimestamp || null,
            source: 'local'
        };
    }
    /**
     * 发送缓存的配额数据到 WebView
     */
    _sendQuotaCache() {
        if (!this._view || Object.keys(this._quotaCache).length === 0)
            return;
        this._view.webview.postMessage({
            type: 'quotaCacheRestore',
            cache: this._quotaCache
        });
    }
    /**
     * 发送刷新设置到 WebView
     */
    async _sendRefreshSetting() {
        if (!this._view)
            return;
        const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', false);
        this._view.webview.postMessage({
            type: 'refreshSetting',
            value: refreshOnSwitch
        });
    }
    /**
     * 设置刷新选项
     */
    async _setRefreshSetting(value) {
        await vscode.workspace.getConfiguration().update('aceSwitch.refreshOnSwitch', value, vscode.ConfigurationTarget.Global);
        this._sendMessage('success', value ? '已开启切换后刷新' : '已关闭切换后刷新');
    }
    /**
     * 导出所有账号到 JSON 文件
     */
    async _exportAccounts() {
        try {
            const accounts = await this._accountManager.getAccounts();
            if (accounts.length === 0) {
                this._sendMessage('error', '没有可导出的账号');
                return;
            }
            const exportData = accounts.map(acc => ({
                email: acc.email,
                name: acc.name,
                apiKey: acc.apiKey,
                apiServerUrl: acc.apiServerUrl,
                refreshToken: acc.refreshToken,
                planName: acc.planName,
                accountType: acc.accountType
            }));
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('windsurf_accounts.json'),
                filters: { 'JSON': ['json'] },
                title: '导出账号数据'
            });
            if (uri) {
                const content = JSON.stringify(exportData, null, 2);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
                this._sendMessage('success', `已导出 ${accounts.length} 个账号到: ${uri.fsPath}`);
            }
        }
        catch (error) {
            this._sendMessage('error', `导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    /**
     * 从 JSON 文件导入账号
     */
    async _importAccounts() {
        try {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                title: '导入账号数据'
            });
            if (!uris || uris.length === 0)
                return;
            const fileContent = await vscode.workspace.fs.readFile(uris[0]);
            const jsonStr = Buffer.from(fileContent).toString('utf-8');
            const count = await this._accountManager.importAccounts(jsonStr);
            if (count > 0) {
                this._sendMessage('success', `成功导入 ${count} 个账号`);
                await this._sendAccountList();
            }
            else {
                this._sendMessage('error', '未找到有效账号数据，请检查 JSON 格式');
            }
        }
        catch (error) {
            this._sendMessage('error', `导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    /**
     * 生成 WebView HTML
     */
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>账号管理</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .section {
      margin-bottom: 16px;
      flex-shrink: 0;
    }
    
    .section.account-list-section {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      margin-bottom: 0;
    }
    
    .toolbar-row {
      display: flex;
      gap: 6px;
    }
    .toolbar-btn {
      flex: 1;
      padding: 6px 8px;
      font-size: 12px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .toolbar-btn:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    .toolbar-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .toolbar-btn.primary:hover {
      background: var(--vscode-button-hoverBackground, #1a8cff);
    }
    
    .account-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    
    .current-account {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .current-account-row {
      font-size: 12px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .current-account-row .badge {
      color: #22c55e;
      margin-right: 4px;
    }
    
    .switch-next-btn {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--vscode-button-background);
      border-radius: 6px;
      background: transparent;
      color: var(--vscode-button-background);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .switch-next-btn:hover {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .shortcut-hint {
      font-size: 10px;
      opacity: 0.6;
      margin-left: 4px;
    }
    
    .account-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      gap: 8px;
    }
    
    .account-item:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    
    .account-item.current {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }
    
    .account-item .mini-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .account-item .mini-avatar.type-pro {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
    }
    .account-item .mini-avatar.type-free {
      background: linear-gradient(135deg, #6b7280, #4b5563);
      color: #fff;
    }
    .account-item .mini-avatar.type-enterprise {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #fff;
    }
    .account-item .mini-avatar.type-trial {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
    }
    .account-item .mini-avatar.type-teams {
      background: linear-gradient(135deg, #ec4899, #db2777);
      color: #fff;
    }
    .account-item .mini-avatar.type-other {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: #fff;
    }
    
    .account-item .info {
      flex: 1;
      min-width: 0;
    }
    
    .account-item .email {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .account-item .name {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .account-item .actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
      flex-shrink: 0;
    }
    
    .account-item:hover .actions {
      opacity: 1;
    }
    
    .account-item .quota-inline {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-top: 4px;
    }
    .quota-inline-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }
    .quota-inline-label {
      color: var(--vscode-descriptionForeground);
      width: 28px;
      flex-shrink: 0;
    }
    .quota-inline-bar {
      flex: 1;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
      min-width: 40px;
    }
    .quota-inline-bar-fill {
      height: 100%;
      border-radius: 2px;
    }
    .quota-inline-bar-fill.high { background: #22c55e; }
    .quota-inline-bar-fill.medium { background: #f59e0b; }
    .quota-inline-bar-fill.low { background: #ef4444; }
    .quota-inline-val {
      color: var(--vscode-descriptionForeground);
      width: 32px;
      text-align: right;
      flex-shrink: 0;
    }
    .quota-inline-expiry {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    
    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .add-form {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .add-form.show {
      display: flex;
    }
    
    .input {
      width: 100%;
      padding: 7px 10px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 13px;
      transition: border-color 0.15s;
    }
    
    .input:hover {
      border-color: var(--vscode-focusBorder);
    }
    
    .input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
    
    .input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    
    .form-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    
    .form-actions .btn {
      flex: 1;
    }
    
    .form-actions .btn-secondary {
      flex: 0 0 auto;
      padding: 8px 16px;
    }
    
    .message {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 12px;
      display: none;
      align-items: center;
      gap: 6px;
      animation: slideDown 0.2s ease;
    }
    
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .message.show {
      display: flex;
    }
    
    .message.info {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
    }
    
    .message.success {
      background: rgba(40, 167, 69, 0.15);
      border: 1px solid rgba(40, 167, 69, 0.4);
      color: #4caf50;
    }
    
    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }
    
    .empty-state {
      text-align: center;
      padding: 28px 12px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    
    .empty-state .icon {
      font-size: 36px;
      margin-bottom: 10px;
      opacity: 0.6;
    }
    
    .toggle-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      margin-bottom: 12px;
    }
    
    .toggle-label {
      font-size: 13px;
      color: var(--vscode-foreground);
    }
    
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      background: var(--vscode-input-background);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .toggle-switch.active {
      background: var(--vscode-button-background);
    }
    
    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--vscode-button-foreground);
      border-radius: 50%;
      transition: transform 0.2s;
    }
    
    .toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    .account-group {
      margin-bottom: 12px;
    }
    
    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-radius: 6px;
      margin-bottom: 4px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    
    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .group-header .group-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .group-header .type-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .group-header .type-dot.dot-pro { background: #3b82f6; }
    .group-header .type-dot.dot-free { background: #6b7280; }
    .group-header .type-dot.dot-enterprise { background: #f59e0b; }
    .group-header .type-dot.dot-trial { background: #10b981; }
    .group-header .type-dot.dot-teams { background: #ec4899; }
    .group-header .type-dot.dot-other { background: #8b5cf6; }
    
    .group-header .collapse-icon {
      transition: transform 0.2s;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    
    .group-header.collapsed .collapse-icon {
      transform: rotate(-90deg);
    }
    
    .account-group-items {
      overflow-y: auto;
      transition: max-height 0.3s ease;
      max-height: 400px;
    }
    
    .account-group-items.collapsed {
      max-height: 0 !important;
      overflow: hidden;
    }
    
    .group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground);
      letter-spacing: 0.5px;
    }
    
    .shortcut-container {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 10px 12px;
    }
    
    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    
    .shortcut-label {
      font-size: 12px;
      color: var(--vscode-foreground);
    }
    
    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .shortcut-key {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      white-space: nowrap;
    }
    
    .shortcut-divider {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
    
    .form-switch {
      text-align: center;
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-top: 8px;
      padding: 4px;
    }
    
    .form-switch:hover {
      text-decoration: underline;
    }
    
    .tip-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 6px;
      margin-bottom: 10px;
    }
    
    .tip-icon {
      font-size: 14px;
    }
    
    .tip-text {
      font-size: 11px;
      color: var(--vscode-foreground);
      opacity: 0.9;
    }

    .tool-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tool-card:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    .tool-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    .tool-info {
      flex: 1;
      min-width: 0;
    }
    .tool-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }
    .tool-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }
    .tool-arrow {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      flex-shrink: 0;
    }

    .quota-item {
      margin-bottom: 8px;
    }
    .quota-item:last-child {
      margin-bottom: 0;
    }
    .quota-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .quota-label-name {
      color: var(--vscode-foreground);
      font-weight: 500;
    }
    .quota-label-value {
      color: var(--vscode-descriptionForeground);
    }
    .quota-bar {
      width: 100%;
      height: 6px;
      background: var(--vscode-progressBar-background, rgba(255,255,255,0.1));
      border-radius: 3px;
      overflow: hidden;
    }
    .quota-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    .quota-bar-fill.high { background: #22c55e; }
    .quota-bar-fill.medium { background: #f59e0b; }
    .quota-bar-fill.low { background: #ef4444; }
    .quota-reset-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      text-align: right;
    }
    .quota-empty {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 8px;
    }
    .quota-group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin: 10px 0 6px;
      letter-spacing: 0.5px;
    }
    .quota-group-title:first-child {
      margin-top: 0;
    }
    .quota-model-name {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 2px;
    }

    /* === macOS Style Overrides === */
    body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', var(--vscode-font-family); padding: 10px 12px; }
    .toolbar-btn { border-radius: 8px; font-weight: 500; padding: 7px 10px; display:flex; align-items:center; justify-content:center; gap:5px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
    .toolbar-btn.primary { box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
    .current-account { border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); padding: 8px 12px; }
    .switch-next-btn { border-radius: 9px; font-weight: 500; letter-spacing: 0.2px; }
    .account-item { border-radius: 9px; padding: 9px 11px; transition: all 0.12s cubic-bezier(0.25,0.46,0.45,0.94); }
    .account-item:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.12); }
    .account-item .mini-avatar { width: 30px; height: 30px; border-radius: 8px; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .icon-btn { border-radius: 6px; width: 26px; height: 26px; }
    .icon-btn:hover { transform: scale(1.08); }
    .input { border-radius: 8px; padding: 8px 11px; }
    .input:focus { box-shadow: 0 0 0 2.5px rgba(0,122,255,0.22); }
    .btn { border-radius: 9px; font-weight: 500; }
    .group-header { border-radius: 9px; }
    .toggle-switch { border-radius: 14px; width: 44px; height: 24px; background: rgba(120,120,128,0.25); border: 1px solid rgba(120,120,128,0.3); outline: none; }
    .toggle-switch::after { width: 20px; height: 20px; top: 1px; left: 2px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.35); border-radius: 50%; }
    .toggle-switch.active::after { transform: translateX(20px); }
    .toggle-switch.active { background: #34c759; border-color: #2ab34a; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 10.5px; letter-spacing: 0.4px; }
    .message { border-radius: 9px; }
    .empty-state { padding: 32px 16px; }
    .svg-icon { display:inline-flex; align-items:center; flex-shrink:0; }
  </style>
</head>
<body>
  <div id="message" class="message"></div>
  
  <div class="section">
    <div class="section-title">当前账号</div>
    <div id="currentAccount" class="current-account">
      <div class="no-account">加载中...</div>
    </div>
    <button class="switch-next-btn" onclick="switchNextAccount()"><svg class="svg-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/></svg> 切换下一个账号 <span class="shortcut-hint" id="shortcutDisplay">Ctrl+Alt+K</span></button>
  </div>
  
  <div class="section toolbar-section">
    <div class="toolbar-row">
      <button class="toolbar-btn" onclick="resetMachineId()" title="重置机器码"><svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"/></svg> 重置机器码</button>
      <button class="toolbar-btn primary" id="addBtn" onclick="showLoginForm()" title="添加账号"><svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 添加账号</button>
    </div>
    <div class="toolbar-row" style="margin-top:6px;">
      <button class="toolbar-btn" onclick="exportAccounts()" title="导出所有账号信息到JSON文件"><svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 导出账号</button>
      <button class="toolbar-btn" onclick="importAccounts()" title="从JSON文件导入账号"><svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 导入账号</button>
    </div>
    <div class="toolbar-row" style="margin-top:6px;">
      <button class="toolbar-btn" onclick="injectPro()" title="点击执行 Pro 注入"><svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg> Pro 注入</button>
      <div class="toggle-container" style="margin:0;flex:1;justify-content:center;">
        <span class="toggle-label">切换后刷新窗口</span>
        <div id="refreshToggle" class="toggle-switch" onclick="toggleRefresh()"></div>
      </div>
    </div>
  </div>
  
  
  <div class="section" style="display:none;" id="addAccountSection">
    
    <!-- 登录模式表单 -->
    <div id="loginForm" class="add-form">
      <input type="email" id="loginEmailInput" class="input" placeholder="邮箱地址">
      <input type="password" id="loginPasswordInput" class="input" placeholder="密码">
      <div class="form-actions">
        <button class="btn btn-primary" onclick="submitLogin()">登录添加</button>
        <button class="btn btn-secondary" onclick="cancelAdd()">取消</button>
      </div>
      <div class="form-switch" onclick="switchToManual()">手动输入 API Key →</div>
    </div>
    
    <!-- 手动模式表单 -->
    <div id="manualForm" class="add-form">
      <input type="email" id="manualEmailInput" class="input" placeholder="邮箱地址 *">
      <input type="text" id="manualNameInput" class="input" placeholder="名称 (可选)">
      <input type="text" id="manualApiKeyInput" class="input" placeholder="API Key *">
      <input type="text" id="manualApiServerUrlInput" class="input" placeholder="API Server URL (可选)">
      <select id="manualAccountTypeInput" class="input">
        <option value="">选择账号类型 (可选)</option>
        <option value="enterprise">ENTERPRISE</option>
        <option value="teams">TEAMS</option>
        <option value="pro">PRO</option>
        <option value="trial">TRIAL</option>
        <option value="free">FREE</option>
      </select>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="submitManual()">添加</button>
        <button class="btn btn-secondary" onclick="cancelAdd()">取消</button>
      </div>
      <div class="form-switch" onclick="switchToLogin()">← 使用邮箱密码登录</div>
    </div>
    
  </div>
  
  <div class="section account-list-section">
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
      <span>账号列表</span>
      <button class="icon-btn" onclick="refreshAllQuotas()" title="一键刷新所有账号配额" style="width:auto;padding:3px 8px;font-size:11px;gap:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"/></svg> 刷新配额</button>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="搜索账号 (邮箱/名称)" oninput="handleSearch()">
    </div>
    <div id="searchResultInfo" class="search-result-info" style="display: none;"></div>
    <div id="accountList" class="account-list">
      <div class="empty-state">
        <div class="icon">📭</div>
        <div>暂无账号</div>
      </div>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    let accounts = [];
    let currentEmail = null;
    let currentApiKey = null;
    let currentName = null;
    let searchKeyword = '';
    let collapsedGroups = {}; // 记录分组折叠状态
    let quotaCache = {}; // accountId -> quota data
    
    // 请求数据
    vscode.postMessage({ type: 'getAccounts' });
    vscode.postMessage({ type: 'getCurrentAccount' });
    vscode.postMessage({ type: 'getRefreshSetting' });
    vscode.postMessage({ type: 'getQuotaCache' });
    // 配额将在 accountList + currentAccount 都就绪后自动查询
    let _initReady = { accounts: false, current: false, quotaFetched: false };
    function _checkAutoFetchQuota() {
      if (_initReady.accounts && _initReady.current && !_initReady.quotaFetched) {
        _initReady.quotaFetched = true;
        // 如果缓存已有数据，跳过自动查询
        if (Object.keys(quotaCache).length > 0) return;
        vscode.postMessage({ type: 'fetchCurrentQuota' });
      }
    }
    // 如果 currentQuota 比 accountList/currentAccount 先到，延迟重新匹配
    function _rematchCurrentQuota() {
      const q = quotaCache['__current__'];
      if (!q) return;
      let cur = _findCurrentAccount();
      if (cur && !quotaCache[cur.id]) {
        quotaCache[cur.id] = quotaCache['__current__'];
      }
    }
    // 多策略匹配当前账号：email → name → apiKey
    function _findCurrentAccount() {
      let cur = null;
      if (currentEmail) cur = accounts.find(a => a.email === currentEmail);
      if (!cur && currentName) cur = accounts.find(a => a.name === currentName);
      if (!cur && currentEmail) cur = accounts.find(a => a.name === currentEmail);
      if (!cur && currentApiKey) cur = accounts.find(a => a.apiKey === currentApiKey);
      return cur;
    }
    
    let quotaLoading = false;
    
    function refreshCurrentQuota() {
      if (quotaLoading) return;
      quotaLoading = true;
      vscode.postMessage({ type: 'fetchCurrentQuota' });
    }
    
    function refreshAccountQuota(accountId) {
      if (quotaLoading) return;
      quotaLoading = true;
      vscode.postMessage({ type: 'fetchQuota', accountId });
    }
    
    function getBarColor(percent) {
      if (percent > 50) return 'high';
      if (percent > 20) return 'medium';
      return 'low';
    }
    
    
    // 搜索处理函数
    function handleSearch() {
      searchKeyword = document.getElementById('searchInput').value.trim().toLowerCase();
      renderAccountList();
    }
    
    // 一键刷新所有账号配额
    let _refreshPending = 0;
    function refreshAllQuotas() {
      if (_refreshPending > 0) return;
      _refreshPending = 1 + accounts.length;
      vscode.postMessage({ type: 'fetchCurrentQuota' });
      accounts.forEach(acc => {
        vscode.postMessage({ type: 'fetchQuota', accountId: acc.id });
      });
    }
    
    // 切换分组折叠
    function toggleGroup(groupType) {
      collapsedGroups[groupType] = !collapsedGroups[groupType];
      renderAccountList();
    }
    
    // 接收消息
    window.addEventListener('message', event => {
      const data = event.data;
      
      switch (data.type) {
        case 'accountList':
          accounts = data.accounts;
          _initReady.accounts = true;
          // 账号列表到达后，重新匹配 __current__ 缓存
          if (quotaCache['__current__'] && accounts.length > 0) {
            let cur = _findCurrentAccount();
            if (cur && !quotaCache[cur.id]) {
              quotaCache[cur.id] = quotaCache['__current__'];
            }
          }
          renderAccountList();
          _checkAutoFetchQuota();
          _rematchCurrentQuota();
          break;
          
        case 'currentAccount':
          currentEmail = data.account?.email;
          currentApiKey = data.account?.apiKey;
          currentName = data.account?.name;
          renderCurrentAccount(data.account);
          renderAccountList();
          _initReady.current = true;
          _checkAutoFetchQuota();
          _rematchCurrentQuota();
          break;
          
        case 'message':
          showMessage(data.msgType, data.text);
          break;
          
        case 'refreshSetting':
          updateRefreshToggle(data.value);
          break;
          
        case 'quotaResult':
          quotaLoading = false;
          if (_refreshPending > 0) _refreshPending--;
          if (data.accountId && data.quota) {
            quotaCache[data.accountId] = data.quota;
            renderAccountList();
          }
          break;
          
        case 'currentQuota':
          quotaLoading = false;
          if (_refreshPending > 0) _refreshPending--;
          if (data.quota) {
            quotaCache['__current__'] = data.quota;
            let cur = _findCurrentAccount();
            if (cur) { quotaCache[cur.id] = data.quota; }
            renderAccountList();
          }
          break;
      }
    });
    
    function getInitial(str) {
      if (!str) return '?';
      return str.charAt(0).toUpperCase();
    }

    function renderCurrentAccount(account) {
      const el = document.getElementById('currentAccount');
      if (account) {
        const curEmail = account.email && account.email.includes('@') ? account.email : (account.name && account.name.includes('@') ? account.name : account.email);
        el.innerHTML = \`<div class="current-account-row"><span class="badge"><svg style="vertical-align:-2px" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg></span> \${curEmail || '未知账号'}</div>\`;
      } else {
        el.innerHTML = '<div class="no-account">未登录</div>';
      }
    }
    
    function renderAccountList() {
      const el = document.getElementById('accountList');
      const resultInfoEl = document.getElementById('searchResultInfo');
      
      // 根据搜索关键词过滤账号
      let filteredAccounts = accounts;
      if (searchKeyword) {
        filteredAccounts = accounts.filter(acc => 
          acc.email.toLowerCase().includes(searchKeyword) ||
          (acc.name && acc.name.toLowerCase().includes(searchKeyword))
        );
        
        // 显示搜索结果信息
        resultInfoEl.style.display = 'block';
        resultInfoEl.textContent = '找到 ' + filteredAccounts.length + ' 个匹配账号';
      } else {
        resultInfoEl.style.display = 'none';
      }
      
      if (filteredAccounts.length === 0) {
        if (searchKeyword) {
          el.innerHTML = '<div class="empty-state"><div class="icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div>未找到匹配 "' + searchKeyword + '" 的账号</div></div>';
        } else {
          el.innerHTML = '<div class="empty-state"><div class="icon"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div>暂无账号，点击上方添加</div></div>';
        }
        return;
      }
      
      // 按 accountType 分组
      const groups = {};
      filteredAccounts.forEach(acc => {
        const type = acc.accountType || 'OTHER';
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(acc);
      });
      
      // 按照固定顺序排列组
      const typeOrder = ['enterprise', 'teams', 'pro', 'trial', 'free', 'OTHER'];
      let html = '';
      
      typeOrder.forEach(type => {
        if (groups[type] && groups[type].length > 0) {
          const isCollapsed = collapsedGroups[type];
          html += '<div class="account-group">' +
            '<div class="group-header ' + (isCollapsed ? 'collapsed' : '') + '" onclick="toggleGroup(\'' + type + '\')">' +
            '<div class="group-left">' +
            '<span class="type-dot dot-' + type.toLowerCase() + '"></span>' +
            '<span class="collapse-icon">' + (isCollapsed ? '&#9658;' : '&#9660;') + '</span>' +
            '<span class="group-title">' + type.toUpperCase() + ' (' + groups[type].length + ')</span>' +
            '</div>' +
            '<button class="icon-btn" onclick="event.stopPropagation(); deleteAccountsByType(\'' + type + '\')" title="删除该类型所有账号"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg></button>' +
            '</div>' +
            '<div class="account-group-items ' + (isCollapsed ? 'collapsed' : '') + '">' +
            groups[type].map(acc => {
                  const q = quotaCache[acc.id];
                  let quotaHtml = '';
                  if (q) {
                    quotaHtml = '<div class="quota-inline">';
                    // 优先显示 quotaUsage (日/周用量百分比) 
                    if (q.quotaUsage) {
                      const dUsed = Math.round(100 - (q.quotaUsage.dailyRemainingPercent || 0));
                      const wUsed = Math.round(100 - (q.quotaUsage.weeklyRemainingPercent || 0));
                      const label1 = '日';
                      const label2 = '周';
                      quotaHtml += '<div class="quota-inline-row"><span class="quota-inline-label">' + label1 + '</span><div class="quota-inline-bar"><div class="quota-inline-bar-fill ' + getBarColor(100 - dUsed) + '" style="width:' + dUsed + '%"></div></div><span class="quota-inline-val">' + dUsed + '%</span></div>';
                      quotaHtml += '<div class="quota-inline-row"><span class="quota-inline-label">' + label2 + '</span><div class="quota-inline-bar"><div class="quota-inline-bar-fill ' + getBarColor(100 - wUsed) + '" style="width:' + wUsed + '%"></div></div><span class="quota-inline-val">' + wUsed + '%</span></div>';
                      // 日/周重置时间
                      if (q.quotaUsage.dailyResetAtUnix > 0) {
                        const dr = new Date(q.quotaUsage.dailyResetAtUnix * 1000);
                        quotaHtml += '<div class="quota-inline-expiry">日重置: ' + dr.toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) + '</div>';
                      }
                      if (q.quotaUsage.weeklyResetAtUnix > 0) {
                        const wr = new Date(q.quotaUsage.weeklyResetAtUnix * 1000);
                        quotaHtml += '<div class="quota-inline-expiry">周重置: ' + wr.toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) + '</div>';
                      }
                    } else if (q.billingStrategy === 'credits') {
                      // 明确的 Credits 模式: 显示 $余额
                      let totalRem = 0;
                      if (q.promptCredits) totalRem += q.promptCredits.remaining;
                      if (q.flowCredits) totalRem += q.flowCredits.remaining;
                      const bal = Math.floor(totalRem / 10) / 10;
                      quotaHtml += '<div class="quota-inline-row"><span class="quota-inline-label" style="color:#4ec9b0;font-weight:bold;">$' + bal + '</span></div>';
                    } else if (q.promptCredits || q.flowCredits) {
                      // 非 credits 模式但无 quotaUsage: 用 remaining/total 百分比显示
                      if (q.promptCredits && q.promptCredits.total > 0) {
                        const pctUsed = Math.round((q.promptCredits.used / q.promptCredits.total) * 100);
                        quotaHtml += '<div class="quota-inline-row"><span class="quota-inline-label">提示</span><div class="quota-inline-bar"><div class="quota-inline-bar-fill ' + getBarColor(100 - pctUsed) + '" style="width:' + pctUsed + '%"></div></div><span class="quota-inline-val">' + pctUsed + '%</span></div>';
                      }
                      if (q.flowCredits && q.flowCredits.total > 0) {
                        const pctUsed = Math.round((q.flowCredits.used / q.flowCredits.total) * 100);
                        quotaHtml += '<div class="quota-inline-row"><span class="quota-inline-label">Flow</span><div class="quota-inline-bar"><div class="quota-inline-bar-fill ' + getBarColor(100 - pctUsed) + '" style="width:' + pctUsed + '%"></div></div><span class="quota-inline-val">' + pctUsed + '%</span></div>';
                      }
                    }
                    // 到期日期
                    if (q.endAt) {
                      const d = new Date(q.endAt);
                      quotaHtml += '<div class="quota-inline-expiry">到期: ' + d.toLocaleDateString('zh-CN') + '</div>';
                    } else if (q.resetAt) {
                      const d = new Date(q.resetAt);
                      quotaHtml += '<div class="quota-inline-expiry">到期: ' + d.toLocaleDateString('zh-CN') + '</div>';
                    }
                    quotaHtml += '</div>';
                  }
                  const displayEmail = acc.email && acc.email.includes('@') ? acc.email : (acc.name && acc.name.includes('@') ? acc.name : acc.email);
                  const displayName = acc.email && acc.email.includes('@') ? (acc.name || '') : (acc.name && !acc.name.includes('@') ? acc.name : '');
                  return '<div class="account-item ' + (acc.email === currentEmail ? 'current' : '') + '" onclick="switchAccount(\'' + acc.id + '\')">' +
                    '<div class="mini-avatar type-' + (acc.accountType || 'other').toLowerCase() + '">' + getInitial(displayEmail) + '</div>' +
                    '<div class="info">' +
                    '<div class="email">' + displayEmail + '</div>' +
                    '<div class="name">' + displayName + (acc.planName ? ' &middot; ' + acc.planName : '') + '</div>' +
                    quotaHtml +
                    '</div>' +
                    '<div class="actions">' +
                    '<button class="icon-btn" onclick="event.stopPropagation(); refreshAccountQuota(\'' + acc.id + '\')" title="查询配额"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>' +
                    '<button class="icon-btn" onclick="event.stopPropagation(); copyApiKey(\'' + acc.id + '\')" title="复制账号信息"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5,15H4a2,2,0,0,1-2-2V4a2,2,0,0,1,2-2h9a2,2,0,0,1,2,2v1"/></svg></button>' +
                    '<button class="icon-btn" onclick="event.stopPropagation(); deleteAccount(\'' + acc.id + '\')" title="删除"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg></button>' +
                    '</div></div>';
              }).join('') +
              '</div>' +
            '</div>';
        }
      });
      
      el.innerHTML = html;
    }
    
    function deleteAccountsByType(accountType) {
      vscode.postMessage({ type: 'confirmDeleteByType', accountType });
    }
    
    function showLoginForm() {
      document.getElementById('addAccountSection').style.display = '';
      document.getElementById('loginForm').classList.add('show');
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('loginEmailInput').focus();
    }
    
    function showManualForm() {
      document.getElementById('addAccountSection').style.display = '';
      document.getElementById('manualForm').classList.add('show');
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('manualEmailInput').focus();
    }
    
    function switchToManual() {
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('manualForm').classList.add('show');
      document.getElementById('manualEmailInput').focus();
    }
    
    function switchToLogin() {
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('loginForm').classList.add('show');
      document.getElementById('loginEmailInput').focus();
    }
    
    function cancelAdd() {
      document.getElementById('loginForm').classList.remove('show');
      document.getElementById('manualForm').classList.remove('show');
      document.getElementById('addAccountSection').style.display = 'none';
      // 清空登录表单
      document.getElementById('loginEmailInput').value = '';
      document.getElementById('loginPasswordInput').value = '';
      // 清空手动表单
      document.getElementById('manualEmailInput').value = '';
      document.getElementById('manualNameInput').value = '';
      document.getElementById('manualApiKeyInput').value = '';
      document.getElementById('manualApiServerUrlInput').value = '';
      document.getElementById('manualAccountTypeInput').value = '';
    }
    
    function submitLogin() {
      const email = document.getElementById('loginEmailInput').value.trim();
      const password = document.getElementById('loginPasswordInput').value;
      
      if (!email || !password) {
        showMessage('error', '请输入邮箱和密码');
        return;
      }
      
      vscode.postMessage({ type: 'addAccountByLogin', email, password, accountType: '' });
      cancelAdd();
    }
    
    function submitManual() {
      const email = document.getElementById('manualEmailInput').value.trim();
      const name = document.getElementById('manualNameInput').value.trim();
      const apiKey = document.getElementById('manualApiKeyInput').value.trim();
      const apiServerUrl = document.getElementById('manualApiServerUrlInput').value.trim();
      const accountType = document.getElementById('manualAccountTypeInput').value;
      
      if (!email || !apiKey) {
        showMessage('error', '请输入邮箱和 API Key');
        return;
      }
      
      vscode.postMessage({ 
        type: 'addAccountManual', 
        email, 
        name, 
        apiKey, 
        apiServerUrl,
        accountType
      });
      cancelAdd();
    }
    
    function switchAccount(accountId) {
      const acc = accounts.find(a => a.id === accountId);
      if (acc && acc.email === currentEmail) {
        showMessage('info', '已经是当前账号');
        return;
      }
      vscode.postMessage({ type: 'switchAccount', accountId });
    }
    
    function switchNextAccount() {
      vscode.postMessage({ type: 'switchNextAccount' });
    }
    
    function copyApiKey(accountId) {
      vscode.postMessage({ type: 'copyApiKey', accountId });
    }
    
    function deleteAccount(accountId) {
      vscode.postMessage({ type: 'confirmDelete', accountId });
    }
    
    function showMessage(type, text) {
      const el = document.getElementById('message');
      el.className = 'message show ' + type;
      el.textContent = text;
      
      if (type !== 'info') {
        setTimeout(() => {
          el.classList.remove('show');
        }, 3000);
      }
    }
    
    let refreshOnSwitch = true;
    
    function updateRefreshToggle(value) {
      refreshOnSwitch = value;
      const toggle = document.getElementById('refreshToggle');
      if (value) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    }
    
    function toggleRefresh() {
      refreshOnSwitch = !refreshOnSwitch;
      updateRefreshToggle(refreshOnSwitch);
      vscode.postMessage({ type: 'setRefreshSetting', value: refreshOnSwitch });
    }
    
    function resetMachineId() {
      vscode.postMessage({ type: 'resetMachineId' });
    }
    
    function injectPro() {
      vscode.postMessage({ type: 'injectPro' });
    }
    
    function exportAccounts() {
      vscode.postMessage({ type: 'exportAccounts' });
    }
    
    function importAccounts() {
      vscode.postMessage({ type: 'importAccounts' });
    }
    
    // 回车提交 - 登录模式
    document.getElementById('loginPasswordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitLogin();
    });
    
    // 回车提交 - 手动模式
    document.getElementById('manualApiKeyInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitManual();
    });
    
    // 根据平台显示快捷键
    (function() {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const el = document.getElementById('shortcutDisplay');
      if (el) { el.textContent = isMac ? '⌘ + ⌥ + K' : 'Ctrl + Alt + K'; }
    })();
  </script>
</body>
</html>`;
    }
}
exports.AccountPanelProvider = AccountPanelProvider;
AccountPanelProvider.viewType = 'aceSwitch.accountPanel';
//# sourceMappingURL=accountPanelProvider.js.map