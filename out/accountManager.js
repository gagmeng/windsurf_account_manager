"use strict";
/**
 * accountManager.ts - 账号管理模块
 * 管理账号列表的 CRUD 操作
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountManager = void 0;
const uuid_1 = require("uuid");
/**
 * 账号管理器
 */
class AccountManager {
    constructor(context) {
        this.context = context;
    }
    /**
     * 获取当前账号索引
     */
    getCurrentAccountIndex() {
        return this.context.globalState.get(AccountManager.CURRENT_INDEX_KEY, 0);
    }
    /**
     * 设置当前账号索引
     */
    async setCurrentAccountIndex(index) {
        await this.context.globalState.update(AccountManager.CURRENT_INDEX_KEY, index);
    }
    /**
     * 获取下一个账号（循环）
     */
    async getNextAccount() {
        const accounts = await this.getAccounts();
        if (accounts.length === 0) {
            return { account: null, index: -1 };
        }
        let currentIndex = this.getCurrentAccountIndex();
        let nextIndex = (currentIndex + 1) % accounts.length;
        return { account: accounts[nextIndex], index: nextIndex };
    }
    /**
     * 获取所有账号
     */
    async getAccounts() {
        const accounts = this.context.globalState.get(AccountManager.ACCOUNTS_KEY, []);
        // 从 SecretStorage 恢复敏感信息
        for (const account of accounts) {
            const refreshToken = await this.context.secrets.get(`${AccountManager.SECRETS_PREFIX}${account.id}.refreshToken`);
            if (refreshToken) {
                account.refreshToken = refreshToken;
            }
            const apiKey = await this.context.secrets.get(`${AccountManager.SECRETS_PREFIX}${account.id}.apiKey`);
            if (apiKey) {
                account.apiKey = apiKey;
            }
        }
        return accounts;
    }
    /**
     * 获取单个账号
     */
    async getAccount(id) {
        const accounts = await this.getAccounts();
        return accounts.find(acc => acc.id === id);
    }
    /**
     * 添加账号
     */
    async addAccount(accountData) {
        const now = new Date().toISOString();
        const account = {
            ...accountData,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        // 存储敏感信息到 SecretStorage
        if (account.refreshToken) {
            await this.context.secrets.store(`${AccountManager.SECRETS_PREFIX}${account.id}.refreshToken`, account.refreshToken);
        }
        if (account.apiKey) {
            await this.context.secrets.store(`${AccountManager.SECRETS_PREFIX}${account.id}.apiKey`, account.apiKey);
        }
        // 存储账号列表（不含敏感信息）
        const accounts = this.context.globalState.get(AccountManager.ACCOUNTS_KEY, []);
        const accountToStore = { ...account };
        accountToStore.refreshToken = ''; // 不存储在 globalState
        accountToStore.apiKey = '';
        accounts.push(accountToStore);
        await this.context.globalState.update(AccountManager.ACCOUNTS_KEY, accounts);
        return account;
    }
    /**
     * 更新账号
     */
    async updateAccount(id, updates) {
        const accounts = this.context.globalState.get(AccountManager.ACCOUNTS_KEY, []);
        const index = accounts.findIndex(acc => acc.id === id);
        if (index === -1) {
            return undefined;
        }
        // 更新敏感信息
        if (updates.refreshToken) {
            await this.context.secrets.store(`${AccountManager.SECRETS_PREFIX}${id}.refreshToken`, updates.refreshToken);
        }
        if (updates.apiKey) {
            await this.context.secrets.store(`${AccountManager.SECRETS_PREFIX}${id}.apiKey`, updates.apiKey);
        }
        // 更新账号信息
        const updatedAccount = {
            ...accounts[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        // 清除敏感信息后存储
        updatedAccount.refreshToken = '';
        updatedAccount.apiKey = '';
        accounts[index] = updatedAccount;
        await this.context.globalState.update(AccountManager.ACCOUNTS_KEY, accounts);
        // 返回完整账号（含敏感信息）
        return this.getAccount(id);
    }
    /**
     * 删除账号
     */
    async removeAccount(id) {
        const accounts = this.context.globalState.get(AccountManager.ACCOUNTS_KEY, []);
        const index = accounts.findIndex(acc => acc.id === id);
        if (index === -1) {
            return false;
        }
        // 删除敏感信息
        await this.context.secrets.delete(`${AccountManager.SECRETS_PREFIX}${id}.refreshToken`);
        await this.context.secrets.delete(`${AccountManager.SECRETS_PREFIX}${id}.apiKey`);
        // 从列表中移除
        accounts.splice(index, 1);
        await this.context.globalState.update(AccountManager.ACCOUNTS_KEY, accounts);
        return true;
    }
    /**
     * 导入账号（从 JSON）
     */
    async importAccounts(jsonData) {
        let importedAccounts;
        try {
            importedAccounts = JSON.parse(jsonData);
            if (!Array.isArray(importedAccounts)) {
                importedAccounts = [importedAccounts];
            }
        }
        catch {
            throw new Error('无效的 JSON 格式');
        }
        let count = 0;
        for (const acc of importedAccounts) {
            if (acc.email && (acc.apiKey || acc.refreshToken)) {
                await this.addAccount({
                    email: acc.email,
                    name: acc.name || acc.email.split('@')[0],
                    apiKey: acc.apiKey || '',
                    apiServerUrl: acc.apiServerUrl || 'https://server.self-serve.windsurf.com',
                    refreshToken: acc.refreshToken || '',
                    planName: acc.planName || ''
                });
                count++;
            }
        }
        return count;
    }
    /**
     * 导出账号（为 JSON）
     */
    async exportAccounts() {
        const accounts = await this.getAccounts();
        return JSON.stringify(accounts, null, 2);
    }
    /**
     * 从 API 同步账号
     * @param apiAccounts API 返回的账号列表
     * @param clearExisting 是否清除现有账号
     * @returns 同步的账号数量
     */
    async syncFromApi(apiAccounts, clearExisting = true) {
        // 如果需要清除现有账号
        if (clearExisting) {
            const existingAccounts = await this.getAccounts();
            for (const acc of existingAccounts) {
                await this.removeAccount(acc.id);
            }
            // 重置索引
            await this.setCurrentAccountIndex(0);
        }
        // 添加新账号
        let count = 0;
        for (const apiAcc of apiAccounts) {
            if (apiAcc.email && apiAcc.apiKey) {
                await this.addAccount({
                    email: apiAcc.email,
                    name: apiAcc.name || apiAcc.email.split('@')[0],
                    apiKey: apiAcc.apiKey,
                    apiServerUrl: apiAcc.apiServerUrl || 'https://server.self-serve.windsurf.com',
                    refreshToken: apiAcc.refreshToken || '',
                    planName: apiAcc.planName || ''
                });
                count++;
            }
        }
        console.log(`[AccountManager] 从 API 同步了 ${count} 个账号`);
        return count;
    }
}
exports.AccountManager = AccountManager;
AccountManager.ACCOUNTS_KEY = 'aceSwitch.accounts';
AccountManager.SECRETS_PREFIX = 'aceSwitch.secret.';
AccountManager.CURRENT_INDEX_KEY = 'aceSwitch.currentAccountIndex';
//# sourceMappingURL=accountManager.js.map