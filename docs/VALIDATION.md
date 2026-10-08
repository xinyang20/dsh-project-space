# 0.1.2 最终验证结果

日期：2026-10-05。使用项目子目录内的官方 DSH 0.2.0-rc.2、独立 DSH_HOME 和独立 Chrome 配置。测试没有使用用户日常 DSH profile 或模型密钥，没有调用模型 API。

## 主代理实际执行

| 检查 | 结果 | 当前证据 |
| --- | --- | --- |
| 类型检查及构建 | 通过 | pnpm run typecheck、pnpm run build，执行退出码均为 0 |
| 存储及真实 HTTP | 11/11 通过 | test-results/review-unit.log |
| 最终安装包上的真实 DSH 工具、附件、登录、上传边界 | 6/6 通过 | test-results/review-host-installed.log |
| 真实 Chrome 常规流程 | 11/11 通过 | test-results/review-browser.log、output/playwright/acceptance.json |
| 最终安装包上的浏览器边界流程 | 8/8 通过 | test-results/review-browser-extra-installed.log、output/playwright/review-extra.json |
| 官方安装 0.1.2 | 通过 | test-results/review-package-install.log |
| 安装并重启后的既有资源 | 32 个既有资源 ID 全部保留 | test-results/review-restart-before.json、review-release.json |

常规 Chrome 流程在修复后的开发验证实例运行；新增 8 项边界流程在最终官方安装包上再次运行。两者的源码及构建内容一致性由独立 subagent 单独核对。

本次修复正常大文件的 Base64 校验失败，并补上本地测试辅助接口的登录、同源、工具限制及请求大小检查。新上传副本使用短磁盘名称以改善跨文件系统兼容性，仍显示原文件名并兼容旧记录。中文长文件名在本机 APFS 上未复现失败，不能将兼容性建议写成本机已确认缺陷。

## 独立审查

独立 subagent 在主代理验证之外执行了实际源码审查、4/8/20 MiB 编码校验、66,430 个短编码的新旧规则比较、浏览器状态与草稿保护的内存接口测试、真实 Cordis provider 撤销和恢复，以及最终发布包的逐字节内容比较。详细方法、亲自执行范围及限度见 REVIEW.md。

最终 tar 包共 18 个发布文件。17 个普通文件在开发目录、压缩包和实际安装目录之间逐字节一致；manifest 仅存在 pnpm 打包省略 packageManager 的预期差异。包内没有测试辅助接口、测试运行数据或缓存目录。

## 已知验证边界

验证范围为本机 DSH Web 0.2.0-rc.2。本次验证了真实工具执行与真实浏览器交互，没有验证模型是否主动选择插件工具、DSH Desktop、LAN、多宿主并行写入或其他操作系统。移除记录按产品行为保留上传副本。
