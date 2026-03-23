"use strict";
/**
 * switchNextAccount.ts - 快捷键切换下一个账号命令
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
exports.registerSwitchNextAccountCommand = registerSwitchNextAccountCommand;
const vscode = __importStar(require("vscode"));
/**
 * 注册切换下一个账号命令
 */
function registerSwitchNextAccountCommand(context, accountManager, accountSwitcher) {
    return vscode.commands.registerCommand('aceSwitch.switchNextAccount', async () => {
        try {
            // 获取账号列表
            const accounts = await accountManager.getAccounts();
            if (accounts.length === 0) {
                vscode.window.showWarningMessage('没有可切换的账号，请先添加账号');
                return;
            }
            if (accounts.length === 1) {
                vscode.window.showInformationMessage('只有一个账号，无需切换');
                return;
            }
            // 获取下一个账号
            const { account, index } = await accountManager.getNextAccount();
            if (!account) {
                vscode.window.showErrorMessage('获取下一个账号失败');
                return;
            }
            // 显示切换提示
            vscode.window.showInformationMessage(`正在切换到: ${account.email} (${index + 1}/${accounts.length})`);
            // 执行切换
            const refreshOnSwitch = vscode.workspace.getConfiguration().get('aceSwitch.refreshOnSwitch', true);
            const result = await accountSwitcher.switchAccount(account, refreshOnSwitch);
            if (result.success) {
                // 更新当前索引
                await accountManager.setCurrentAccountIndex(index);
                vscode.window.showInformationMessage(`已切换到: ${account.email}`);
            }
            else if (result.needsRestart) {
                // 需要重启，索引会在重启后保持
                await accountManager.setCurrentAccountIndex(index);
            }
            else {
                vscode.window.showErrorMessage(`切换失败: ${result.error}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`切换账号失败: ${errorMessage}`);
        }
    });
}
//# sourceMappingURL=switchNextAccount.js.map