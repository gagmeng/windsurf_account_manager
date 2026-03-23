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
exports.PatchService = void 0;
const fs = __importStar(require("fs"));
const child_process = __importStar(require("child_process"));
const pathService_1 = require("./pathService");
class PatchService {
    /**
     * 查找 handleAuthToken 函数
     */
    static findHandleAuthToken(content) {
        const match = content.match(this.HANDLE_AUTH_TOKEN_REGEX);
        if (!match) {
            return null;
        }
        return {
            fullMatch: match[0],
            index: match.index,
            nameVar: match[1], // 捕获组1: name变量 (如 i)
            apiServerUrlVar: match[2], // 捕获组2: apiServerUrl变量 (如 g)
            sessionVar: match[3], // 捕获组3: session对象变量 (如 r)
            uuidModule: match[4], // 捕获组4: uuid模块变量 (如 o)
            stagingVar: match[5], // 捕获组5: staging key变量 (如 I)
            configModule: match[6], // 捕获组6: config模块变量 (如 a)
            stringCheckModule: match[7] // 捕获组7: 字符串检查模块变量 (如 n)
        };
    }
    /**
     * 查找命令注册
     */
    static findCommandRegistration(content) {
        const match = content.match(this.COMMAND_REGISTRATION_REGEX);
        if (!match) {
            return null;
        }
        return {
            fullMatch: match[0],
            index: match.index,
            authProviderVar: match[1] // 捕获组1: authProvider变量 (通常是e)
        };
    }
    /**
     * 根据匹配结果动态生成新的 handleAuthTokenWithShit 函数
     */
    static generateNewHandleAuthTokenWithShit(m) {
        return `async handleAuthTokenWithShit(A){const{apiKey:t,name:${m.nameVar}}=A,${m.apiServerUrlVar}=(0,B.getApiServerUrl)(A.apiServerUrl);if(!t)throw new s.AuthMalformedLanguageServerResponseError("Auth login failure: empty api_key");if(!${m.nameVar})throw new s.AuthMalformedLanguageServerResponseError("Auth login failure: empty name");const ${m.sessionVar}={id:(0,${m.uuidModule}.v4)(),accessToken:t,account:{label:${m.nameVar},id:${m.nameVar}},scopes:[]},${m.stagingVar}=(0,B.isStaging)((0,${m.configModule}.getConfig)(${m.configModule}.Config.API_SERVER_URL))?"apiServerUrl.staging":"apiServerUrl";return await this.context.globalState.update(${m.stagingVar},${m.apiServerUrlVar}),(0,${m.stringCheckModule}.isString)(${m.apiServerUrlVar})&&!(0,${m.stringCheckModule}.isEmpty)(${m.apiServerUrlVar})&&await this.context.secrets.store(u.getApiServerUrlSecretKey(),${m.apiServerUrlVar}),this._cachedSessions=[${m.sessionVar}],await this.context.secrets.store(u.getSessionsSecretKey(),JSON.stringify([${m.sessionVar}])),await this.restartLanguageServerIfNeeded(${m.apiServerUrlVar}),this._sessionChangeEmitter.fire({added:[${m.sessionVar}],removed:[],changed:[]}),${m.sessionVar}}`;
    }
    /**
     * 根据匹配结果动态生成新的命令注册
     */
    static generateNewCommandRegistration(authProviderVar) {
        return `,s.commands.registerCommand("windsurf.provideAuthTokenToAuthProviderWithShit",async A=>{try{return{session:await ${authProviderVar}.handleAuthTokenWithShit(A),error:void 0}}catch(A){return A instanceof a.WindsurfError?{error:A.errorMetadata}:{error:C.WindsurfExtensionMetadata.getInstance().errorCodes.GENERIC_ERROR}}})`;
    }
    /**
     * 检查补丁是否已应用
     * @returns 是否已应用补丁
     */
    static async isPatchApplied() {
        console.log('🔍 [PatchService] 开始检查补丁是否已应用...');
        try {
            const extensionPath = pathService_1.PathService.getExtensionPath();
            if (!extensionPath) {
                console.warn('⚠️ [PatchService] 无法获取 Windsurf 扩展路径，补丁检查失败');
                return false;
            }
            console.log('📖 [PatchService] 读取扩展文件内容...');
            const fileContent = fs.readFileSync(extensionPath, 'utf-8');
            console.log(`📊 [PatchService] 文件内容长度: ${fileContent.length} 字符`);
            console.log(`🔍 [PatchService] 检查关键字1: "${this.PATCH_KEYWORD_1}"`);
            const hasKeyword1 = fileContent.includes(this.PATCH_KEYWORD_1);
            console.log(`${hasKeyword1 ? '✅' : '❌'} [PatchService] 关键字1 ${hasKeyword1 ? '已找到' : '未找到'}`);
            console.log(`🔍 [PatchService] 检查关键字2: "${this.PATCH_KEYWORD_2}"`);
            const hasKeyword2 = fileContent.includes(this.PATCH_KEYWORD_2);
            console.log(`${hasKeyword2 ? '✅' : '❌'} [PatchService] 关键字2 ${hasKeyword2 ? '已找到' : '未找到'}`);
            const isApplied = hasKeyword1 && hasKeyword2;
            console.log(`${isApplied ? '✅' : '❌'} [PatchService] 补丁${isApplied ? '已应用' : '未应用'}`);
            return isApplied;
        }
        catch (error) {
            console.error('❌ [PatchService] 检查补丁状态失败:', error);
            return false;
        }
    }
    /**
     * 检查写入权限
     * @returns 权限检查结果
     */
    static checkWritePermission() {
        console.log('🔍 [PatchService] 开始检查写入权限...');
        try {
            const extensionPath = pathService_1.PathService.getExtensionPath();
            if (!extensionPath) {
                console.error('❌ [PatchService] Windsurf 安装未找到');
                return {
                    hasPermission: false,
                    error: "Windsurf installation not found. Please ensure Windsurf is installed."
                };
            }
            console.log('🔍 [PatchService] 检查文件读取权限...');
            if (!pathService_1.PathService.isFileAccessible(extensionPath)) {
                console.error('❌ [PatchService] 文件不可读');
                return {
                    hasPermission: false,
                    error: `Cannot read Windsurf extension file at: ${extensionPath}`
                };
            }
            console.log('🔍 [PatchService] 检查文件写入权限...');
            if (!pathService_1.PathService.isFileWritable(extensionPath)) {
                console.error('❌ [PatchService] 文件不可写');
                const suggestion = pathService_1.PathService.getPermissionFixSuggestion(extensionPath);
                return {
                    hasPermission: false,
                    extensionPath: extensionPath,
                    error: `Insufficient permissions to modify Windsurf extension at: ${extensionPath}\n\n${suggestion}`
                };
            }
            console.log('✅ [PatchService] 权限检查通过');
            return {
                hasPermission: true
            };
        }
        catch (error) {
            console.error('❌ [PatchService] 权限检查失败:', error);
            return {
                hasPermission: false,
                error: `权限检查失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }
    /**
     * 尝试自动修复文件写入权限 (Linux/macOS)
     * 使用 pkexec (polkit) 弹出图形化密码输入框
     * @returns 是否修复成功
     */
    static tryFixWritePermission(filePath) {
        if (process.platform === 'win32') {
            return false;
        }
        console.log('🔧 [PatchService] 尝试自动修复文件权限...');
        // 方法1: 尝试 pkexec (图形化 polkit 提权)
        try {
            child_process.execSync(`pkexec chmod a+w "${filePath}"`, {
                timeout: 60000,
                stdio: 'pipe'
            });
            console.log('✅ [PatchService] pkexec 权限修复成功');
            return true;
        }
        catch (e) {
            console.log('⚠️ [PatchService] pkexec 失败:', e.message);
        }
        // 方法2: 尝试 sudo（在某些终端环境中可用）
        try {
            child_process.execSync(`sudo -n chmod a+w "${filePath}"`, {
                timeout: 5000,
                stdio: 'pipe'
            });
            console.log('✅ [PatchService] sudo 权限修复成功');
            return true;
        }
        catch (e) {
            console.log('⚠️ [PatchService] sudo 失败:', e.message);
        }
        return false;
    }
    /**
     * 应用补丁
     * @returns 补丁应用结果
     */
    static async applyPatch() {
        console.log('🔧 [PatchService] 开始应用补丁...');
        try {
            const extensionPath = pathService_1.PathService.getExtensionPath();
            if (!extensionPath) {
                console.error('❌ [PatchService] Windsurf 安装未找到');
                return {
                    success: false,
                    error: "Windsurf installation not found"
                };
            }
            // 检查权限
            console.log('🔍 [PatchService] 检查权限...');
            let permissionCheck = this.checkWritePermission();
            if (!permissionCheck.hasPermission) {
                // 尝试自动修复权限 (Linux/macOS)
                if (permissionCheck.extensionPath && process.platform !== 'win32') {
                    console.log('🔧 [PatchService] 尝试自动修复权限...');
                    const fixed = this.tryFixWritePermission(permissionCheck.extensionPath);
                    if (fixed) {
                        permissionCheck = this.checkWritePermission();
                    }
                }
                if (!permissionCheck.hasPermission) {
                    console.error('❌ [PatchService] 权限不足');
                    return {
                        success: false,
                        error: permissionCheck.error
                    };
                }
            }
            // 读取原始文件
            console.log('📖 [PatchService] 读取原始文件...');
            console.log(`📂 [PatchService] 文件路径: ${extensionPath}`);
            let fileContent = fs.readFileSync(extensionPath, 'utf-8');
            console.log(`📊 [PatchService] 原始文件大小: ${fileContent.length} 字符`);
            // 1. 使用正则表达式查找 handleAuthToken 函数
            console.log('🔍 [PatchService] 使用正则表达式查找 handleAuthToken 函数...');
            const handleAuthTokenMatch = this.findHandleAuthToken(fileContent);
            if (!handleAuthTokenMatch) {
                console.error('❌ [PatchService] 未找到 handleAuthToken 函数');
                // 尝试显示文件中的相关内容帮助调试
                const partialMatch = fileContent.indexOf('async handleAuthToken(A)');
                if (partialMatch !== -1) {
                    const snippet = fileContent.substring(partialMatch, partialMatch + 300);
                    console.log(`🔍 [PatchService] 找到部分匹配: ${snippet.substring(0, 150)}...`);
                }
                return {
                    success: false,
                    error: "Could not find handleAuthToken function. Windsurf version may be incompatible.\n\nThe expected function signature was not found in extension.js.\n\nPath: " + extensionPath
                };
            }
            console.log(`✅ [PatchService] 找到 handleAuthToken 函数，位置: ${handleAuthTokenMatch.index}`);
            console.log(`📊 [PatchService] 检测到变量: name=${handleAuthTokenMatch.nameVar}, apiServerUrl=${handleAuthTokenMatch.apiServerUrlVar}`);
            const insertPosition1 = handleAuthTokenMatch.index + handleAuthTokenMatch.fullMatch.length;
            const newHandleAuthTokenWithShit = this.generateNewHandleAuthTokenWithShit(handleAuthTokenMatch);
            console.log('🔧 [PatchService] 插入新的 handleAuthTokenWithShit 函数...');
            fileContent = fileContent.substring(0, insertPosition1) +
                newHandleAuthTokenWithShit +
                fileContent.substring(insertPosition1);
            console.log(`📊 [PatchService] 插入函数后文件大小: ${fileContent.length} 字符`);
            // 2. 使用正则表达式查找命令注册
            console.log('🔍 [PatchService] 使用正则表达式查找命令注册...');
            const commandMatch = this.findCommandRegistration(fileContent);
            if (!commandMatch) {
                console.error('❌ [PatchService] 未找到命令注册');
                // 尝试显示文件中的相关内容帮助调试
                const partialMatch = fileContent.indexOf('PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER');
                if (partialMatch !== -1) {
                    const start = Math.max(0, partialMatch - 50);
                    const snippet = fileContent.substring(start, partialMatch + 200);
                    console.log(`🔍 [PatchService] 找到部分匹配: ...${snippet.substring(0, 200)}...`);
                }
                return {
                    success: false,
                    error: "Could not find PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER command registration. Windsurf version may be incompatible.\n\nThe expected command registration was not found in extension.js.\n\nPath: " + extensionPath
                };
            }
            console.log(`✅ [PatchService] 找到命令注册，位置: ${commandMatch.index}`);
            console.log(`📊 [PatchService] 检测到 authProvider 变量: ${commandMatch.authProviderVar}`);
            const insertPosition2 = commandMatch.index + commandMatch.fullMatch.length;
            const newCommandRegistration = this.generateNewCommandRegistration(commandMatch.authProviderVar);
            console.log('🔧 [PatchService] 插入新的命令注册...');
            fileContent = fileContent.substring(0, insertPosition2) +
                newCommandRegistration +
                fileContent.substring(insertPosition2);
            console.log(`📊 [PatchService] 插入命令后文件大小: ${fileContent.length} 字符`);
            // 写入修改后的文件
            console.log('💾 [PatchService] 写入修改后的文件...');
            fs.writeFileSync(extensionPath, fileContent, 'utf-8');
            console.log('✅ [PatchService] 文件写入完成');
            // 验证补丁是否成功应用
            console.log('🔍 [PatchService] 验证补丁是否成功应用...');
            const verificationContent = fs.readFileSync(extensionPath, 'utf-8');
            const hasKeyword1 = verificationContent.includes(this.PATCH_KEYWORD_1);
            const hasKeyword2 = verificationContent.includes(this.PATCH_KEYWORD_2);
            console.log(`${hasKeyword1 ? '✅' : '❌'} [PatchService] 验证关键字1: ${hasKeyword1 ? '存在' : '不存在'}`);
            console.log(`${hasKeyword2 ? '✅' : '❌'} [PatchService] 验证关键字2: ${hasKeyword2 ? '存在' : '不存在'}`);
            if (hasKeyword1 && hasKeyword2) {
                console.log('🎉 [PatchService] 补丁应用成功！');
                return {
                    success: true
                };
            }
            else {
                console.error('❌ [PatchService] 补丁验证失败');
                return {
                    success: false,
                    error: "补丁验证失败。补丁应用后未找到关键字。"
                };
            }
        }
        catch (error) {
            console.error('❌ [PatchService] 补丁应用失败:', error);
            return {
                success: false,
                error: `补丁失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }
    /**
     * 检查并应用补丁（如果需要）
     * @returns 检查结果
     */
    static async checkAndApplyPatch() {
        console.log('🚀 [PatchService] 开始检查并应用补丁流程...');
        try {
            // 1. 检查补丁是否已应用
            console.log('📋 [PatchService] 步骤1: 检查补丁是否已应用');
            if (await this.isPatchApplied()) {
                console.log('✅ [PatchService] 补丁已应用，无需重新应用');
                return {
                    needsRestart: false
                };
            }
            console.log('⚠️ [PatchService] 补丁未应用，需要应用补丁');
            // 2. 检查权限
            console.log('📋 [PatchService] 步骤2: 检查权限');
            let permissionCheck = this.checkWritePermission();
            if (!permissionCheck.hasPermission) {
                // 尝试自动修复权限 (Linux/macOS)
                if (permissionCheck.extensionPath && process.platform !== 'win32') {
                    console.log('🔧 [PatchService] 尝试自动修复权限...');
                    const fixed = this.tryFixWritePermission(permissionCheck.extensionPath);
                    if (fixed) {
                        // 修复成功，重新检查
                        permissionCheck = this.checkWritePermission();
                    }
                }
                if (!permissionCheck.hasPermission) {
                    console.error('❌ [PatchService] 权限检查失败');
                    return {
                        needsRestart: false,
                        error: permissionCheck.error || "Insufficient permissions to apply patch. Please check file permissions."
                    };
                }
            }
            console.log('✅ [PatchService] 权限检查通过');
            // 3. 应用补丁
            console.log('📋 [PatchService] 步骤3: 应用补丁');
            const patchResult = await this.applyPatch();
            if (patchResult.success) {
                console.log('🎉 [PatchService] 补丁应用成功，需要重启 Windsurf');
                return {
                    needsRestart: true
                };
            }
            else {
                console.error('❌ [PatchService] 补丁应用失败');
                return {
                    needsRestart: false,
                    error: patchResult.error || "应用 Windsurf 补丁失败"
                };
            }
        }
        catch (error) {
            console.error('❌ [PatchService] 补丁检查/应用流程失败:', error);
            return {
                needsRestart: false,
                error: `补丁检查/应用失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }
}
exports.PatchService = PatchService;
// 检测关键字 - 用于验证补丁是否已应用
PatchService.PATCH_KEYWORD_1 = "windsurf.provideAuthTokenToAuthProviderWithShit";
PatchService.PATCH_KEYWORD_2 = "handleAuthTokenWithShit";
// 使用正则表达式匹配 handleAuthToken 函数 - 适配当前版本
// 当前版本签名: async handleAuthToken(A){const e=await(0,E.registerUser)(A),{apiKey:t,name:i}=e,g=(0,B.getApiServerUrl)(e.apiServerUrl);...this._cachedSessions=[r],...u.getSessionsSecretKey(),...this.restartLanguageServerIfNeeded(g),...}
PatchService.HANDLE_AUTH_TOKEN_REGEX = /async handleAuthToken\(A\)\{const e=await\(0,E\.registerUser\)\(A\),\{apiKey:t,name:([a-zA-Z])\}=e,([a-zA-Z])=\(0,B\.getApiServerUrl\)\(e\.apiServerUrl\);if\(!t\)throw new s\.AuthMalformedLanguageServerResponseError\("Auth login failure: empty api_key"\);if\(!\1\)throw new s\.AuthMalformedLanguageServerResponseError\("Auth login failure: empty name"\);const ([a-zA-Z])=\{id:\(0,([a-zA-Z])\.v4\)\(\),accessToken:t,account:\{label:\1,id:\1\},scopes:\[\]\},([a-zA-Z])=\(0,B\.isStaging\)\(\(0,([a-zA-Z])\.getConfig\)\(\6\.Config\.API_SERVER_URL\)\)\?"apiServerUrl\.staging":"apiServerUrl";return await this\.context\.globalState\.update\(\5,\2\),\(0,([a-zA-Z])\.isString\)\(\2\)&&!\(0,\7\.isEmpty\)\(\2\)&&await this\.context\.secrets\.store\(u\.getApiServerUrlSecretKey\(\),\2\),this\._cachedSessions=\[\3\],await this\.context\.secrets\.store\(u\.getSessionsSecretKey\(\),JSON\.stringify\(\[\3\]\)\),await this\.restartLanguageServerIfNeeded\(\2\),this\._sessionChangeEmitter\.fire\(\{added:\[\3\],removed:\[\],changed:\[\]\}\),\3\}/;
// 命令注册的正则表达式
PatchService.COMMAND_REGISTRATION_REGEX = /s\.commands\.registerCommand\(t\.PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER,async A=>\{try\{return\{session:await ([a-zA-Z])\.handleAuthToken\(A\),error:void 0\}\}catch\(A\)\{return A instanceof a\.WindsurfError\?\{error:A\.errorMetadata\}:\{error:C\.WindsurfExtensionMetadata\.getInstance\(\)\.errorCodes\.GENERIC_ERROR\}\}\}\)/;
//# sourceMappingURL=patchService.js.map