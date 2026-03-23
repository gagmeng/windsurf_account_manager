# Windsurf 账号管理助手

> Windsurf IDE 多账号无感切换管理工具

---

## ✨ 功能特性

- 🔐 **账号登录** — 邮箱密码登录，Firebase Auth 自动获取 API Key
- 📱 **手动添加** — 直接输入 API Key 添加账号
- 🔄 **无感切换** — 一键切换已保存账号，自动注入会话
- ⏭ **快速切换** — 面板按钮或 `Ctrl+Alt+K` 切换下一个账号
- 📊 **配额查询** — 内联显示每日/每周配额百分比、积分余额
- 🔄 **一键刷新** — 批量刷新所有账号配额
- 📋 **复制信息** — 复制完整账号信息（邮箱、类型、API Key、Refresh Token）
- 🔍 **搜索账号** — 快速搜索已保存账号
- 🗑️ **批量管理** — 单个删除或按类型批量删除
- 🔧 **Machine ID 重置** — 内置重置工具
- 🚀 **自动导入** — 启动时自动检测并导入当前登录账号
- ⚙️ **切换设置** — 可配置是否自动刷新窗口

---

## 📦 安装

### VSIX 安装（推荐）

在 [Releases](https://github.com/juststrol/windsurf_account_manager/releases) 下载最新 `.vsix` 文件，然后：

```bash
windsurf --install-extension windsurf-account-manager-x.y.z.vsix --force
```

或在 Windsurf 中：**扩展** → **从 VSIX 安装**

### 从源码构建

```bash
npm install
npx vsce package --allow-missing-repository
```

---

## 🚀 使用方法

1. 点击左侧 Activity Bar 的 **账号切换** 图标
2. 插件启动时自动检测并导入当前登录账号
3. 点击「**添加账号**」添加更多账号
4. 点击账号进行切换，或点击「**⏭ 切换下一个账号**」

### 添加账号

| 方式 | 说明 |
|------|------|
| **登录模式** | 输入邮箱密码，自动获取 Token 和 API Key |
| **手动模式** | 直接输入邮箱和 API Key |

### 配额显示

- **配额模式** — 每日/每周剩余百分比进度条
- **积分模式** — `$余额` 直接显示

---

## ⌨️ 快捷键

- **切换下一个账号**: `Ctrl+Alt+K`（Mac: `⌘+⌥+K`）

---

## 🪄 注意事项

> ⚠️ 需要开启代理/VPN 才能连接 Google Firebase

- 首次切换账号会自动应用补丁并重启 Windsurf
- Windsurf 更新后可能需要重新应用补丁

---

## 🛠️ 技术栈

- TypeScript + VSCode Extension API
- Firebase Auth REST API（直连 Google，无中转）
- Windsurf Web Backend API（配额查询）
- sql.js（本地 SQLite WASM 读取）

---

## ⚠️ 免责声明

本项目仅供学习和研究使用。使用本工具可能违反 Windsurf 服务条款，风险自负。本项目与 Codeium / Windsurf 官方无任何关联。

---

## 📄 License

[MIT](LICENSE.txt)
