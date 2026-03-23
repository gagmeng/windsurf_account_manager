"use strict";
/**
 * addAccount.ts - 添加账号命令
 * 通过 Firebase Auth 登录获取 Token 和 API Key
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
exports.registerAddAccountCommand = registerAddAccountCommand;
const vscode = __importStar(require("vscode"));
const apiHelper_1 = require("../apiHelper");
/**
 * 注册添加账号命令
 */
function registerAddAccountCommand(context, accountManager) {
    return vscode.commands.registerCommand('aceSwitch.addAccount', async () => {
        try {
            // 输入邮箱
            const email = await vscode.window.showInputBox({
                title: '添加账号 - 邮箱',
                prompt: '请输入账号邮箱',
                placeHolder: 'example@email.com',
                validateInput: (value) => {
                    if (!value || !value.includes('@')) {
                        return '请输入有效的邮箱地址';
                    }
                    return null;
                }
            });
            if (!email) {
                return;
            }
            // 输入密码
            const password = await vscode.window.showInputBox({
                title: '添加账号 - 密码',
                prompt: '请输入账号密码',
                password: true,
                validateInput: (value) => {
                    if (!value || value.length < 6) {
                        return '请输入有效的密码（至少6位）';
                    }
                    return null;
                }
            });
            if (!password) {
                return;
            }
            // 显示进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在登录获取 Token...',
                cancellable: false
            }, async (progress) => {
                // 创建输出通道显示日志
                const outputChannel = vscode.window.createOutputChannel('账号切换');
                outputChannel.show();
                const logCallback = (message) => {
                    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
                };
                // 调用 Firebase Auth 登录
                const apiHelper = new apiHelper_1.ApiHelper(logCallback);
                const result = await apiHelper.login(email, password);
                if (result.success) {
                    progress.report({ message: '登录成功，正在保存账号...' });
                    // 保存账号
                    const account = await accountManager.addAccount({
                        email: result.email,
                        name: result.name,
                        apiKey: result.apiKey,
                        apiServerUrl: result.apiServerUrl,
                        refreshToken: result.refreshToken,
                        planName: 'Pro'
                    });
                    outputChannel.appendLine('');
                    outputChannel.appendLine('========== 账号添加成功 ==========');
                    outputChannel.appendLine(`邮箱: ${account.email}`);
                    outputChannel.appendLine(`名称: ${account.name}`);
                    outputChannel.appendLine(`API Key: ${account.apiKey.substring(0, 20)}...`);
                    outputChannel.appendLine('');
                    vscode.window.showInformationMessage(`账号 "${account.email}" 添加成功！`);
                    // 刷新面板
                    vscode.commands.executeCommand('aceSwitch.refreshPanel');
                }
                else {
                    outputChannel.appendLine('');
                    outputChannel.appendLine('========== 登录失败 ==========');
                    outputChannel.appendLine(`错误: ${result.error}`);
                    outputChannel.appendLine('');
                    vscode.window.showErrorMessage(`登录失败: ${result.error}`);
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`添加账号失败: ${error.message}`);
        }
    });
}
//# sourceMappingURL=addAccount.js.map