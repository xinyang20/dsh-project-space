# DSH Project Space

[![CI](https://github.com/xinyang20/dsh-project-space/actions/workflows/ci.yml/badge.svg)](https://github.com/xinyang20/dsh-project-space/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

按工作区管理输入资料与生成成果的 DeepSeek Harness 社区插件。把不同会话留下的文档、图片和 PDF 集中在一个资源页，随时查找、预览并引用到下一次对话。

A workspace resource library for DeepSeek Harness: organize, preview and reuse references and deliverables across conversations.

这是独立维护的社区插件。已验证 **DSH Web 0.2.0-rc.2**，使用官方 Cordis 生命周期、页面插槽和宿主服务。

## 功能

- 在侧边栏打开“项目资源”，每个工作区拥有独立资源库。
- 上传输入资料，或登记工作区内已有文件为输入资料、生成成果。
- 按名称、路径、用途和文件类型筛选，预览文本、图片和 PDF，下载其他格式。
- 跳转资源的来源会话，把引用加入对应工作区的会话草稿，并保留已有普通文本。
- 重启后保留资源索引，提示原文件已修改、丢失或不可访问；移除记录保留文件。
- 浅灰、浅蓝和黑色界面，适配桌面和窄屏。

单个文件最多 **20 MiB**。Markdown、HTML 和 SVG 当前按纯文本预览；文本预览与工具读取最多返回前 **256 KiB**。资源引用加入草稿后，由用户发送消息。

## 安装

在已经安装 DSH **0.2.0-rc.2** 的环境中，下载 [v0.1.2 Release](https://github.com/xinyang20/dsh-project-space/releases/tag/v0.1.2) 的 `dsh-project-space-0.1.2.tgz`，然后执行：

```sh
dsh plugin --profile web add ./dsh-project-space-0.1.2.tgz --ignore-scripts
dsh --profile web
```

也可以让官方安装器直接获取构建包：

```sh
dsh plugin --profile web add https://github.com/xinyang20/dsh-project-space/releases/download/v0.1.2/dsh-project-space-0.1.2.tgz --ignore-scripts
```

重新启动 DSH，点击左侧“项目资源”。如果使用其他 Web profile，把命令中的 `web` 换成自己的 profile 名称。Release 包已包含构建产物，安装时不需要运行构建脚本。

卸载插件：

```sh
dsh plugin --profile web remove dsh-project-space
```

卸载不会删除资源库数据。安装方式采用官方 [组合包与 profile 机制](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)。

## 使用

1. 选择工作区，上传参考文件，或登记该工作区内的相对文件路径，例如 `output/report.md`。
2. 用“输入资料”和“生成成果”区分资源用途，通过搜索及类型筛选找到文件。
3. 打开资源预览，查看来源、下载，或点击“引用到对话”继续使用。

插件提供三个模型工具：

| 工具 | 作用 |
| --- | --- |
| `space_add_resource({path, role})` | 登记当前工作区已有文件；`role` 为 `input` 或 `output`，自动记录来源会话 |
| `space_list_resources({})` | 列出当前工作区跨会话资源和状态 |
| `space_read_resource({id})` | 读取文本，或通过 DSH 附件服务返回图片；其他格式返回供宿主工具读取的路径 |

可以在对话中这样要求：“把报告保存到 `output/report.md`，完成后用 `space_add_resource` 登记为 `output`。”工具从调用者会话确定工作区。

## 数据与支持范围

索引和上传副本保存在 `$DSH_HOME/dsh-project-space`。登记已有文件保留原路径，上传创建资料副本；移除记录不会删除原文件或上传副本。

当前支持本机 DSH Web 0.2.0-rc.2。Desktop、LAN、其他 DSH 版本尚未验证。暂不包含云同步、团队共享、版本回滚、自动扫描、Office 文档预览或语义搜索。

## 开发与测试

使用 Node.js 22.19+ 或 24+，以及 `packageManager` 指定的 pnpm 10.33.2：

```sh
git clone https://github.com/xinyang20/dsh-project-space.git
cd dsh-project-space
node scripts/run.mjs pnpm install --frozen-lockfile --ignore-scripts
node scripts/run.mjs pnpm run check:ci
```

详细的隔离 DSH、浏览器验收和 GitHub 源码安装步骤见 [贡献说明](CONTRIBUTING.md)。2026-10-05 的本地验证通过 17 项自动化测试和 19 个浏览器场景，未调用模型 API；方法与验证边界见 [测试说明](docs/TESTING.md)、[独立审查](docs/REVIEW.md)。GitHub CI 执行类型检查、构建及存储/HTTP 测试。

## 许可

[MIT](LICENSE)。DeepSeek Harness 的名称和品牌属于其各自权利人，本项目独立维护。
