"use strict";
/**
 * switchAccount.ts - 切换账号命令
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
exports.registerSwitchAccountCommand = registerSwitchAccountCommand;
const vscode = __importStar(require("vscode"));
/**
 * 注册切换账号命令
 */
function registerSwitchAccountCommand(context, accountManager, accountSwitcher) {
    return vscode.commands.registerCommand('aceSwitch.switchAccount', async () => {
        try {
            // 获取账号列表
            const accounts = await accountManager.getAccounts();
            if (accounts.length === 0) {
                const action = await vscode.window.showWarningMessage('没有保存的账号，是否现在添加？', '添加账号', '取消');
                if (action === '添加账号') {
                    await vscode.commands.executeCommand('aceSwitch.addAccount');
                }
                return;
            }
            // 获取当前账号
            const currentAccount = await accountSwitcher.getCurrentAccount();
            // 构建选择列表
            const items = accounts.map(acc => ({
                label: acc.email,
                description: acc.name,
                detail: currentAccount?.email === acc.email ? '(当前账号)' : acc.planName,
                picked: currentAccount?.email === acc.email
            }));
            // 显示选择菜单
            const selected = await vscode.window.showQuickPick(items, {
                title: '切换账号',
                placeHolder: '选择要切换的账号',
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (!selected) {
                return;
            }
            // 查找选中的账号
            const targetAccount = accounts.find(acc => acc.email === selected.label);
            if (!targetAccount) {
                vscode.window.showErrorMessage('账号不存在');
                return;
            }
            // 检查是否是当前账号
            if (currentAccount?.email === targetAccount.email) {
                vscode.window.showInformationMessage('已经是当前账号');
                return;
            }
            // 确认切换
            const confirm = await vscode.window.showWarningMessage(`确定要切换到账号 "${targetAccount.email}" 吗？\n窗口将会重载以应用更改。`, { modal: true }, '确定切换');
            if (confirm !== '确定切换') {
                return;
            }
            // 执行切换
            const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', true);
            const result = await accountSwitcher.switchAccount(targetAccount, refreshOnSwitch);
            if (!result.success) {
                vscode.window.showErrorMessage(`切换失败: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`切换账号时发生错误: ${error.message}`);
        }
    });
}
//# sourceMappingURL=switchAccount.js.map