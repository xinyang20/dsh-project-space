# 贡献与本地开发

Node.js 22.19+ 或 24+，pnpm 10.33.2。保留 pnpm-lock.yaml，使用 pnpm 管理依赖和运行命令。

## 基础检查

从仓库根目录运行：

```sh
node scripts/run.mjs pnpm install --frozen-lockfile --ignore-scripts
node scripts/run.mjs pnpm run check:ci
```

check:ci 包括主机和浏览器 TypeScript 类型检查、构建，以及存储/HTTP 自动化测试。GitHub CI 运行相同检查。测试产物和缓存保存在仓库内的忽略目录。

## 隔离 DSH 实例

```sh
node scripts/prepare-local.mjs
node scripts/run.mjs pnpm run dev:isolated > .runtime/dsh-server.log 2>&1
```

独立 DSH_HOME 位于 `.runtime/dsh-home`，示例工作区位于 `.runtime/fixtures`。开发启动脚本固定使用项目依赖中的 DSH 0.2.0-rc.2。默认演示端口为 39393，若端口已被使用，请先停止自己启动的测试实例。

在另一个终端运行真实宿主检查：

```sh
node scripts/run.mjs pnpm run test:host
```

浏览器验收需要已安装的 Chrome 和仓库中的 Playwright CLI：

```sh
node scripts/browser-open.mjs
node scripts/run.mjs pnpm run test:browser
node scripts/run.mjs pnpm run test:browser:deep
```

重新打开同一个浏览器会话可以使用 `node scripts/browser-open.mjs --reuse`。测试会上传合成文件和创建临时记录，运行数据均保存在隔离实例中；上传副本按产品行为保留。结束后执行 `node scripts/run.mjs pnpm exec playwright-cli -s=dsh-space close`，并在服务终端按 Ctrl+C 停止 DSH。

## 构建安装包

```sh
node scripts/run.mjs pnpm pack --pack-destination artifacts/release
```

prepare 脚本在打包前构建 lib/index.js 和官方 ModuleLoader 浏览器入口 lib/client.js。发布包由 package.json 的 files 清单限定，不包含测试辅助接口、运行资料、缓存或登录凭据。

## 从 GitHub 源码安装

推荐使用 README 中的预构建 Release 包。需要直接安装源码时，可以固定版本：

```sh
dsh plugin --profile web add github:xinyang20/dsh-project-space#v0.1.2
```

Git 依赖的 prepare 脚本需要构建授权。首次安装如果被阻止，请按正在执行的 pnpm 打印的提示，将确切包键加入该 profile 的 pnpm-workspace.yaml：本项目使用的 pnpm 10.33.2 使用 onlyBuiltDependencies，支持 allowBuilds 的较新版本使用 allowBuilds，然后重新安装。授权前请检查代码；prepare 会在宿主机器运行，不能依赖 agent 沙箱。具体机制见 [DSH 官方打包文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)，配置字段以实际 pnpm 版本的提示为准。

## 接口与发现

插件通过 dsh.bundle.patch 声明 Cordis 配置层，通过 dsh.client 声明浏览器依赖。与宿主共享的服务同时声明在 peerDependencies 和 devDependencies 中。GitHub 仓库添加 `dsh-plugin`（官方发现标识）和 `dsh` topic。

项目命名遵循官方推荐的 DSH 缩写，明确标注社区维护关系。官方 [品牌指引](https://github.com/deepseek-ai/deepseek-harness/blob/master/BRAND_GUIDELINES.md) 和 [插件发布文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish) 是对应规范来源。
