# 测试与验收记录

测试日期：2026-10-05。环境：macOS arm64、Node.js 24.14.0、pnpm 10.33.2、官方 DSH 0.2.0-rc.2、Cordis 4.0.4、Chrome。

所有实现、依赖、缓存、测试资料、浏览器配置与独立 `DSH_HOME` 均放在 `dsh-space` 子目录。没有将插件安装到原有用户 profile，没有配置或使用模型 API Key。

## 0.1.2 独立审查与边界验证

独立 subagent 检查了实际源码、官方 Cordis/DSH 接口、状态管理、生命周期和测试遗漏，记录见 `docs/REVIEW.md`。审查发现并复现原 Base64 正则在正常 4、8、20 MiB 编码上抛出 `RangeError`；已改为平坦校验并保留编码长度和解码字节数限制。独立复审比较了 66,430 个短编码，新旧规则的接受结果相同。新上传使用 UUID 加短扩展名作为磁盘名称，显示名保持不变；旧上传记录仍兼容。中文长名在当前 APFS 上未复现错误，此项准确限定为文件系统兼容性改进。

主代理还发现测试辅助接口缺少登录和来源检查，现已加入官方 admission、本机及同源检查、POST/JSON、16 KiB 请求限制和三个 Space 工具白名单。该接口只存在于测试 fixture，不包含在插件构建包中。

修复后存储及真实 HTTP 测试 11/11 通过，真实 DSH 集成测试 6/6 通过。覆盖真实 4、20 MiB 存储与读取字节一致、20 MiB HTTP 上传和下载、超过上限 1 字节拒绝、长中文和 emoji 名称，以及测试接口的未登录、伪造来源、无关工具、无效 JSON 和大请求拒绝。记录见 `test-results/review-unit.log`、`review-host.log`。

真实 Chrome 原有 11 个场景和新增 8 个场景均通过。新增场景为：FileReader 上传 20 MiB、客户端拒绝超限、其他格式预览及实际下载字节一致、正反 Tab 焦点循环与 Escape 恢复、页面登记越界路径拒绝、原文件缺失后禁用引用并显示错误、延迟旧请求不覆盖新工作区、390/720/1440 px 预览弹窗无横向溢出。记录见 `output/playwright/review-extra.json`、`review-extra.log`、`test-results/review-browser.log`、`review-browser-extra.log`；弹窗截图为 `review-preview-390.png`、`review-preview-720.png`、`review-preview-1440.png`。

新增浏览器测试结束时仅移除本次创建的临时资源记录和原始测试文件；上传副本仍按产品行为保留。测试过程中不调用模型 API。

## 0.1.1 页面设计检查

资源页统一为浅灰背景、白色卡片、浅蓝选中状态及输入资料标记、黑色文字和主按钮。生成成果使用灰色标记，页面组件不再使用绿色或紫色。文档缩略图改为线条图标并显示真实文件扩展名；图片继续展示资源本身的内容。更新工作区栏、搜索框、卡片、添加表单和预览弹窗，保留官方页面插槽及已有资源功能。

本次修改后重新执行 `pnpm run typecheck`、`pnpm run build` 和完整的 `pnpm run test:browser`，均通过；11 个浏览器场景的本次运行输出见 `test-results/theme-browser.log`。浏览器计算样式确认页面背景为 `rgb(245, 246, 248)`、主要文字及主按钮为 `rgb(22, 24, 29)`、选中标签背景为 `rgb(232, 241, 255)`。1440、720、390 px 布局均无横向页面溢出，1440 和 390 px 的资源区域本身也无横向溢出。视觉检查截图见 `output/playwright/theme-desktop.png`、`space-narrow.png` 和 `theme-mobile.png`。原有主机与存储测试记录见下表；本次未修改这些模块。

## 已完成的检查

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 主机与浏览器独立 TypeScript 类型检查 | 通过 | `pnpm run typecheck`，包含全部主机测试代码 |
| 构建 Node 主机模块和官方 ModuleLoader 浏览器模块 | 通过 | `lib/index.js`、`lib/client.js` |
| 存储与真实 HTTP 自动测试 | 11/11 通过 | `tests/store.test.ts`、`tests/http.test.ts` |
| 真实 DSH ToolRuntime / Agent / 附件 / 登录集成测试 | 6/6 通过 | `tests/host.test.ts` |
| 真实 DSH 页面与 Chrome 验收 | 19/19 通过 | `output/playwright/acceptance.json`、`review-extra.json`，逐步交互日志与截图 |
| 官方插件安装命令与 bundle 自动加载 | 通过 | `test-results/package-install.log`、`test-results/installed-config.yml` |
| 安装并重启后既有资源 ID 保留 | 16 个既有资源均保留 | `test-results/restart-before.json`、`test-results/package-install.json` |

存储与 HTTP 检查包含工作区隔离、来源会话拒绝跨项目绑定、并发写入与重复登记、目录越界、工作区外符号链接、登记后文件被替换为越界符号链接、删除记录不删除文件、HTML/SVG 纯文本处理、文本截断、修改与丢失状态、上传编码及大小限制、损坏索引拒绝覆盖、私有文件权限、Host/Origin/跨站请求检查。

真实主机检查通过官方 `ToolRuntime.execute` 调用插件工具，使用真实 Agent 会话，图片读取返回 DSH 持久化附件。资源网页接口要求官方 DSH 登录 Cookie；未登录或无效 Cookie 返回 401。没有通过模型发起联网推理，因此不宣称验证了模型是否会主动选择工具或产生高质量内容。

## 浏览器验收场景

1. 官方页面插槽与已保存成果卡片。
2. 文本预览与来源会话跳转。
3. 同项目引用保留已有普通文本草稿。
4. 跨项目引用打开资源所属项目的会话，避免写入其他项目。
5. 图片上传、缩略图和大图预览，检查实际图片尺寸。
6. PDF 上传与浏览器内嵌预览，实际检查页面显示。
7. HTML 作为惰性文本显示，脚本没有执行。
8. 用途、类型与名称筛选。
9. 移除资源记录后原工作区文件仍存在。
10. 浏览器中切换工作区时资源列表隔离。
11. 720 px 窄屏没有横向页面溢出；1440 px 桌面画面已检查。

截图见 `output/playwright/space-desktop.png`、`space-narrow.png`、`pdf-preview.png`。

## 复现

以下记录来自 2026-10-05 的本地验证。原始日志、截图与运行数据属于本地忽略文件，不包含在 GitHub 仓库中；重新执行测试可生成当前结果。以下命令均从仓库根目录运行，首次准备时先安装依赖并构建：

```sh
node scripts/run.mjs pnpm install --frozen-lockfile --ignore-scripts
node scripts/run.mjs pnpm run typecheck
node scripts/run.mjs pnpm run build
node scripts/prepare-local.mjs
node scripts/run.mjs pnpm run dev:isolated
```

运行中的开发实例使用本地固定版本 CLI；`scripts/dsh.mjs` 检查版本和本地文件，缺少依赖时直接失败，不会使用全局 `dsh`。

在另一个终端执行：

```sh
node scripts/run.mjs pnpm run test
node scripts/run.mjs pnpm run test:host
node scripts/browser-open.mjs
node scripts/run.mjs pnpm run test:browser
node scripts/run.mjs pnpm run test:browser:deep
```

重新打开已有的隔离浏览器会话时，使用 `node scripts/browser-open.mjs --reuse`。结束浏览器验收后，可以执行 `node scripts/run.mjs pnpm exec playwright-cli -s=dsh-space close`。

测试构建包时，先停止开发实例，再通过官方安装器安装到隔离 profile：

```sh
node scripts/run.mjs pnpm pack --pack-destination artifacts/release
node scripts/run.mjs pnpm run dsh plugin --profile web add ./artifacts/release/dsh-project-space-0.1.2.tgz --offline --ignore-scripts
node scripts/prepare-local.mjs --installed
node scripts/run.mjs pnpm run dev:isolated
```

`--installed` 模式的测试补丁仅加入样例工作区插件，不额外插入资源库插件。资源库由构建包的 `dsh.bundle.patch` 自动装载，因此可以验证正式安装路径。

## 发现并修复的问题

真实浏览器测试发现：在工作区导航准备回调中切换全局面板，会取消 DSH 的待完成导航；通过跨作用域事件插入文本也可能命中当前可见输入框。现已使用指定会话的官方 `SessionInput` 接口插入草稿，由 `uiWorkspace.openWorkspace` 完成跨项目导航。同项目和跨项目场景均通过复查。

安装验收曾受到 `pnpm exec` 环境与开发 profile 链接影响，导致开发依赖目录被移走并出现全局 CLI 回退。没有将这次结果计入验收。恢复已有依赖后，固定本地 `0.2.0-rc.2` CLI，重新执行官方安装、自动加载、工具调用与重启检查，均已通过。

## 验证范围

已验证本机 DSH Web 0.2.0-rc.2。未验证 Desktop、旧版 0.1 CLI、LAN 访问、未来插件 API、真实模型生成流程、超大资源库、多宿主同时写入。Markdown 为纯文本预览；Office 文档可保存和下载，暂不预览；移除记录保留上传副本，需要自行管理占用空间。
