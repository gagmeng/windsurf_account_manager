"use strict";
/**
 * pathDetector.ts - Windsurf 路径检测器
 * 跨平台检测 Windsurf 数据目录和数据库路径
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
exports.PathDetector = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs/promises"));
/**
 * Windsurf 路径检测器
 */
class PathDetector {
    /**
     * 获取用户主目录
     */
    static getHomeDir() {
        return os.homedir();
    }
    /**
     * 获取 Windsurf 用户数据目录
     * 根据当前运行的版本 (Windsurf 或 Windsurf - Next) 自动选择正确的路径
     */
    static getUserDataPath() {
        if (this.cachedPaths['userData']) {
            return this.cachedPaths['userData'];
        }
        const platform = process.platform;
        let userDataPath;
        // 尝试检测当前运行的是哪个版本
        const isNextVersion = this.isWindsurfNextVersion();
        console.log(`[PathDetector] 检测到版本: ${isNextVersion ? 'Windsurf - Next' : 'Windsurf'}`);
        if (platform === 'win32') {
            // Windows: %APPDATA%\Windsurf 或 %APPDATA%\Windsurf - Next
            const appData = process.env.APPDATA || path.join(this.getHomeDir(), 'AppData', 'Roaming');
            const folderName = isNextVersion ? 'Windsurf - Next' : 'Windsurf';
            userDataPath = path.join(appData, folderName);
        }
        else if (platform === 'darwin') {
            // macOS: ~/Library/Application Support/Windsurf 或 Windsurf - Next
            const appSupport = path.join(this.getHomeDir(), 'Library', 'Application Support');
            const folderName = isNextVersion ? 'Windsurf - Next' : 'Windsurf';
            userDataPath = path.join(appSupport, folderName);
        }
        else {
            // Linux: ~/.config/Windsurf 或 Windsurf - Next
            const folderName = isNextVersion ? 'Windsurf - Next' : 'Windsurf';
            userDataPath = path.join(this.getHomeDir(), '.config', folderName);
        }
        console.log(`[PathDetector] 用户数据路径: ${userDataPath}`);
        this.cachedPaths['userData'] = userDataPath;
        return userDataPath;
    }
    /**
     * 检测当前是否运行的是 Windsurf Next 版本
     * 通过检查 appName 或进程路径来判断
     */
    static isWindsurfNextVersion() {
        try {
            // 方法1: 检查 vscode.env.appName (需要在扩展上下文中调用)
            // 由于这是静态方法，我们需要其他方式
            // 方法2: 检查进程路径
            const execPath = process.execPath || '';
            if (execPath.includes('Windsurf - Next') || execPath.includes('Windsurf-Next')) {
                return true;
            }
            // 方法3: 检查环境变量或其他标识
            const appPath = process.env.VSCODE_CWD || process.cwd();
            if (appPath.includes('Windsurf - Next') || appPath.includes('Windsurf-Next')) {
                return true;
            }
            // 方法4: 检查 __dirname (扩展安装路径)
            if (__dirname.includes('Windsurf - Next') || __dirname.includes('Windsurf-Next')) {
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('[PathDetector] 版本检测失败:', error);
            return false;
        }
    }
    /**
     * 获取 Windsurf 数据库路径 (state.vscdb)
     */
    static getDBPath() {
        if (this.cachedPaths['db']) {
            return this.cachedPaths['db'];
        }
        const dbPath = path.join(this.getUserDataPath(), 'User', 'globalStorage', 'state.vscdb');
        this.cachedPaths['db'] = dbPath;
        return dbPath;
    }
    /**
     * 获取 storage.json 路径
     */
    static getStorageJsonPath() {
        if (this.cachedPaths['storage']) {
            return this.cachedPaths['storage'];
        }
        const storagePath = path.join(this.getUserDataPath(), 'storage.json');
        this.cachedPaths['storage'] = storagePath;
        return storagePath;
    }
    /**
     * 检查 Windsurf 是否已安装
     */
    static async isInstalled() {
        try {
            const dbPath = this.getDBPath();
            await fs.access(dbPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 获取所有相关路径
     */
    static getAllPaths() {
        return {
            home: this.getHomeDir(),
            userData: this.getUserDataPath(),
            database: this.getDBPath(),
            storage: this.getStorageJsonPath()
        };
    }
}
exports.PathDetector = PathDetector;
PathDetector.cachedPaths = {};
//# sourceMappingURL=pathDetector.js.map