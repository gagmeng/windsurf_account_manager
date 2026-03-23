"use strict";
/**
 * listAccounts.ts - 管理账号命令
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
exports.registerListAccountsCommand = registerListAccountsCommand;
exports.registerRemoveAccountCommand = registerRemoveAccountCommand;
exports.registerShowCurrentAccountCommand = registerShowCurrentAccountCommand;
const vscode = __importStar(require("vscode"));
/**
 * 注册管理账号命令
 */
function registerListAccountsCommand(context, accountManager, accountSwitcher) {
    return vscode.commands.registerCommand('aceSwitch.listAccounts', async () => {
        try {
            const accounts = await accountManager.getAccounts();
            if (accounts.length === 0) {
                const action = await vscode.window.showInformationMessage('没有保存的账号', '添加账号');
                if (action === '添加账号') {
                    await vscode.commands.executeCommand('aceSwitch.addAccount');
                }
                return;
            }
            // 获取当前账号
            const currentAccount = await accountSwitcher.getCurrentAccount();
            // 构建选择列表
            const items = [];
            // 添加账号列表
            for (const acc of accounts) {
                const isCurrent = currentAccount?.email === acc.email;
                items.push({
                    label: `$(account) ${acc.email}`,
                    description: acc.name,
                    detail: `${acc.planName}${isCurrent ? ' - 当前使用' : ''}`,
                    account: acc
                });
            }
            // 添加操作选项
            items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            items.push({
                label: '$(add) 添加账号',
                action: 'add'
            });
            items.push({
                label: '$(export) 导出账号',
                action: 'export'
            });
            // 显示选择菜单
            const selected = await vscode.window.showQuickPick(items, {
                title: 'Windsurf 账号管理',
                placeHolder: '选择账号查看详情或进行操作'
            });
            if (!selected) {
                return;
            }
            // 处理操作
            if (selected.action === 'add') {
                await vscode.commands.executeCommand('aceSwitch.addAccount');
                return;
            }
            if (selected.action === 'export') {
                await exportAccounts(accountManager);
                return;
            }
            // 显示账号详情
            if (selected.account) {
                await showAccountDetails(selected.account, accountManager, accountSwitcher, currentAccount?.email);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`管理账号时发生错误: ${error.message}`);
        }
    });
}
/**
 * 显示账号详情
 */
async function showAccountDetails(account, accountManager, accountSwitcher, currentEmail) {
    const isCurrent = currentEmail === account.email;
    const actions = [];
    if (!isCurrent) {
        actions.push({
            label: '$(arrow-swap) 切换到此账号',
            action: 'switch'
        });
    }
    actions.push({
        label: '$(copy) 复制 API Key',
        action: 'copyApiKey'
    });
    actions.push({
        label: '$(trash) 删除账号',
        action: 'delete'
    });
    const selected = await vscode.window.showQuickPick(actions, {
        title: `账号: ${account.email}`,
        placeHolder: '选择操作'
    });
    if (!selected) {
        return;
    }
    switch (selected.action) {
        case 'switch':
            const confirm = await vscode.window.showWarningMessage(`确定要切换到账号 "${account.email}" 吗？\n窗口将会重载以应用更改。`, { modal: true }, '确定切换');
            if (confirm === '确定切换') {
                const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', true);
                await accountSwitcher.switchAccount(account, refreshOnSwitch);
            }
            break;
        case 'copyApiKey':
            await vscode.env.clipboard.writeText(account.apiKey);
            vscode.window.showInformationMessage('API Key 已复制到剪贴板');
            break;
        case 'delete':
            const confirmDelete = await vscode.window.showWarningMessage(`确定要删除账号 "${account.email}" 吗？`, { modal: true }, '确定删除');
            if (confirmDelete === '确定删除') {
                await accountManager.removeAccount(account.id);
                vscode.window.showInformationMessage(`账号 "${account.email}" 已删除`);
            }
            break;
    }
}
/**
 * 导出账号
 */
async function exportAccounts(accountManager) {
    const jsonData = await accountManager.exportAccounts();
    const action = await vscode.window.showQuickPick([
        { label: '保存到文件', value: 'file' },
        { label: '复制到剪贴板', value: 'clipboard' }
    ], {
        title: '导出账号',
        placeHolder: '选择导出方式'
    });
    if (!action) {
        return;
    }
    if (action.label === '保存到文件') {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('accounts-export.json'),
            filters: {
                'JSON 文件': ['json']
            },
            title: '保存账号'
        });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonData, 'utf-8'));
            vscode.window.showInformationMessage(`账号已导出到 ${uri.fsPath}`);
        }
    }
    else {
        await vscode.env.clipboard.writeText(jsonData);
        vscode.window.showInformationMessage('账号 JSON 已复制到剪贴板');
    }
}
/**
 * 注册删除账号命令
 */
function registerRemoveAccountCommand(context, accountManager) {
    return vscode.commands.registerCommand('aceSwitch.removeAccount', async () => {
        try {
            const accounts = await accountManager.getAccounts();
            if (accounts.length === 0) {
                vscode.window.showInformationMessage('没有保存的账号');
                return;
            }
            // 构建选择列表
            const items = accounts.map(acc => ({
                label: acc.email,
                description: acc.name,
                detail: acc.planName,
                account: acc
            }));
            const selected = await vscode.window.showQuickPick(items, {
                title: '删除账号',
                placeHolder: '选择要删除的账号',
                canPickMany: true
            });
            if (!selected || selected.length === 0) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(`确定要删除 ${selected.length} 个账号吗？`, { modal: true }, '确定删除');
            if (confirm !== '确定删除') {
                return;
            }
            for (const item of selected) {
                await accountManager.removeAccount(item.account.id);
            }
            vscode.window.showInformationMessage(`已删除 ${selected.length} 个账号`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`删除账号失败: ${error.message}`);
        }
    });
}
/**
 * 注册查看当前账号命令
 */
function registerShowCurrentAccountCommand(context, accountSwitcher) {
    return vscode.commands.registerCommand('aceSwitch.showCurrentAccount', async () => {
        try {
            const account = await accountSwitcher.getCurrentAccount();
            if (!account) {
                vscode.window.showInformationMessage('当前未登录账号');
                return;
            }
            vscode.window.showInformationMessage(`当前账号: ${account.email}\n名称: ${account.name}\n套餐: ${account.planName}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`获取当前账号失败: ${error.message}`);
        }
    });
}
//# sourceMappingURL=listAccounts.js.map