"use strict";
/**
 * accountSwitcher.ts - 账号切换核心模块
 * 使用补丁方式实现无感切换
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
exports.AccountSwitcher = void 0;
const vscode = __importStar(require("vscode"));
const uuid_1 = require("uuid");
const databaseHelper_1 = require("./databaseHelper");
const machineIdReset_1 = require("./machineIdReset");
const patchService_1 = require("./patchService");
/**
 * 账号切换器
 *
 * 实现原理：
 * 1. 检查并应用补丁（注入自定义命令到 IDE 的 extension.js）
 * 2. 调用自定义命令注入会话
 * 3. 会话直接写入 Secrets，无需服务器验证
 */
class AccountSwitcher {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('账号切换');
    }
    /**
     * 设置 ExtensionContext
     */
    setContext(context) {
        this.context = context;
    }
    /**
     * 输出日志
     */
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    /**
     * 显示日志面板
     */
    showLog() {
        this.outputChannel.show();
    }
    /**
     * 切换账号 - 使用补丁方式
     */
    async switchAccount(account, refreshWindow = true) {
        this.outputChannel.clear();
        // 不自动显示日志面板，只在需要时手动查看
        try {
            this.log('========== 开始切换账号 ==========');
            this.log(`目标账号: ${account.email}`);
            // 步骤 1: 检查并应用补丁
            this.log('步骤 1: 检查补丁...');
            const patchResult = await patchService_1.PatchService.checkAndApplyPatch();
            if (patchResult.needsRestart) {
                this.log('补丁已应用，需要重启 IDE...');
                vscode.window.showInformationMessage('补丁已应用，IDE 正在重启。重启后请再次切换账号。');
                setTimeout(() => {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }, 1500);
                return { success: false, needsRestart: true, error: '补丁已应用，正在重启' };
            }
            if (patchResult.error) {
                this.log(`补丁检查失败: ${patchResult.error}`);
                return { success: false, error: patchResult.error };
            }
            this.log('补丁检查通过');
            // 步骤 2: 尝试登出现有会话
            this.log('步骤 2: 登出现有会话...');
            try {
                await vscode.commands.executeCommand('windsurf.logout');
                this.log('登出成功');
            }
            catch {
                this.log('登出命令不可用（用户可能未登录）');
            }
            // 步骤 3: 重置机器 ID（可选）
            this.log('步骤 3: 重置机器 ID...');
            try {
                const ids = await machineIdReset_1.MachineIdResetter.resetMachineId();
                this.log(`新机器 ID: ${ids.machineId.substring(0, 16)}...`);
            }
            catch {
                this.log('机器 ID 重置跳过');
            }
            // 步骤 4: 注入新会话
            this.log('步骤 4: 注入新会话...');
            this.log(`用户: ${account.email}`);
            this.log(`API Key: ${account.apiKey.substring(0, 20)}...`);
            try {
                await vscode.commands.executeCommand('windsurf.provideAuthTokenToAuthProviderWithShit', {
                    apiKey: account.apiKey,
                    name: account.email,
                    apiServerUrl: account.apiServerUrl || 'https://server.self-serve.windsurf.com'
                });
                this.log('会话注入成功！');
                // 同时更新数据库（备用）
                await this.writeAuthData(account);
                this.log('========== 切换完成 ==========');
                this.log(`账号: ${account.email}`);
                if (refreshWindow) {
                    vscode.window.showInformationMessage(`账号已切换到: ${account.email}，窗口即将重载...`);
                    // 重载窗口让 Windsurf 刷新状态
                    setTimeout(() => {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }, 1500);
                }
                else {
                    vscode.window.showInformationMessage(`账号已切换到: ${account.email}（无刷新模式）`);
                }
                return { success: true };
            }
            catch (error) {
                this.log(`会话注入失败: ${error.message}`);
                // 尝试备用方案：直接写数据库并重载
                this.log('尝试备用方案：写入数据库...');
                await this.writeAuthData(account);
                if (refreshWindow) {
                    setTimeout(() => {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }, 1500);
                }
                return { success: true };
            }
        }
        catch (error) {
            const errorMessage = error.message;
            this.log(`切换失败: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }
    /**
     * 写入认证数据到数据库（备用方案）
     */
    async writeAuthData(account) {
        const teamId = (0, uuid_1.v4)();
        const authStatus = {
            name: account.name,
            apiKey: account.apiKey,
            email: account.email,
            teamId: teamId,
            planName: account.planName || ''
        };
        await databaseHelper_1.DatabaseHelper.writeToDB('windsurfAuthStatus', authStatus);
        this.log('已写入 windsurfAuthStatus');
        const installationId = (0, uuid_1.v4)();
        const codeiumConfig = {
            'codeium.installationId': installationId,
            'codeium.apiKey': account.apiKey,
            'apiServerUrl': account.apiServerUrl || 'https://server.self-serve.windsurf.com',
            'codeium.hasOneTimeUpdatedUnspecifiedMode': true
        };
        await databaseHelper_1.DatabaseHelper.writeToDB('codeium.windsurf', codeiumConfig);
        this.log('已写入 codeium.windsurf');
        await databaseHelper_1.DatabaseHelper.writeToDB('codeium.windsurf-windsurf_auth', account.name);
        this.log('已写入用户名');
    }
    /**
     * 获取当前登录的账号
     * 从多个数据源组装当前账号信息
     */
    async getCurrentAccount() {
        try {
            // 优先从 windsurfAuthStatus 读取（插件自己写入的完整数据）
            const authStatus = await databaseHelper_1.DatabaseHelper.readFromDB('windsurfAuthStatus');
            if (authStatus && authStatus.apiKey && authStatus.email) {
                return authStatus;
            }
            // 备选：从多个 DB key 组装数据（首次使用，未经过插件切换的情况）
            const result = { email: '', name: '', apiKey: '', planName: '' };
            // 读取 apiKey 和基本信息
            if (authStatus && authStatus.apiKey) {
                result.apiKey = authStatus.apiKey;
                result.name = authStatus.name || '';
                result.email = authStatus.email || '';
                result.planName = authStatus.planName || '';
            }
            // 从 userStatusProtoBinaryBase64 解析 email 和 name
            if (authStatus && authStatus.userStatusProtoBinaryBase64 && (!result.email || !result.name)) {
                try {
                    const buf = Buffer.from(authStatus.userStatusProtoBinaryBase64, 'base64');
                    // 正确解析 protobuf 二进制，提取 length-delimited 字符串字段
                    const extractedStrings = [];
                    let i = 0;
                    while (i < buf.length) {
                        const wireType = buf[i] & 0x07;
                        i++;
                        if (wireType === 2 && i < buf.length) {
                            // length-delimited: 读取 varint 长度，再提取对应字节为字符串
                            let len = 0, shift = 0;
                            while (i < buf.length) {
                                const b = buf[i++];
                                len |= (b & 0x7F) << shift;
                                shift += 7;
                                if (!(b & 0x80)) break;
                            }
                            if (len > 0 && len < 500 && i + len <= buf.length) {
                                const str = buf.slice(i, i + len).toString('utf-8');
                                if (/^[\x20-\x7e]+$/.test(str)) {
                                    extractedStrings.push(str);
                                }
                            }
                            i += len;
                        } else if (wireType === 0) {
                            while (i < buf.length && buf[i] & 0x80) i++;
                            i++;
                        } else if (wireType === 1) {
                            i += 8;
                        } else if (wireType === 5) {
                            i += 4;
                        } else {
                            break;
                        }
                    }
                    // 从提取的字符串中精确匹配 email 和 name
                    for (const str of extractedStrings) {
                        if (!result.email && /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,6}$/.test(str)) {
                            result.email = str;
                            console.log(`[AccountSwitcher] 从 userStatus 提取到 email: ${result.email}`);
                        }
                        if (!result.name && str.length >= 2 && !str.includes('@')) {
                            result.name = str.trim();
                            console.log(`[AccountSwitcher] 从 userStatus 提取到 name: ${result.name}`);
                        }
                    }
                } catch (e) {
                    console.error('[AccountSwitcher] 解析 userStatusProtoBinaryBase64 失败:', e);
                }
            }
            // 从 codeium.windsurf 读取配置
            const codeiumConfig = await databaseHelper_1.DatabaseHelper.readFromDB('codeium.windsurf');
            if (codeiumConfig) {
                if (!result.apiKey && codeiumConfig['codeium.apiKey']) {
                    result.apiKey = codeiumConfig['codeium.apiKey'];
                }
            }
            // 从 codeium.windsurf-windsurf_auth 读取用户名
            const authName = await databaseHelper_1.DatabaseHelper.readFromDB('codeium.windsurf-windsurf_auth');
            if (authName && typeof authName === 'string') {
                if (!result.name) result.name = authName;
                // 仅当看起来像邮箱时才赋给 email
                if (!result.email && authName.includes('@')) result.email = authName;
            }
            // 尝试从 cachedPlanInfo 获取真实邮箱和计划名称
            if (!result.email || !result.email.includes('@') || !result.planName) {
                try {
                    const cached = await databaseHelper_1.DatabaseHelper.readFromDB('windsurf.settings.cachedPlanInfo');
                    if (cached) {
                        const info = typeof cached === 'string' ? JSON.parse(cached) : cached;
                        const planEmail = info?.email || info?.planStatus?.email || '';
                        if (planEmail && planEmail.includes('@') && (!result.email || !result.email.includes('@'))) {
                            result.email = planEmail;
                        }
                        if (!result.planName && info?.planName) {
                            result.planName = info.planName;
                        }
                    }
                } catch (e) { /* ignore */ }
            }
            // 如果有任何有效信息则返回
            if (result.apiKey || result.email || result.name) {
                return result;
            }
            return null;
        }
        catch (e) {
            console.error('[AccountSwitcher] getCurrentAccount failed:', e);
            return null;
        }
    }
    /**
     * 检查是否支持无感换号
     */
    async isAutoLoginSupported() {
        try {
            const commands = await vscode.commands.getCommands();
            return commands.includes('windsurf.provideAuthTokenToAuthProviderWithShit');
        }
        catch {
            return false;
        }
    }
}
exports.AccountSwitcher = AccountSwitcher;
//# sourceMappingURL=accountSwitcher.js.map