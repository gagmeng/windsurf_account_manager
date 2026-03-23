"use strict";
/**
 * extension.ts - 账号管理助手插件入口
 *
 * 功能：
 * - 管理账号列表
 * - 一键切换账号（自动重载窗口）
 * - 状态栏显示当前账号
 * - 侧边栏可视化操作面板
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const accountManager_1 = require("./accountManager");
const accountSwitcher_1 = require("./accountSwitcher");
const accountPanelProvider_1 = require("./accountPanelProvider");
const switchAccount_1 = require("./commands/switchAccount");
const addAccount_1 = require("./commands/addAccount");
const switchNextAccount_1 = require("./commands/switchNextAccount");
const listAccounts_1 = require("./commands/listAccounts");
// 面板提供者
let panelProvider;
/**
 * 插件激活
 */
async function activate(context) {
    console.log('[AceSwitch] 插件已激活');
    // 初始化管理器
    const accountManager = new accountManager_1.AccountManager(context);
    const accountSwitcher = new accountSwitcher_1.AccountSwitcher();
    // 创建并注册侧边栏面板
    panelProvider = new accountPanelProvider_1.AccountPanelProvider(context.extensionUri, accountManager, accountSwitcher);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(accountPanelProvider_1.AccountPanelProvider.viewType, panelProvider));
    // 注册刷新命令
    context.subscriptions.push(vscode.commands.registerCommand('aceSwitch.refreshPanel', () => {
        panelProvider.refresh();
    }));
    // 注册其他命令
    context.subscriptions.push((0, switchAccount_1.registerSwitchAccountCommand)(context, accountManager, accountSwitcher), (0, addAccount_1.registerAddAccountCommand)(context, accountManager), (0, switchNextAccount_1.registerSwitchNextAccountCommand)(context, accountManager, accountSwitcher), (0, listAccounts_1.registerListAccountsCommand)(context, accountManager, accountSwitcher), (0, listAccounts_1.registerRemoveAccountCommand)(context, accountManager), (0, listAccounts_1.registerShowCurrentAccountCommand)(context, accountSwitcher));
    // 自动检测当前账号并导入（后台执行，不阻塞激活）
    setTimeout(async () => {
        try {
            const currentAccount = await accountSwitcher.getCurrentAccount();
            if (currentAccount && currentAccount.email && currentAccount.apiKey) {
                const accounts = await accountManager.getAccounts();
                // 按 API Key 匹配已有账号
                const existingByKey = accounts.find(acc => acc.apiKey === currentAccount.apiKey);
                if (existingByKey) {
                    // API Key 相同但邮箱变了，更新邮箱
                    if (existingByKey.email !== currentAccount.email) {
                        await accountManager.updateAccount(existingByKey.id, {
                            email: currentAccount.email,
                            name: currentAccount.name || currentAccount.email.split('@')[0]
                        });
                        console.log(`[AceSwitch] 已更新账号邮箱: ${existingByKey.email} -> ${currentAccount.email}`);
                        panelProvider.refresh();
                    }
                }
                else {
                    // 按邮箱也找不到，新增账号
                    const existingByEmail = accounts.some(acc => acc.email === currentAccount.email);
                    if (!existingByEmail) {
                        const planNameStr = currentAccount.planName || '';
                        const derivedType = planNameStr.toLowerCase() === 'trial' ? 'trial'
                            : planNameStr.toLowerCase() === 'pro' ? 'pro'
                            : planNameStr.toLowerCase() === 'free' ? 'free'
                            : planNameStr.toLowerCase() === 'enterprise' ? 'enterprise'
                            : '';
                        await accountManager.addAccount({
                            email: currentAccount.email,
                            name: currentAccount.name || currentAccount.email.split('@')[0],
                            apiKey: currentAccount.apiKey,
                            apiServerUrl: currentAccount.apiServerUrl || 'https://server.self-serve.windsurf.com',
                            refreshToken: '',
                            planName: planNameStr,
                            accountType: derivedType
                        });
                        console.log(`[AceSwitch] 已自动导入当前账号: ${currentAccount.email}`);
                        panelProvider.refresh();
                    }
                }
            }
        }
        catch (e) {
            console.error('[AceSwitch] 自动导入当前账号失败:', e);
        }
    }, 2000);
    console.log('[AceSwitch] 初始化完成');
}
/**
 * 插件停用
 */
function deactivate() {
    console.log('[AceSwitch] 插件已停用');
}
//# sourceMappingURL=extension.js.map