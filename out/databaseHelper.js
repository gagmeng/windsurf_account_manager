"use strict";
/**
 * databaseHelper.ts - SQLite 数据库操作模块
 * 使用 sql.js 操作 Windsurf 的 state.vscdb 数据库
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
exports.DatabaseHelper = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const pathDetector_1 = require("./pathDetector");
let sqlJsInstance = null;
/**
 * 初始化 sql.js
 */
async function initSqlJs() {
    if (sqlJsInstance) {
        return sqlJsInstance;
    }
    // 动态导入 sql.js
    const initSqlJsModule = require('sql.js');
    // 使用 locateFile 确保在 VS Code 扩展环境中能正确找到 WASM 文件
    const sqlJsPath = path.dirname(require.resolve('sql.js'));
    sqlJsInstance = await initSqlJsModule({
        locateFile: (file) => path.join(sqlJsPath, file)
    });
    return sqlJsInstance;
}
/**
 * 数据库操作类
 */
class DatabaseHelper {
    /**
     * 从数据库读取指定 key 的值
     */
    static async readFromDB(key) {
        const SQL = await initSqlJs();
        const dbPath = pathDetector_1.PathDetector.getDBPath();
        try {
            const dbBuffer = await fs.readFile(dbPath);
            const db = new SQL.Database(dbBuffer);
            try {
                const result = db.exec('SELECT value FROM ItemTable WHERE key = ?', [key]);
                if (result.length > 0 && result[0].values.length > 0) {
                    const value = result[0].values[0][0];
                    // 尝试解析 JSON
                    if (typeof value === 'string') {
                        try {
                            return JSON.parse(value);
                        }
                        catch {
                            return value;
                        }
                    }
                    return value;
                }
                return null;
            }
            finally {
                db.close();
            }
        }
        catch (error) {
            console.error('[DatabaseHelper] 读取失败:', error);
            return null;
        }
    }
    /**
     * 写入数据到数据库
     */
    static async writeToDB(key, value) {
        const SQL = await initSqlJs();
        const dbPath = pathDetector_1.PathDetector.getDBPath();
        try {
            if (value === null || value === undefined) {
                throw new Error(`Cannot write null/undefined value to key: ${key}`);
            }
            const dbBuffer = await fs.readFile(dbPath);
            const db = new SQL.Database(dbBuffer);
            try {
                let finalValue;
                // 处理不同类型的值
                if (Buffer.isBuffer(value)) {
                    // Buffer 转为 JSON 格式
                    finalValue = JSON.stringify({
                        type: 'Buffer',
                        data: Array.from(value)
                    });
                }
                else if (value instanceof Uint8Array) {
                    // Uint8Array 转为 JSON 格式
                    finalValue = JSON.stringify({
                        type: 'Buffer',
                        data: Array.from(value)
                    });
                }
                else if (typeof value === 'object') {
                    finalValue = JSON.stringify(value);
                }
                else {
                    finalValue = String(value);
                }
                // 执行插入或更新
                db.run('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)', [key, finalValue]);
                // 导出并写回文件
                const data = db.export();
                await fs.writeFile(dbPath, Buffer.from(data));
                console.log(`[DatabaseHelper] 已写入: ${key}`);
                return true;
            }
            finally {
                db.close();
            }
        }
        catch (error) {
            console.error('[DatabaseHelper] 写入失败:', error);
            throw error;
        }
    }
    /**
     * 删除数据库中的指定 key
     */
    static async deleteFromDB(key) {
        const SQL = await initSqlJs();
        const dbPath = pathDetector_1.PathDetector.getDBPath();
        try {
            const dbBuffer = await fs.readFile(dbPath);
            const db = new SQL.Database(dbBuffer);
            try {
                db.run('DELETE FROM ItemTable WHERE key = ?', [key]);
                const data = db.export();
                await fs.writeFile(dbPath, Buffer.from(data));
                console.log(`[DatabaseHelper] 已删除: ${key}`);
                return true;
            }
            finally {
                db.close();
            }
        }
        catch (error) {
            console.error('[DatabaseHelper] 删除失败:', error);
            return false;
        }
    }
    /**
     * 批量删除匹配模式的 keys
     */
    static async deleteByPattern(pattern) {
        const SQL = await initSqlJs();
        const dbPath = pathDetector_1.PathDetector.getDBPath();
        try {
            const dbBuffer = await fs.readFile(dbPath);
            const db = new SQL.Database(dbBuffer);
            try {
                // 先查询匹配的 keys
                const result = db.exec(`SELECT key FROM ItemTable WHERE key LIKE ?`, [pattern]);
                let deletedCount = 0;
                if (result.length > 0 && result[0].values.length > 0) {
                    for (const row of result[0].values) {
                        db.run('DELETE FROM ItemTable WHERE key = ?', [row[0]]);
                        deletedCount++;
                    }
                }
                const data = db.export();
                await fs.writeFile(dbPath, Buffer.from(data));
                console.log(`[DatabaseHelper] 删除了 ${deletedCount} 条记录 (pattern: ${pattern})`);
                return deletedCount;
            }
            finally {
                db.close();
            }
        }
        catch (error) {
            console.error('[DatabaseHelper] 批量删除失败:', error);
            return 0;
        }
    }
    /**
     * 备份数据库
     */
    static async backupDB() {
        const dbPath = pathDetector_1.PathDetector.getDBPath();
        const backupPath = `${dbPath}.backup.${Date.now()}`;
        try {
            await fs.copyFile(dbPath, backupPath);
            console.log(`[DatabaseHelper] 数据库已备份: ${backupPath}`);
            return backupPath;
        }
        catch (error) {
            console.error('[DatabaseHelper] 备份失败:', error);
            return null;
        }
    }
}
exports.DatabaseHelper = DatabaseHelper;
//# sourceMappingURL=databaseHelper.js.map