import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { root, env } from './run.mjs';
import { authenticatedFetch } from './host-fetch.mjs';
const hostFetch = await authenticatedFetch();
const output = path.join(root, 'output/playwright'); await mkdir(output, { recursive: true });
const projects = JSON.parse(await readFile(`${root}/.runtime/fixtures/manifest.json`, 'utf8'));
const passed = []; let transcript = '';
const remaining = process.argv.includes('--remaining');
if (remaining) passed.push(...JSON.parse(await readFile(`${output}/acceptance.json`, 'utf8')).passed);
async function pw(...args) {
  if (args[0] === 'run-code') args[1] = `async (page) => { ${args[1]} }`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'playwright-cli', '-s=dsh-space', ...args], { cwd: root, env }); let text = '';
    child.stdout.on('data', chunk => text += chunk); child.stderr.on('data', chunk => text += chunk); child.on('error', reject); child.on('exit', code => code === 0 ? resolve(text) : reject(new Error(text)));
  });
  transcript += `\nCOMMAND ${args[0]}\n${result}`;
  await writeFile(`${output}/acceptance.log`, transcript);
  if (result.includes('### Error')) throw new Error(result);
  return result;
}
const snapshot = () => pw('snapshot');
function ref(text, role, name) {
  const line = text.split('\n').find(line => line.includes(`- ${role} "${name}"`) && line.includes('[ref='));
  if (!line) throw new Error(`No ${role} ${name} in current snapshot.`);
  return line.match(/\[ref=([^\]]+)\]/)[1];
}
async function click(role, name) { return pw('click', ref(await snapshot(), role, name)); }
async function select(name, value) { return pw('select', ref(await snapshot(), 'combobox', name), value); }
async function fill(name, value) { return pw('fill', ref(await snapshot(), 'textbox', name), value); }
async function check(name, action) { await action(); passed.push(name); console.log(`PASS ${name}`); await writeFile(`${output}/acceptance.json`, JSON.stringify({ passed, complete: false }, null, 2)); }
async function openLibrary(project) { const s = await snapshot(); if (!s.includes('region "项目资源"')) await click('button', '项目资源'); await select('工作区', projects[project].workspaceId); }
async function reuseCard(name) {
  await snapshot();
  await pw('run-code', `await page.getByRole('article').filter({has:page.getByRole('button',{name:${JSON.stringify('预览 '+name)},exact:true})}).getByRole('button',{name:'引用到对话',exact:true}).click();`);
}
async function upload(name) {
  await click('button', '上传文件'); await snapshot();
  await pw('run-code', `await page.getByLabel('上传文件',{exact:true}).setInputFiles(${JSON.stringify(path.join(root, '.runtime/fixtures', name))}); await page.getByRole('button',{name:${JSON.stringify('预览 '+name)},exact:true}).first().waitFor();`);
}
try {
  const first = await snapshot(); if (first.includes('button "稍后配置"')) await click('button', '稍后配置');
  if (!remaining) {
  await check('official slots and persisted deliverable card', async () => { await openLibrary(0); assert.match(await snapshot(), /预览 report\.md/); });
  await check('text preview and source-session navigation', async () => { await click('button', '预览 report.md'); assert.match(await snapshot(), /这里是资源库生成成果测试/); await click('button', '来源会话'); assert.match(await snapshot(), /generic[^\n]*设计研究/); });
  await check('reuse in current workspace preserves an existing plain-text draft', async () => {
    await fill('描述你想要构建的内容, / 调用指令, @ 文件或对话', '保留这段已有草稿。'); await openLibrary(0); await reuseCard('report.md'); const s = await snapshot(); assert.match(s, /保留这段已有草稿/); assert.match(s, /space_read_resource/); assert.match(s, /generic[^\n]*设计研究/);
  });
  await check('cross-workspace reuse navigates to the resource workspace', async () => {
    await writeFile(path.join(projects[1].path, 'project-b-note.txt'), 'A distinct resource for project B.');
    const res = await hostFetch('http://127.0.0.1:39393/dsh-space/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: projects[1].workspaceId, path: 'project-b-note.txt', role: 'input' }) }); assert.equal(res.status, 201);
    await openLibrary(1); await reuseCard('project-b-note.txt'); const s = await snapshot(); assert.match(s, /generic[^\n]*另一个项目/); assert.match(s, /paragraph[^\n]*project-b-note\.txt/); assert.doesNotMatch(s, /paragraph[^\n]*report\.md/);
  });
  await openLibrary(0);
  await check('image upload, thumbnail and full preview', async () => {
    await upload('reference-board.png'); await click('button', '预览 reference-board.png'); assert.match(await snapshot(), /img "reference-board.png"/);
    const result = await pw('eval', '() => { const image = document.querySelector(".dsp-preview img"); return {loaded: image.complete && image.naturalWidth > 0, width: image.naturalWidth}; }'); assert.match(result, /"loaded": true/); await click('button', '关闭预览');
  });
  await check('PDF upload and embedded browser preview', async () => { await upload('project-brief.pdf'); await click('button', '预览 project-brief.pdf'); assert.match(await snapshot(), /iframe \[ref=/); assert.match(await pw('eval', '() => document.querySelector(".dsp-preview iframe").title'), /project-brief\.pdf/); await pw('screenshot', '--filename='+path.join(output, 'pdf-preview.png')); await click('button', '关闭预览'); });
  await check('HTML is displayed as inert text', async () => { await upload('unsafe-preview.html'); await click('button', '预览 unsafe-preview.html'); assert.match(await snapshot(), /window\.__spaceXss/); assert.match(await pw('eval', '() => window.__spaceXss === undefined'), /true/); await click('button', '关闭预览'); });
  }
  await openLibrary(0);
  await check('role, kind and text filters', async () => {
    await snapshot(); await pw('run-code', `await page.getByRole('button',{name:/^生成成果 [0-9]/}).click();`); assert.match(await snapshot(), /预览 report\.md/); assert.doesNotMatch(await snapshot(), /预览 reference-board/);
    await snapshot(); await pw('run-code', `await page.getByRole('button',{name:/^全部资源 [0-9]/}).click();`); await select('所有类型', 'image'); assert.match(await snapshot(), /预览 reference-board/); assert.doesNotMatch(await snapshot(), /预览 report\.md/); await select('所有类型', 'all');
    await fill('搜索名称或路径', 'never-matches-a-resource'); assert.match(await snapshot(), /没有符合筛选条件/); await fill('搜索名称或路径', '');
  });
  await check('record removal preserves the original workspace file', async () => {
    const file = path.join(projects[0].path, 'removal-check.txt'); await writeFile(file, 'keep this original');
    const response = await hostFetch('http://127.0.0.1:39393/dsh-space/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: projects[0].workspaceId, path: 'removal-check.txt', role: 'output' }) }); assert.equal(response.status, 201);
    await click('button', '刷新'); await click('button', '预览 removal-check.txt'); await click('button', '移除记录'); assert.doesNotMatch(await snapshot(), /预览 removal-check/); assert.equal(await readFile(file, 'utf8'), 'keep this original');
  });
  await check('workspace isolation in the browser', async () => { await select('工作区', projects[1].workspaceId); assert.doesNotMatch(await snapshot(), /预览 reference-board|预览 report\.md|预览 project-brief/); await select('工作区', projects[0].workspaceId); });
  await pw('resize', '1440', '1000'); await pw('screenshot', '--filename='+path.join(output, 'space-desktop.png'));
  await check('responsive layout stays within the viewport', async () => { await pw('resize', '720', '900'); assert.match(await pw('eval', '() => document.documentElement.scrollWidth <= window.innerWidth'), /true/); await pw('screenshot', '--filename='+path.join(output, 'space-narrow.png')); await pw('resize', '1440', '1000'); });
  await writeFile(`${output}/acceptance.json`, JSON.stringify({ officialVersion: '0.2.0-rc.2', browser: 'Chrome', passed, complete: true }, null, 2)); console.log(`${passed.length} browser acceptance checks passed.`);
} catch (error) { console.error(error.message); await writeFile(`${output}/acceptance.json`, JSON.stringify({ passed, complete: false, failure: error.message }, null, 2)); process.exitCode = 1; }
