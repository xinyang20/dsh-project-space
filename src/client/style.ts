export const css = `
.dsp { --dsp-bg:#f5f6f8; --dsp-surface:#fff; --dsp-ink:#16181d; --dsp-muted:#676d78; --dsp-line:#e0e4eb; --dsp-blue:#e8f1ff; --dsp-blue-ink:#315fa8; --dsp-focus:#648fd8; height:100%; overflow:auto; color:var(--dsp-ink); background:var(--dsp-bg); color-scheme:light; font:14px/1.55 system-ui,sans-serif; }
.dsp * { box-sizing:border-box; }
.dsp-shell { max-width:1400px; margin:auto; padding:40px 40px 32px; }
.dsp-icon { flex:none; vertical-align:middle; }
.dsp-eyebrow { display:flex; align-items:center; gap:10px; color:var(--dsp-muted); font-size:11px; font-weight:650; letter-spacing:.09em; }
.dsp-eyebrow span:first-child { color:var(--dsp-ink); }
.dsp-eyebrow-dot { width:5px; height:5px; border-radius:50%; background:#a5c3f3; }
.dsp h1 { color:var(--dsp-ink); font-size:32px; line-height:1.25; font-weight:650; letter-spacing:-.04em; margin:12px 0 10px; }
.dsp h2 { font-size:17px; line-height:1.4; margin:0 0 8px; }
.dsp p { margin:8px 0; }
.dsp-muted { color:var(--dsp-muted); }
.dsp button,.dsp select,.dsp input,.dsp a.dsp-button { font:inherit; border:1px solid var(--dsp-line); border-radius:9px; padding:9px 13px; background:var(--dsp-surface); color:var(--dsp-ink); }
.dsp button,.dsp a { cursor:pointer; }
.dsp button,.dsp a.dsp-button { display:inline-flex; align-items:center; justify-content:center; gap:7px; transition:background .15s,border-color .15s,box-shadow .15s; }
.dsp button:hover,.dsp a.dsp-button:hover { border-color:#b7c7df; background:#f0f4fa; }
.dsp button:focus-visible,.dsp a:focus-visible,.dsp input:focus-visible,.dsp select:focus-visible { outline:2px solid var(--dsp-focus); outline-offset:3px; }
.dsp button:disabled { cursor:default; opacity:.45; }
.dsp .dsp-primary { background:var(--dsp-ink); border-color:var(--dsp-ink); color:white; font-weight:550; }
.dsp .dsp-primary:hover { background:#303640; border-color:#303640; }
.dsp .dsp-button { text-decoration:none; }
.dsp .dsp-back { background:transparent; border-color:transparent; color:var(--dsp-muted); }
.dsp-top { display:flex; justify-content:space-between; gap:24px; align-items:center; margin-bottom:30px; }
.dsp-top-actions,.dsp-controls,.dsp-tabs,.dsp-actions { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
.dsp-project { padding:20px; background:var(--dsp-surface); border:1px solid var(--dsp-line); border-radius:14px; margin:0 0 26px; display:flex; align-items:center; justify-content:space-between; gap:20px; box-shadow:0 2px 5px #10182803; }
.dsp-project-info { display:flex; align-items:center; gap:15px; min-width:0; flex:1; }
.dsp-workspace-icon { width:46px; height:46px; display:grid; place-items:center; flex:none; border:1px solid #d9e6fa; border-radius:12px; color:var(--dsp-blue-ink); background:var(--dsp-blue); }
.dsp-project-text { min-width:0; flex:1; }
.dsp-project label { display:block; font-size:11px; font-weight:550; color:var(--dsp-muted); margin-bottom:3px; }
.dsp-project select { min-width:160px; max-width:100%; border:0; padding:2px 24px 2px 0; font-size:15px; font-weight:600; }
.dsp-project .dsp-top-actions { flex:none; }
.dsp-path { font:12px/1.5 ui-monospace,monospace; overflow-wrap:anywhere; margin-top:6px; }
.dsp-project-path { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
.dsp-tabs { border-bottom:1px solid var(--dsp-line); gap:8px; padding-bottom:14px; }
.dsp-tabs button { background:transparent; border-color:transparent; color:var(--dsp-muted); padding:8px 12px; font-weight:550; }
.dsp-tabs button[aria-pressed=true] { background:var(--dsp-blue); color:var(--dsp-blue-ink); border-color:#d9e6fa; }
.dsp-tab-count { min-width:22px; padding:0 5px; border-radius:5px; font-size:11px; font-weight:600; background:#e9ebef; color:#525966; }
.dsp-tabs button[aria-pressed=true] .dsp-tab-count { background:#d3e3fd; color:var(--dsp-blue-ink); }
.dsp-controls { margin:20px 0 22px; }
.dsp-search { position:relative; flex:1; min-width:180px; }
.dsp-search > svg { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#858c98; pointer-events:none; }
.dsp-search input { width:100%; padding-left:39px; }
.dsp input::placeholder { color:#868c96; }
.dsp-resource-count { font-size:12px; white-space:nowrap; }
.dsp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:18px; }
.dsp-card { min-width:0; border:1px solid var(--dsp-line); border-radius:13px; overflow:hidden; background:var(--dsp-surface); transition:border-color .15s,box-shadow .15s,transform .15s; }
.dsp-card:hover { border-color:#bfd2ef; box-shadow:0 6px 20px #10182808; transform:translateY(-1px); }
.dsp .dsp-card-open { width:100%; border:0; border-radius:0; padding:0; text-align:left; display:block; background:var(--dsp-surface); }
.dsp .dsp-card-open:hover { background:var(--dsp-surface); }
.dsp .dsp-card-open:focus-visible { outline-offset:-3px; }
.dsp-thumb { height:154px; display:flex; justify-content:center; align-items:center; background:#eef1f5; position:relative; color:#8094b2; border-bottom:1px solid #e8ecf2; }
.dsp-thumb[data-kind=pdf] { background:#edf3fc; }
.dsp-thumb[data-kind=image] { background:#edf1f7; }
.dsp-thumb > svg { width:52px; height:62px; filter:drop-shadow(0 3px 3px #10182808); }
.dsp-thumb img { width:100%; height:100%; object-fit:contain; }
.dsp-file-format { position:absolute; right:12px; bottom:11px; font-size:10px; letter-spacing:.05em; font-weight:650; color:#5a6a80; background:#ffffffd9; border:1px solid #dde4ee; border-radius:5px; padding:2px 6px; }
.dsp-card-body { padding:16px 16px 12px; }
.dsp-name { font-size:13px; font-weight:600; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dsp-card-meta { margin-top:7px; display:flex; justify-content:space-between; gap:6px; font-size:11px; }
.dsp-role { display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:3px 8px; border:1px solid #d9e6fa; border-radius:6px; background:var(--dsp-blue); color:var(--dsp-blue-ink); }
.dsp-role.output { background:#eef0f4; border-color:#e0e4eb; color:#414957; }
.dsp-state { font-size:11px; color:#596575; margin-top:8px; display:flex; align-items:center; gap:5px; }
.dsp-state:before { content:''; width:5px; height:5px; border-radius:50%; background:#7b8fae; }
.dsp-card-footer { padding:0 16px 15px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.dsp-card-footer button { padding:5px 7px; font-size:11px; background:transparent; border-color:transparent; color:#545e6c; }
.dsp-card-footer button:hover { background:var(--dsp-blue); color:var(--dsp-blue-ink); border-color:transparent; }
.dsp-blank { padding:65px 20px; text-align:center; border:1px dashed #cdd8e8; background:#f0f4fa; border-radius:14px; }
.dsp-blank-icon { display:grid; place-items:center; width:58px; height:58px; color:var(--dsp-blue-ink); background:var(--dsp-blue); border:1px solid #d9e6fa; border-radius:15px; margin:0 auto 16px; }
.dsp-notice { color:#37465d; background:var(--dsp-blue); border:1px solid #d2e2fa; border-radius:9px; padding:11px 15px; margin:16px 0; }
.dsp-form { margin:18px 0 26px; padding:20px; background:var(--dsp-surface); border:1px solid #cfddf2; border-radius:14px; }
.dsp-form .dsp-controls { margin:0 0 16px; }
.dsp-form .dsp-controls strong { flex:1; }
.dsp-form label { display:block; margin-bottom:6px; color:var(--dsp-muted); font-size:12px; }
.dsp-form input[type=text] { width:100%; margin:4px 0 14px; }
.dsp-form input[type=file] { max-width:100%; }
.dsp-foot { margin-top:25px; font-size:11px; }
.dsp-shell > .dsp-foot { padding-top:16px; border-top:1px solid var(--dsp-line); }
.dsp-modal { position:fixed; inset:0; z-index:1000; background:#10182866; display:flex; justify-content:center; align-items:center; padding:24px; }
.dsp-dialog { width:min(1080px,100%); height:min(780px,90vh); color:var(--dsp-ink); border:1px solid #ffffff80; border-radius:18px; background:var(--dsp-surface); box-shadow:0 24px 90px #10182833; display:flex; flex-direction:column; overflow:hidden; }
.dsp-dialog-header { padding:17px 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--dsp-line); gap:20px; }
.dsp-dialog-header h2 { min-width:0; overflow-wrap:anywhere; margin:0; font-size:15px; }
.dsp-dialog-header button { flex:none; }
.dsp-dialog-content { display:grid; grid-template-columns:minmax(0,1fr) 280px; flex:1; min-height:0; }
.dsp-preview { padding:26px; min-width:0; overflow:auto; display:flex; flex-direction:column; background:#f5f7fa; }
.dsp-preview pre { white-space:pre-wrap; overflow-wrap:anywhere; font:13px/1.8 ui-monospace,monospace; margin:0; padding:24px; background:var(--dsp-surface); border:1px solid var(--dsp-line); border-radius:10px; }
.dsp-preview img { max-width:100%; max-height:100%; object-fit:contain; margin:auto; border-radius:6px; }
.dsp-preview iframe { border:0; flex:1; min-height:300px; width:100%; border-radius:8px; }
.dsp-details { padding:24px; background:var(--dsp-surface); border-left:1px solid var(--dsp-line); overflow:auto; }
.dsp-details dt { color:var(--dsp-muted); font-size:11px; margin-top:18px; }
.dsp-details dd { margin:5px 0 0; overflow-wrap:anywhere; font-size:12px; }
.dsp-details .dsp-actions { align-items:stretch; flex-direction:column; margin-top:25px; }
.dsp-details .dsp-danger { color:var(--dsp-muted); background:transparent; border-color:transparent; }
@media(max-width:1050px) { .dsp-project { align-items:flex-start; flex-direction:column; } .dsp-project-info { width:100%; } .dsp-project .dsp-top-actions { width:100%; justify-content:flex-end; } }
@media(max-width:800px) { .dsp-shell { padding:26px 20px; } .dsp-top { gap:14px; align-items:flex-start; flex-direction:column; } .dsp h1 { font-size:28px; } .dsp-top .dsp-back { padding:5px 0; } .dsp-project { padding:16px; } .dsp-project .dsp-top-actions { justify-content:flex-start; } .dsp-grid { grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; } .dsp-dialog-content { display:block; overflow:auto; } .dsp-details { border-left:0; border-top:1px solid var(--dsp-line); } .dsp-preview { min-height:260px; padding:18px; } .dsp-preview pre { padding:16px; } .dsp-modal { padding:12px; } }
@media(max-width:440px) { .dsp-shell { padding:22px 14px; } .dsp-project .dsp-top-actions { gap:6px; } .dsp-project .dsp-top-actions button { font-size:12px; padding:8px 9px; } .dsp-tabs { gap:3px; } .dsp-tabs button { padding:8px; font-size:12px; } .dsp-grid { grid-template-columns:1fr; } .dsp-search { flex-basis:100%; } .dsp-resource-count { margin-left:auto; } }
@media(prefers-reduced-motion:reduce) { .dsp button,.dsp a.dsp-button,.dsp-card { transition:none; } .dsp-card:hover { transform:none; } }
`;
