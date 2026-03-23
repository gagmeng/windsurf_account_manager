"use strict";
/**
 * machineIdReset.ts - 机器 ID 重置模块
 * 生成并更新 Windsurf 机器标识符
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
exports.MachineIdResetter = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const uuid_1 = require("uuid");
const pathDetector_1 = require("./pathDetector");
/**
 * 机器 ID 重置器
 */
class MachineIdResetter {
    /**
     * 生成新的机器 ID
     */
    static generateMachineIds() {
        return {
            machineId: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
            macMachineId: crypto.createHash('sha512').update(crypto.randomBytes(64)).digest('hex'),
            sqmId: `{${(0, uuid_1.v4)().toUpperCase()}}`,
            devDeviceId: (0, uuid_1.v4)(),
            serviceMachineId: (0, uuid_1.v4)()
        };
    }
    /**
     * 重置机器 ID
     * 更新 storage.json 中的机器标识符
     */
    static async resetMachineId() {
        const storagePath = pathDetector_1.PathDetector.getStorageJsonPath();
        const ids = this.generateMachineIds();
        try {
            // 读取 storage.json
            let storageData = {};
            try {
                const content = await fs.readFile(storagePath, 'utf-8');
                storageData = JSON.parse(content);
            }
            catch {
                console.log('[MachineIdResetter] storage.json 不存在或格式错误，创建新文件');
            }
            // 更新机器 ID 字段
            storageData['telemetry.machineId'] = ids.machineId;
            storageData['telemetry.sqmId'] = ids.sqmId;
            storageData['telemetry.devDeviceId'] = ids.devDeviceId;
            // macOS 特有字段
            if (process.platform === 'darwin') {
                storageData['telemetry.macMachineId'] = ids.macMachineId;
            }
            // 写回 storage.json（带重试）
            const maxRetries = 3;
            let lastError = null;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                    }
                    await fs.writeFile(storagePath, JSON.stringify(storageData, null, 2));
                    console.log('[MachineIdResetter] storage.json 已更新');
                    lastError = null;
                    break;
                }
                catch (error) {
                    lastError = error;
                    console.warn(`[MachineIdResetter] 写入失败 (${i + 1}/${maxRetries}):`, lastError.message);
                }
            }
            if (lastError) {
                throw lastError;
            }
            return ids;
        }
        catch (error) {
            throw new Error(`重置机器 ID 失败: ${error.message}`);
        }
    }
}
exports.MachineIdResetter = MachineIdResetter;
//# sourceMappingURL=machineIdReset.js.map