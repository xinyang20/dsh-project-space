# 独立审查记录

对象：DSH Project Space。本文分别记录 2026-10-05 的本地开发审查和 2026-10-08 的公开发布准备审查，均由独立 subagent 检查实际文件和接口实现。前一日期的测试和包比较属于历史记录，不能用来证明后一日期的公开候选包。

审查期间没有修改源码、停止或重启 DSH 服务、操作主代理的浏览器会话、触碰全局 DSH 或用户日常配置。主代理随后明确授权创建本报告。本文不包含登录令牌或密钥。

## 已确认的问题及修复

### P2：合法的大文件在 Base64 校验阶段失败

原 `src/store.ts` 的上传校验使用 `^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`。独立审查在当前 Node.js 24.14.0 中，用 `Buffer.alloc(size).toString('base64')` 生成正常编码并直接执行同一表达式：1、2 MiB 通过，4、8、20 MiB 均抛出 `RangeError: Maximum call stack size exceeded`。因此原实现不能满足界面所声明的单文件 20 MiB 上限。

主代理将它改为平坦的字符及末尾 padding 校验，同时检查编码长度是 4 的倍数，保留解码后的实际字节数上限。独立复审亲自确认：

- 4、8、20 MiB 的正常编码均通过新表达式，解码字节数分别为 4,194,304、8,388,608、20,971,520。
- 从字符集合 `aB+/=x_- ` 生成长度 0 到 5 的全部 66,430 个字符串，与原表达式逐一比较，接受和拒绝结果没有差异。
- 新增存储回归测试检查 4、20 MiB 的实际存储与读取字节一致，20 MiB 加 1 字节拒绝；新增真实主机测试检查 20 MiB 上传、下载及超限响应。独立审查阅读了这些测试，但没有自行运行会写测试资料或访问运行实例的测试；实际执行结果以主代理的测试记录为准。

该修复在独立审查所检查的源码和纯内存校验范围内通过。

## 文件名兼容性的准确边界

原实现将 UUID、连字符和显示名称拼成磁盘文件名。独立审查亲自计算：73 个中文字符加 `.md` 的原名称为 222 UTF-8 字节，追加 UUID 前缀后为 259 字节。这是部分文件系统可能存在的兼容性风险，不能仅根据字节数认定当前 APFS 会拒绝。

主代理在本机实际上传该名称，得到 201，确认当前 macOS/APFS 没有复现此名称导致的 `ENAMETOOLONG`。这项 HTTP 上传是主代理执行的，不是独立审查执行的。本文不将它列为本机已确认缺陷。

作为兼容性改进，新上传的磁盘名称使用 UUID 加最多 12 个字母或数字组成的短扩展名；原始 `name`、`path`、分类及 MIME 信息仍保留在元数据中。独立复审确认读取通过已有 `storedPath` 定位，因此原有使用旧命名方式的记录仍可读取。没有验证其他操作系统或文件系统。

## 亲自执行的状态与生命周期检查

### 浏览器资源状态的异步顺序

通过项目依赖中的 Node.js 和 `--import tsx` 导入实际 `src/client/controller.ts`，使用纯内存 `fetch` 适配器控制请求完成顺序：先开始工作区 A，再开始 B，让 B 先完成、A 后完成。最终选择和资源仍属于 B，旧响应没有覆盖新选择。调用 `Library.dispose()` 后再完成加载，状态保持不变。

### 草稿与跨工作区引用

导入实际 `src/client/index.tsx` 的 `apply`，用内存服务适配器捕获插件注册的动作，并执行以下检查，均通过：

- 引用资源后，原有普通文本草稿仍在，新引用追加在后面。
- 已有结构化引用时拒绝修改，原草稿保持原样，并显示对应错误。
- 输入阶段为 `submitting` 时拒绝修改，原草稿保持原样。
- 跨工作区引用写入资源所属工作区的目标输入框，原工作区草稿保持原样。
- 当前会话和所选资源工作区不同，不附加来源会话；一致时返回当前会话 ID。

以上执行了实际插件动作和状态代码，但使用内存适配器代替真实 DSH 服务、DOM、编辑器及导航。这不能证明真实 Chrome 的焦点、键盘行为、PDF 显示或导航时序；这些需要主代理的真实浏览器验收。

### 真实 Cordis 生命周期

使用项目安装的真实 Cordis 4.0.4 `Context`，提供内存路由和工具注册服务，加载实际主机插件：

1. 加载后注册 1 个资源路由和 3 个 Space 工具。
2. 执行 `ctx.provide('webServer', ...)` 返回的注销函数，实际 Cordis 自动卸载依赖该服务的插件，路由与工具均清空。
3. 恢复 provider 后，插件重新加载，重新注册 1 个路由和 3 个工具。
4. 执行实际 `fiber.dispose()`，路由与工具再次清空。

这验证了真实 Cordis 的依赖撤销、恢复和最终卸载。路由及工具服务为内存适配器，没有启动第二个 DSH 实例，没有验证卸载时正在进行的文件写入。另阅读官方 `webServer.register`、`tools.register` 实现，确认它们返回注销函数，与插件 `ctx.effect` 的使用方式一致。

## 静态审查与测试遗漏检查

阅读范围包括主机与浏览器全部源码、插件 manifest、Cordis bundle patch、构建及隔离运行脚本、README、SCOPE、TESTING、存储和 HTTP 测试、真实主机测试、浏览器验收脚本，以及相关官方依赖中的工作区路径规范化、导航、登录 admission、附件及工具注册实现。

重点检查了工作区归属、目录越界、符号链接、上传上限、索引损坏后的处理、删除记录保留文件、HTML/SVG 的纯文本显示、下载 MIME/响应头、官方 Cookie 验证、请求 Host/Origin 检查，以及草稿保护和跨工作区导航。

主代理另外发现测试专用 `/dsh-space-test/tool` 辅助接口原先缺少鉴权和工具限制。该发现及 HTTP 复现来自主代理。独立复审确认修改后的源码在执行工具前检查本机与同源请求、官方登录 admission、POST、JSON、16 KiB 请求限制、三个 Space 工具白名单和项目索引；新增真实主机测试覆盖相应拒绝场景。该辅助接口属于测试 fixture，插件发布清单没有包含它。

## 2026-10-05 未公开的本地包比较（历史记录）

修复前独立读取了开发目录及隔离 profile 中实际安装的 0.1.1 文件，以 `Buffer.equals` 比较内容，没有计算校验和。`lib/index.js`、`lib/client.js`、`src/store.ts`、`src/client/style.ts`、README、TESTING 和 Cordis patch 内容一致。安装后的 `package.json` 与开发 manifest 唯一字段差异为打包删除了 `packageManager`。

当时的本地 0.1.2 由主代理安装后，独立审查亲自读取 `artifacts/release/dsh-project-space-0.1.2.tgz` 的全部 18 个成员，用 `tar -xOzf` 在内存中取得内容，没有向文件系统解压，也没有计算哈希。这个当时尚未公开的包与本次 GitHub Release 候选包位于不同目录，文件范围和公开 metadata 也不同。历史比较结果如下：

- 17 个非 manifest 文件逐字节比较通过：3 个 `lib` 文件、9 个 `src` 文件、README、SCOPE、TESTING、LICENSE 和 Cordis patch。开发目录、压缩包内容、实际安装副本三者一致。
- 第 18 个文件 `package.json` 的安装副本与压缩包逐字节一致。与开发 manifest 比较，唯一字段差异为 pnpm 打包省略 `packageManager`；其余结构完全一致。
- 三处版本均为 `0.1.2`，`dsh.bundle` 和 `dsh.client` manifest 完全一致。
- 实际安装目录为 `.runtime/dsh-home/profiles/web/node_modules/dsh-project-space`，目录本身不是开发目录的符号链接。
- 全部 18 个成员都属于声明的发布文件范围，没有测试 fixture、`tests`、`test-results`、`scripts`、缓存、浏览器资料、运行配置或运行数据目录。对全部发布成员的文本内容检查，也没有匹配到显式登录令牌、常见密钥或私钥内容。

当时的本地包比较没有发现不一致。以上只记录 2026-10-05 的磁盘和压缩包内容检查；当时运行实例加载、真实 HTTP 与浏览器行为由对应的主代理实例回归记录支持。

## 2026-10-05 独立结论与限度（历史记录）

独立审查发现并复现了大文件 Base64 校验失败，修复后的纯内存校验和相关源码复审通过。当前检查范围内没有发现其他确定的功能缺陷。文件名问题在当前 APFS 上没有复现，已准确限定为兼容性改进。

当时独立审查完成的是未公开的本地 0.1.2 包、开发文件和本地安装副本的一致性比较。没有自行执行真实模型推理、Chrome 页面验收、构建包安装、完整存储或 HTTP 测试，也没有验证 Desktop、LAN、其他平台、大规模资源库、多宿主写入或恶意进程持续切换文件系统路径的情形。当时的整体交付结论需结合相应的主代理真实实例回归测试。

## 2026-10-08 公开发布准备审查

本次目标是公开仓库 `xinyang20/dsh-project-space` 和正式候选包 `artifacts/github-release/dsh-project-space-0.1.2.tgz`，许可为 MIT。独立审查重新读取当前文件，没有将上面的本地 18 个文件比较视为本次证据。只修改了本报告，没有改动源码、操作 DSH 服务或浏览器、创建 GitHub 发布对象。

### 当前仓库候选文件和隐私检查

首次执行 `git ls-files --others --exclude-standard`，得到 40 个待公开文件。主代理随后将部分文件纳入 Git；复核时使用已管理文件和未忽略的待加入文件的并集，仍为 40 个文件，其中包含本报告和 CI workflow 候选文件。

检查范围为 9 个源码文件、8 个开发与验收脚本、3 个自动化测试、1 个宿主测试 fixture、3 个合成测试资料，以及公开文档、许可、manifest、锁文件、TypeScript 配置、Git 忽略配置和 CI workflow。仓库中的合成 PDF、PNG、HTML 是可复现测试资料，区别于忽略目录中的用户运行数据；另检查 PDF 的可读内容和 PNG chunk 清单，没有个人资料或文字元数据。

对全部 40 个文件内容检查个人主目录绝对路径、具体登录令牌、私钥和常见凭据模式，没有命中。待公开清单没有 `node_modules`、`.runtime`、缓存、浏览器资料、测试结果、日志、`.env` 或 `artifacts` 目录。文件中用于复现测试的相对运行目录和从日志读取令牌的代码不是实际运行数据或凭据。

### 当前正式 tar 包的内容一致性

重新读取当前正式候选包的全部 20 个成员，并在内存中逐一取得内容，没有向磁盘解压或计算哈希。主代理修正贡献文档并重新打包后，独立审查再次执行了完整比较：

| 检查 | 实际结果 |
| --- | --- |
| 正式 tar 成员总数 | 20 |
| 与当前开发文件逐字节比较的非 manifest 文件 | 19/19 一致 |
| 源码与构建内容 | 9 个 `src` 文件、3 个 `lib` 文件一致，含 source map |
| 公开文档、许可与 patch | README、CONTRIBUTING、CHANGELOG、SCOPE、TESTING、LICENSE 和 Cordis patch 一致 |
| manifest | 包名、0.1.2 版本、MIT、repository、homepage、bugs、依赖和 `dsh` metadata 一致 |
| 正式包的忽略数据与凭据扫描 | 没有测试 fixture、测试或开发脚本、缓存、运行数据及匹配到的个人绝对路径、登录令牌或凭据 |

tar 的 manifest 相比仓库文件省略 `packageManager` 和 `scripts.prepare`。独立审查读取了实际 pnpm 10.33.2 的 `createExportableManifest` 实现，确认它会省略包管理器字段及发布生命周期脚本，且该清单包含 `prepare`；这两个差异属于正常打包行为，其他 manifest 结构一致。

本报告 `docs/REVIEW.md` 不在 `package.json.files` 中，当前 tar 也没有包含它。因此补充本报告不会改变这 20 个正式 tar 成员或要求重新打包。

### 安装、构建入口和共享依赖

README 推荐已经构建的 Release tar 包，包含下载后安装、URL 安装、重启和卸载命令；命令明确限定 DSH Web 0.2.0-rc.2 和对应 profile。贡献文档另提供固定 `v0.1.2` 的 GitHub 源码安装方式和构建授权说明。Release 与标签 URL 是否已经可访问，须在实际发布完成后检查，不能从当前文档推断发布已完成。

仓库中的 `prepare` 调用 `pnpm run build`，构建脚本只依赖已声明的 esbuild、Node 内置模块和仓库内的 `scripts/run.mjs`；从脚本自身位置确定项目目录，直接构建本仓库的两个入口，没有引用旁边的 monorepo 或个人绝对路径。本次仅作入口和文件范围的静态检查，没有重新执行会修改 `lib` 的构建。

Cordis patch 按包名插入插件；`dsh.bundle.patch`、`dsh.client.platform`、`dsh.client.inject` 与实际主机、浏览器入口及 exports 相配。20 个共享 peer 均同时声明在 devDependencies，DSH 版本固定为 0.2.0-rc.2；Cordis 的 peer 范围为兼容的 `~4.0.4`，开发版本固定为 4.0.4。无状态的 home-paths 工具作为普通 dependency。声明方式与当前[官方打包文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)一致。

### 本次发现并修正的文档问题

初始 CONTRIBUTING 把 Git 构建授权固定写为 `allowBuilds`。实际使用的本地 pnpm 10.33.2 实现及 Git prepare 拒绝提示使用 `onlyBuiltDependencies`，所以不能仅照搬更新文档中的字段名称。主代理现已改为按正在运行的 pnpm 给出的提示选择字段和确切包键，并同时说明这两个配置字段的适用情况；独立审查复核了修正文档和重新打包后的相同内容。推荐的预构建 tar 安装路径不受此文档问题影响。

### 发现标识、命名和发布流程边界

在线读取的[官方 README](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md)指定插件发现 topic 为 `dsh-plugin`；同时使用 `dsh` 便于兼容此前的搜索习惯。当前[官方品牌指引](https://github.com/deepseek-ai/deepseek-harness/blob/master/BRAND_GUIDELINES.md)推荐 DSH 缩写。项目名为 DSH Project Space，README 明确说明社区独立维护，没有使用官方品牌图形，关系描述适当。

审查了 CI workflow，确认它仅申请仓库内容读取权限、关闭 checkout 凭据保留，使用当前实际存在的官方 `checkout@v7`、`setup-node@v7` 和 `pnpm/action-setup@v6` 标签。主代理随后验证 workflow 已上传，且 [CI run 37741946143](https://github.com/xinyang20/dsh-project-space/actions/runs/37741946143) 的 `conclusion` 为 `success`。这项远程结果来自主代理的实际验证记录，独立审查没有自行确认该 run 的终态。

当前文件和正式候选包未发现发布阻断问题。以上结论限于实际检查的 40 个仓库候选文件和 20 个 tar 成员；没有重新执行模型推理、真实 DSH/Chrome 测试、GitHub 源码安装或远程 CI。实际仓库上传、topic、标签、Release 下载和远程检查结果由主代理另行验证。
