import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { root, env } from './run.mjs';
import { authenticatedFetch } from './host-fetch.mjs';

const hostFetch = await authenticatedFetch();
const projects = JSON.parse(await readFile(`${root}/.runtime/fixtures/manifest.json`, 'utf8'));
const output = path.join(root, 'output/playwright');
const passed = [], cleanupIds = [], cleanupFiles = [];
const suffix = randomUUID().slice(0, 8);
const largeName = `review-20MiB-${suffix}.bin`, overName = `review-over-limit-${suffix}.bin`, missingName = `review-missing-${suffix}.md`;
let transcript = '';
async function pw(...args) {
  if (args[0] === 'run-code') args[1] = `async (page) => { ${args[1]} }`;
  const text = await new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'playwright-cli', '-s=dsh-space', ...args], { cwd: root, env }); let value = '';
    child.stdout.on('data', chunk => value += chunk); child.stderr.on('data', chunk => value += chunk);
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(value) : reject(new Error(value)));
  });
  transcript += `\nCOMMAND ${args[0]}\n${text}`;
  await writeFile(`${output}/review-extra.log`, transcript);
  if (text.includes('### Error')) throw new Error(text);
  return text;
}
const snapshot = () => pw('snapshot');
function ref(text, role, name) {
  const line = text.split('\n').find(line => line.includes(`- ${role} "${name}"`) && line.includes('[ref='));
  if (!line) throw new Error(`Missing ${role}: ${name}`);
  return line.match(/\[ref=([^\]]+)\]/)[1];
}
const click = async name => pw('click', ref(await snapshot(), 'button', name));
const fill = async (name, value) => pw('fill', ref(await snapshot(), 'textbox', name), value);
const select = async (name, value) => pw('select', ref(await snapshot(), 'combobox', name), value);
const resources = async project => { const response = await hostFetch(`http://127.0.0.1:39393/dsh-space/api/resources?workspaceId=${projects[project].workspaceId}`); assert.equal(response.status, 200); return response.json(); };
async function check(name, action) { await action(); passed.push(name); await writeFile(`${output}/review-extra.json`, JSON.stringify({ passed, complete: false }, null, 2)); console.log(`PASS ${name}`); }
async function choose(project) {
  const state = await snapshot();
  if (!state.includes('region "项目资源"')) await click('项目资源');
  await select('工作区', projects[project].workspaceId);
}
async function fileInput(file) { await snapshot(); await pw('run-code', `await page.getByLabel('上传文件',{exact:true}).setInputFiles(${JSON.stringify(file)});`); }
try {
  const initial = await snapshot(); if (initial.includes('button "稍后配置"')) await click('稍后配置');
  await choose(0);
  if ((await snapshot()).includes('button "取消添加"')) await click('取消添加');
  const largePath = `${root}/.runtime/fixtures/${largeName}`, overPath = `${root}/.runtime/fixtures/${overName}`;
  await writeFile(largePath, Buffer.alloc(20 * 1024 * 1024, 0x41)); cleanupFiles.push(largePath);
  await writeFile(overPath, Buffer.alloc(20 * 1024 * 1024 + 1, 0x41)); cleanupFiles.push(overPath);
  await check('Chrome file input uploads exactly 20 MiB through FileReader and real HTTP', async () => {
    await click('上传文件'); await fileInput(largePath);
    await pw('run-code', `await page.getByRole('button',{name:${JSON.stringify('预览 '+largeName)},exact:true}).waitFor();`);
    const record = (await resources(0)).find(value => value.name === largeName); assert.ok(record); cleanupIds.push(record.id); assert.equal(record.size, 20 * 1024 * 1024);
  });
  await check('Chrome rejects one byte over the upload limit without adding a resource', async () => {
    const count = (await resources(0)).length; await fileInput(overPath);
    await pw('run-code', `await page.getByRole('alert').filter({hasText:'文件超过 20 MiB 上限。'}).waitFor();`);
    assert.equal((await resources(0)).length, count); assert.ok(!(await resources(0)).some(value => value.name === overName)); await click('取消添加');
  });
  await check('unsupported preview remains usable and browser download preserves all bytes', async () => {
    await click('预览 '+largeName); assert.match(await snapshot(), /该格式可下载，暂不支持预览/);
    const file = `${output}/review-download.bin`;
    await snapshot(); await pw('run-code', `const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'下载文件',exact:true}).click()]);if(download.suggestedFilename()!==${JSON.stringify(largeName)})throw new Error('Wrong download filename');await download.saveAs(${JSON.stringify(file)});`);
    assert.deepEqual(await readFile(file), Buffer.alloc(20 * 1024 * 1024, 0x41)); await click('关闭预览');
  });
  await check('preview traps forward/backward tab focus and Escape restores its trigger', async () => {
    await click('预览 report.md');
    assert.match(await pw('eval', '() => document.activeElement.textContent'), /关闭预览/);
    await pw('press', 'Shift+Tab'); assert.match(await pw('eval', '() => document.activeElement.textContent'), /移除记录/);
    await pw('press', 'Tab'); assert.match(await pw('eval', '() => document.activeElement.textContent'), /关闭预览/);
    await pw('press', 'Escape'); assert.doesNotMatch(await snapshot(), /dialog "report.md"/);
    assert.match(await pw('eval', '() => document.activeElement.getAttribute("aria-label")'), /预览 report\.md/);
  });
  await check('outside-workspace registration is rejected in the actual page', async () => {
    const count = (await resources(0)).length; await click('登记已有文件'); await fill('工作区内的相对文件路径', '../outside-file.txt'); await click('添加到资源库');
    await pw('run-code', `await page.getByRole('alert').filter({hasText:'只能登记该工作区内的文件。'}).waitFor();`);
    assert.equal((await resources(0)).length, count); await click('取消添加');
  });
  await check('deleted originals show unavailable state, disable reuse and fail preview clearly', async () => {
    const file = path.join(projects[0].path, missingName); await writeFile(file, '# Temporary review document'); cleanupFiles.push(file);
    await click('登记已有文件'); await fill('工作区内的相对文件路径', missingName); await click('添加到资源库');
    await pw('run-code', `await page.getByRole('button',{name:${JSON.stringify('预览 '+missingName)},exact:true}).waitFor();`);
    const record=(await resources(0)).find(value=>value.name===missingName); assert.ok(record); cleanupIds.push(record.id);
    await click('取消添加'); await unlink(file); await click('刷新');
    await snapshot(); await pw('run-code', `const card=page.getByRole('article').filter({has:page.getByRole('button',{name:${JSON.stringify('预览 '+missingName)},exact:true})});await card.getByText('文件已丢失或不可访问',{exact:true}).waitFor();if(!await card.getByRole('button',{name:'引用到对话',exact:true}).isDisabled())throw new Error('Missing file reuse is enabled');`);
    await click('预览 '+missingName); await pw('run-code', `await page.getByRole('alert').filter({hasText:'文件已不存在。'}).waitFor();`); await click('关闭预览');
  });
  await check('a delayed earlier workspace response cannot replace the newer selection', async () => {
    await snapshot(); await pw('run-code', `await page.route('**/dsh-space/api/resources?*',async route=>{if(new URL(route.request().url()).searchParams.get('workspaceId')===${JSON.stringify(projects[0].workspaceId)})await new Promise(resolve=>setTimeout(resolve,600));await route.continue();});try{await page.getByLabel('工作区',{exact:true}).selectOption(${JSON.stringify(projects[0].workspaceId)});await page.getByLabel('工作区',{exact:true}).selectOption(${JSON.stringify(projects[1].workspaceId)});await page.getByRole('button',{name:'预览 project-b-note.txt',exact:true}).waitFor();await new Promise(resolve=>setTimeout(resolve,900));if(await page.getByLabel('工作区',{exact:true}).inputValue()!==${JSON.stringify(projects[1].workspaceId)})throw new Error('Workspace changed back');if(await page.getByRole('button',{name:'预览 report.md',exact:true}).count())throw new Error('Earlier workspace leaked');}finally{await page.unroute('**/dsh-space/api/resources?*');}`);
    await choose(0);
  });
  await check('preview dialog fits 390, 720 and 1440 px viewports', async () => {
    await click('预览 report.md');
    for (const [width,height] of [[390,844],[720,900],[1440,1000]]) {
      await pw('resize',String(width),String(height));
      assert.match(await pw('eval','() => {const dialog=document.querySelector(".dsp-dialog");return {fits:document.documentElement.scrollWidth<=innerWidth && dialog.scrollWidth<=dialog.clientWidth};}'), /"fits": true/);
      await pw('screenshot','--filename='+output+`/review-preview-${width}.png`);
    }
    await click('关闭预览');
  });
  await writeFile(`${output}/review-extra.json`,JSON.stringify({passed,complete:true},null,2)); console.log(`${passed.length} additional browser checks passed.`);
} catch(error) {
  await writeFile(`${output}/review-extra.json`,JSON.stringify({passed,complete:false,failure:error.message},null,2)); console.error(error); process.exitCode=1;
} finally {
  for(const id of cleanupIds) await hostFetch('http://127.0.0.1:39393/dsh-space/api/resources?'+new URLSearchParams({workspaceId:projects[0].workspaceId,id}),{method:'DELETE'});
  for(const file of cleanupFiles) await unlink(file).catch(()=>{});
  await pw('resize','1440','1000').catch(()=>{});
  await click('刷新').catch(()=>{});
}
