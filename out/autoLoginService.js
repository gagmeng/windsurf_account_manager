"use strict";
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
exports.AutoLoginService = void 0;
const vscode = __importStar(require("vscode"));
const patchService_1 = require("./patchService");
class AutoLoginService {
    constructor(context) {
        this.context = context;
    }
    /**
     * 注入会话，实现自动登录
     * @param apiKey API 密钥
     * @param mail 邮箱地址 (用作用户名)
     * @param apiServerUrl API 服务器地址
     * @returns 登录结果
     */
    async injectSession(apiKey, mail, apiServerUrl) {
        try {
            // 验证必需参数
            if (!apiKey || !mail || !apiServerUrl) {
                return {
                    success: false,
                    error: "缺少必要的凭据 (apiKey, mail, 或 apiServerUrl)"
                };
            }
            // 1. 检查并应用补丁（如果需要）
            console.log('🌊 [AutoLoginService] 开始检查 IDE 补丁...');
            const patchResult = await patchService_1.PatchService.checkAndApplyPatch();
            if (patchResult.needsRestart) {
                // 需要重启 IDE
                console.log('🔄 [AutoLoginService] 补丁已应用，准备重启 IDE...');
                vscode.window.showInformationMessage("补丁已应用，IDE 正在重启。重启完成后请再次点击【刷新】按钮。");
                // 延迟1秒后重启窗口
                setTimeout(() => {
                    console.log('🔄 [AutoLoginService] 执行窗口重启命令...');
                    vscode.commands.executeCommand("workbench.action.reloadWindow");
                }, 1000);
                return {
                    success: false,
                    needsRestart: true,
                    error: "补丁已应用，IDE 正在重启"
                };
            }
            if (patchResult.error) {
                console.error('❌ [AutoLoginService] 补丁检查/应用失败:', patchResult.error);
                return {
                    success: false,
                    error: patchResult.error
                };
            }
            console.log('✅ [AutoLoginService] 补丁检查完成，开始执行登录流程...');
            try {
                // 2. 先尝试登出（清理现有会话）
                console.log('🚪 [AutoLoginService] 尝试登出现有会话...');
                try {
                    await vscode.commands.executeCommand("windsurf.logout");
                    console.log('✅ [AutoLoginService] 登出成功');
                }
                catch (logoutError) {
                    // 登出失败不影响后续流程，可能用户本来就没登录
                    console.warn('⚠️ [AutoLoginService] 登出失败 (用户可能本来就没登录):', logoutError);
                }
                // 3. 执行自动登录命令
                console.log('🔐 [AutoLoginService] 执行自动登录命令...');
                console.log(`📧 [AutoLoginService] 用户邮箱: ${mail}`);
                console.log(`🔗 [AutoLoginService] API 服务器: ${apiServerUrl}`);
                console.log(`🔑 [AutoLoginService] API 密钥: ${apiKey.substring(0, 20)}...`);
                await vscode.commands.executeCommand("windsurf.provideAuthTokenToAuthProviderWithShit", {
                    apiKey: apiKey,
                    name: mail, // 使用邮箱作为用户名
                    apiServerUrl: apiServerUrl
                });
                console.log('🎉 [AutoLoginService] 自动登录成功！');
                return {
                    success: true
                };
            }
            catch (authError) {
                console.error('❌ [AutoLoginService] 自动登录失败:', authError);
                return {
                    success: false,
                    error: `认证命令失败: ${authError instanceof Error ? authError.message : "执行认证命令时发生未知错误"}`
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            console.error('AutoLoginService error:', error);
            return {
                success: false,
                error: `会话注入失败: ${error instanceof Error ? error.message : "会话注入过程中发生未知错误"}`
            };
        }
    }
    /**
     * 检查是否支持自动登录功能
     * @returns 是否支持自动登录
     */
    async isAutoLoginSupported() {
        try {
            // 检查自定义命令是否可用
            const commands = await vscode.commands.getCommands();
            return commands.includes("windsurf.provideAuthTokenToAuthProviderWithShit");
        }
        catch (error) {
            console.warn('检查自动登录支持失败:', error);
            return false;
        }
    }
    /**
     * 获取当前登录状态
     * @returns 登录状态信息
     */
    async getLoginStatus() {
        try {
            // 尝试获取当前用户信息（如果有相关命令的话）
            // 这里可能需要根据实际的 Windsurf API 调整
            return { isLoggedIn: false }; // 暂时返回默认值
        }
        catch (error) {
            console.warn('获取登录状态失败:', error);
            return { isLoggedIn: false };
        }
    }
}
exports.AutoLoginService = AutoLoginService;
//# sourceMappingURL=autoLoginService.js.map