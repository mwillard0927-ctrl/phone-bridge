// Project Boards — shared module for Phone Bridge + Bridge Hub
// mountBoard({sb, user, displayName, root, onUnread, toast}) → {projects(), postTo(projectId, {title, body, files}), refresh()}
const TAGS = ['Note', 'Idea', 'Question', 'Decision', 'Urgent'];
const TAGC = {Note: '#64748b', Idea: '#0e7490', Question: '#7c3aed', Decision: '#0f7a4a', Urgent: '#b91c1c'};
const MAXF = 10 * 1048576;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) };
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

const CSS = `
.bd{display:grid;gap:14px}
.bd .pbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bd .pchip{font:700 15px var(--body,system-ui);min-height:40px;padding:6px 14px;border-radius:999px;border:2px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;position:relative}
.bd .pchip[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.bd .pchip .n{display:inline-block;min-width:20px;padding:0 6px;margin-left:6px;border-radius:999px;background:#e11d48;color:#fff;font-size:12px;line-height:20px;text-align:center}
.bd .ghost{border-style:dashed;color:var(--mute)}
.bd .panel{background:var(--card);border-radius:16px;padding:14px;display:grid;gap:10px}
.bd .sub{display:flex;gap:6px;flex-wrap:wrap}
.bd .sub button,.bd .fl button{min-height:36px;padding:4px 12px;font-size:14px;border-radius:999px}
.bd .sub button[aria-pressed=true],.bd .fl button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.bd .sec{font:800 13px var(--body,system-ui);text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:6px 2px 0}
.bd .post{background:var(--card);border-radius:16px;padding:12px 14px;display:grid;gap:6px;cursor:pointer;border-left:6px solid var(--tc,#64748b)}
.bd .post.unread{box-shadow:0 0 0 2px #e11d48 inset}
.bd .post.ment{background:linear-gradient(90deg,rgba(250,204,21,.18),transparent 60%),var(--card)}
.bd .post.res{opacity:.65}
.bd .ph{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--mute)}
.bd .tag{font-weight:700;font-size:12px;padding:2px 9px;border-radius:999px;background:var(--tc);color:#fff}
.bd .new{font-weight:800;font-size:11px;padding:2px 7px;border-radius:6px;background:#e11d48;color:#fff}
.bd .pt{font-weight:700;font-size:17px;overflow-wrap:anywhere}
.bd .pb{font-size:14.5px;color:var(--ink);opacity:.85;overflow-wrap:anywhere;white-space:pre-wrap}
.bd .pf{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--mute)}
.bd .late{color:#e11d48;font-weight:700}
.bd input[type=text],.bd input[type=date],.bd textarea,.bd select{font:16px/1.4 var(--body,system-ui);color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;width:100%}
.bd textarea{min-height:90px;resize:vertical}
.bd .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bd .go{background:var(--acc);border-color:var(--acc);color:var(--accInk,#fff)}
.bd .bad{color:var(--bad)}
.bd .det{display:grid;gap:12px}
.bd .det .pb{opacity:1;font-size:16px}
.bd .rep{border-left:3px solid var(--line);padding:6px 0 6px 10px;display:grid;gap:4px}
.bd .rep .who{font-size:13px;color:var(--mute)}
.bd .rep .who b{color:var(--ink)}
.bd .rep .acts{display:flex;gap:6px}
.bd .rep .acts button{min-height:30px;padding:2px 10px;font-size:13px;border-radius:8px}
.bd .kids{margin-left:14px;display:grid;gap:6px}
.bd .mention{background:rgba(250,204,21,.35);border-radius:4px;padding:0 2px;font-weight:700}
.bd .thumb{max-width:100%;max-height:260px;border-radius:10px;display:block}
.bd .flink{display:inline-flex;align-items:center;gap:6px;font-weight:700;min-height:36px;padding:4px 12px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);cursor:pointer;color:var(--ink);font-size:14px}
.bd .empty{color:var(--mute);text-align:center;padding:24px 10px;border:1.5px dashed var(--line);border-radius:16px}
.bd .code{font:800 26px ui-monospace,monospace;letter-spacing:.2em}
.bd details>summary{cursor:pointer;font-weight:700;min-height:32px}
.bd .act{font-size:14px;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer}
.bd .act:last-child{border:0}
`;

export function mountBoard({sb, user, displayName, root, onUnread = () => {}, toast = () => {}}) {
  if (!document.getElementById('bd-css')) { const st = document.createElement('style'); st.id = 'bd-css'; st.textContent = CSS; document.head.append(st); }
  root.classList.add('bd');
  const me = user.id, myName = (displayName || 'user').toLowerCase();
  let projects = [], cur = null, members = [], names = {}, posts = [], replies = [], views = [], tab = 'board', filt = 'all', openId = null, replyTo = null, unread = {}, chan = null, urls = {}, busy = false, tmr = null;
  try { cur = localStorage.getItem('bd-cur-' + me) } catch (_) {}

  const nm = id => names[id] || 'someone';
  const viewedBy = pid => views.filter(v => v.post_id === pid).map(v => v.user_id);
  const isAdmin = () => members.some(m => m.user_id === me && m.role === 'admin');
  const mentionsMe = t => new RegExp('@' + myName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(t || '');
  const hl = t => esc(t).replace(/@([a-z0-9_.]{2,30})/gi, (m, n) => `<span class="mention">${m}</span>`);
  const P = () => projects.find(p => p.id === cur);

  async function upsertProfile() { await sb.from('hub_profiles').upsert({user_id: me, username: displayName, updated_at: new Date().toISOString()}); }
  async function loadProjects() {
    const {data} = await sb.from('hub_projects').select('*').order('created_at');
    projects = data || [];
    if (!projects.some(p => p.id === cur)) cur = projects[0]?.id || null;
  }
  async function loadUnread() {
    if (!projects.length) { unread = {}; onUnread(0); return; }
    const [{data: ps}, {data: vs}] = await Promise.all([
      sb.from('hub_posts').select('id,project_id,user_id,status').neq('user_id', me).eq('status', 'open').limit(2000),
      sb.from('hub_views').select('post_id').eq('user_id', me).limit(5000)]);
    const seen = new Set((vs || []).map(v => v.post_id)); unread = {};
    (ps || []).forEach(p => { if (!seen.has(p.id)) unread[p.project_id] = (unread[p.project_id] || 0) + 1; });
    onUnread(Object.values(unread).reduce((a, b) => a + b, 0));
  }
  async function loadProject() {
    if (!cur) { members = []; posts = []; replies = []; views = []; return; }
    const [m, p, r, v] = await Promise.all([
      sb.from('hub_members').select('*').eq('project_id', cur),
      sb.from('hub_posts').select('*').eq('project_id', cur).order('created_at', {ascending: false}).limit(500),
      sb.from('hub_replies').select('*').eq('project_id', cur).order('created_at').limit(3000),
      sb.from('hub_views').select('*').eq('project_id', cur).limit(10000)]);
    members = m.data || []; posts = p.data || []; replies = r.data || []; views = v.data || [];
    const ids = [...new Set([...members.map(x => x.user_id), ...posts.map(x => x.user_id), ...replies.map(x => x.user_id)])];
    if (ids.length) { const {data} = await sb.from('hub_profiles').select('user_id,username').in('user_id', ids); (data || []).forEach(x => names[x.user_id] = x.username); }
  }
  async function refresh() { await loadProjects(); await Promise.all([loadProject(), loadUnread()]); render(); }
  const soon = () => { clearTimeout(tmr); tmr = setTimeout(() => refresh().catch(() => {}), 350); };

  async function fileUrl(path) { if (urls[path]) return urls[path]; const {data, error} = await sb.storage.from('boards').createSignedUrl(path, 3600); if (error) throw error; return urls[path] = data.signedUrl; }
  async function upload(pid, f) {
    if (f.size > MAXF) throw new Error(f.name + ' is over 10 MB');
    const path = pid + '/' + Date.now().toString(36) + '-' + (f.name || 'file').replace(/[^\w.-]+/g, '-');
    const {error} = await sb.storage.from('boards').upload(path, f, {contentType: f.type || 'application/octet-stream'});
    if (error) throw error;
    return {file_path: path, file_name: f.name || 'file', file_size: f.size, file_type: f.type || ''};
  }
  async function postTo(pid, {title, body, tag = 'Note', due = null, file = null}) {
    const extra = file ? await upload(pid, file) : {};
    const {error} = await sb.from('hub_posts').insert({project_id: pid, title: title.slice(0, 140), body, tag, due: due || null, ...extra});
    if (error) throw error;
    soon();
  }
  async function markViewed(p) {
    if (p.user_id === me || views.some(v => v.post_id === p.id && v.user_id === me)) return;
    views.push({post_id: p.id, user_id: me, project_id: p.project_id, viewed_at: new Date().toISOString()});
    await sb.from('hub_views').upsert({post_id: p.id, project_id: p.project_id}, {onConflict: 'post_id,user_id', ignoreDuplicates: true});
    loadUnread();
  }

  /* ---------- render ---------- */
  function render() {
    const keep = {}; ['bd-t', 'bd-b', 'bd-r', 'bd-nx', 'bd-due', 'bd-tag'].forEach(id => { const el = root.querySelector('#' + id); if (el && el.value) keep[id] = el.value; });
    const compOpen = root.querySelector('#bd-compose')?.open, act = document.activeElement?.id, formHTML = root.querySelector('#bd-form')?.innerHTML || '';
    draw();
    if (formHTML && root.querySelector('#bd-form')) root.querySelector('#bd-form').innerHTML = formHTML;
    Object.entries(keep).forEach(([id, v]) => { const el = root.querySelector('#' + id); if (el) el.value = v; });
    if (compOpen && root.querySelector('#bd-compose')) root.querySelector('#bd-compose').open = true;
    if (act && root.querySelector('#' + act)) root.querySelector('#' + act).focus();
  }
  function draw() {
    const bar = `<div class="pbar">${projects.map(p => `<button class="pchip" data-p="${p.id}" aria-pressed="${p.id === cur}">${esc(p.name)}${unread[p.id] ? `<span class="n">${unread[p.id]}</span>` : ''}</button>`).join('')}
      <button class="pchip ghost" data-x="new">+ New project</button><button class="pchip ghost" data-x="join">Join with code</button></div>
      <div id="bd-form"></div>`;
    if (!projects.length) { root.innerHTML = bar + `<div class="empty">No projects yet. Start one with <b>+ New project</b>, or tap <b>Join with code</b> if someone gave you an invite code.</div>`; return; }
    const subtabs = `<div class="sub">${[['board', 'Board'], ['activity', 'Activity'], ['files', 'Files'], ['members', 'Members']].map(([k, l]) => `<button data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (openId) body = detail(); else if (tab === 'board') body = board(); else if (tab === 'activity') body = activity(); else if (tab === 'files') body = files(); else body = membersView();
    root.innerHTML = bar + (openId ? '' : subtabs) + body;
    root.querySelectorAll('img[data-img]').forEach(async im => { try { im.src = await fileUrl(im.dataset.img) } catch (_) {} });
  }
  function card(p) {
    const seen = viewedBy(p.id), isNew = p.user_id !== me && !seen.includes(me) && p.status === 'open';
    const others = members.filter(m => m.user_id !== p.user_id).map(m => m.user_id);
    const seenN = others.filter(u => seen.includes(u)), waiting = others.length - seenN.length;
    const rc = replies.filter(r => r.post_id === p.id).length;
    const late = p.due && p.status === 'open' && new Date(p.due + 'T23:59') < new Date();
    const ment = mentionsMe(p.body) || mentionsMe(p.title);
    return `<article class="post${isNew ? ' unread' : ''}${ment ? ' ment' : ''}${p.status === 'resolved' ? ' res' : ''}" style="--tc:${TAGC[p.tag] || '#64748b'}" data-open="${p.id}">
      <div class="ph"><span class="tag">${esc(p.tag || 'Note')}</span>${isNew ? '<span class="new">NEW</span>' : ''}${p.pinned ? '📌' : ''}${p.status === 'resolved' ? '✅ Resolved' : ''}<span>${esc(nm(p.user_id))} · ${ago(p.created_at)}</span></div>
      <div class="pt">${hl(p.title)}</div>
      ${p.body ? `<div class="pb">${hl(p.body.length > 180 ? p.body.slice(0, 180) + '…' : p.body)}</div>` : ''}
      <div class="pf"><span>💬 ${rc}</span><span>👁 ${seenN.length ? 'Seen by ' + esc(seenN.map(nm).join(', ')) : 'Not seen yet'}${waiting > 0 ? ' · waiting on ' + waiting : ''}</span>${p.due ? `<span class="${late ? 'late' : ''}">📅 ${late ? 'Overdue · ' : 'Due '}${new Date(p.due + 'T12:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>` : ''}${p.file_name ? '<span>📎 ' + esc(p.file_name) + '</span>' : ''}</div></article>`;
  }
  function board() {
    let L = posts;
    if (filt === 'mine') L = L.filter(p => mentionsMe(p.body) || mentionsMe(p.title) || replies.some(r => r.post_id === p.id && mentionsMe(r.body)));
    else if (filt !== 'all') L = L.filter(p => p.tag === filt);
    const isUnread = p => p.user_id !== me && !viewedBy(p.id).includes(me) && p.status === 'open';
    const pinned = L.filter(p => p.pinned && p.status === 'open');
    const un = L.filter(p => !p.pinned && isUnread(p));
    const open = L.filter(p => !p.pinned && !isUnread(p) && p.status === 'open');
    const res = L.filter(p => p.status === 'resolved');
    const compose = `<details class="panel" id="bd-compose"><summary>＋ New post</summary>
      <input type="text" id="bd-t" placeholder="Title" maxlength="140">
      <textarea id="bd-b" placeholder="Details… use @name to call someone out"></textarea>
      <div class="row"><select id="bd-tag" style="flex:1 1 120px">${TAGS.map(t => `<option>${t}</option>`).join('')}</select>
      <label style="flex:1 1 150px;font-size:13px;color:var(--mute)">Due (optional)<input type="date" id="bd-due"></label></div>
      <div class="row"><input type="file" id="bd-f" style="flex:1 1 200px;font-size:14px"><button class="go" data-x="post" style="flex:1 1 140px">Post to board</button></div></details>`;
    const fl = `<div class="fl sub"><button data-f="all" aria-pressed="${filt === 'all'}">All</button><button data-f="mine" aria-pressed="${filt === 'mine'}">@ Mentions me</button>${TAGS.map(t => `<button data-f="${t}" aria-pressed="${filt === t}">${t}</button>`).join('')}</div>`;
    const sec = (t, a) => a.length ? `<div class="sec">${t}</div>${a.map(card).join('')}` : '';
    const list = pinned.length + un.length + open.length + res.length ? sec('📌 Pinned', pinned) + sec(`🔴 Unread (${un.length})`, un) + sec('Open', open) + (res.length ? `<details><summary class="sec">✅ Resolved (${res.length})</summary><div style="display:grid;gap:10px;margin-top:8px">${res.map(card).join('')}</div></details>` : '') : `<div class="empty">${posts.length ? 'Nothing matches that filter.' : 'No posts yet. Tap <b>＋ New post</b> to start the board.'}</div>`;
    return compose + fl + `<div style="display:grid;gap:10px">${list}</div>`;
  }
  function fileBlock(o) {
    if (!o.file_path) return '';
    const img = /^image\//.test(o.file_type || '');
    return `${img ? `<img class="thumb" data-img="${esc(o.file_path)}" alt="">` : ''}<span class="flink" data-file="${esc(o.file_path)}">📎 ${esc(o.file_name)} · ${kb(o.file_size || 0)}</span>`;
  }
  function tree(postId, parent, depth) {
    const kids = replies.filter(r => r.post_id === postId && (r.parent_id || null) === parent);
    if (!kids.length) return '';
    return kids.map(r => `<div class="rep"><div class="who"><b>${esc(nm(r.user_id))}</b> · ${ago(r.created_at)}</div><div class="pb">${hl(r.body)}</div>${fileBlock(r)}
      <div class="acts"><button data-rto="${r.id}">Reply</button>${r.user_id === me || isAdmin() ? `<button class="bad" data-rdel="${r.id}">Delete</button>` : ''}</div>
      ${(() => { const k = tree(postId, r.id, depth + 1); return k ? `<div class="kids"${depth >= 3 ? ' style="margin-left:0"' : ''}>${k}</div>` : '' })()}</div>`).join('');
  }
  function detail() {
    const p = posts.find(x => x.id === openId); if (!p) { openId = null; return board(); }
    const can = p.user_id === me || isAdmin();
    const seen = viewedBy(p.id), others = members.filter(m => m.user_id !== p.user_id);
    const rt = replyTo ? replies.find(r => r.id === replyTo) : null;
    return `<div class="det"><div class="row"><button data-x="back">← Back to board</button></div>
      <article class="post" style="--tc:${TAGC[p.tag] || '#64748b'};cursor:default"><div class="ph"><span class="tag">${esc(p.tag)}</span>${p.pinned ? '📌 Pinned' : ''}${p.status === 'resolved' ? '✅ Resolved' : ''}<span>${esc(nm(p.user_id))} · ${ago(p.created_at)}</span>${p.due ? `<span>📅 Due ${new Date(p.due + 'T12:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>` : ''}</div>
      <div class="pt" style="font-size:21px">${hl(p.title)}</div>${p.body ? `<div class="pb">${hl(p.body)}</div>` : ''}${fileBlock(p)}
      <div class="row">${can ? `<button data-x="status">${p.status === 'open' ? '✅ Mark resolved' : '↩ Reopen'}</button><button data-x="pin">${p.pinned ? 'Unpin' : '📌 Pin'}</button><button class="bad" data-x="delpost">Delete</button>` : ''}</div>
      <div class="pf">👁 ${others.map(m => `${seen.includes(m.user_id) ? '✓' : '○'} ${esc(nm(m.user_id))}`).join(' · ') || 'Only you so far'}</div></article>
      <div class="sec">Conversation (${replies.filter(r => r.post_id === p.id).length})</div>
      ${tree(p.id, null, 0) || '<div class="empty" style="padding:14px">No replies yet.</div>'}
      <div class="panel" id="bd-reply">${rt ? `<div class="row" style="font-size:14px;color:var(--mute)">Replying to <b style="color:var(--ink)">${esc(nm(rt.user_id))}</b><button data-x="cancelrt" style="min-height:30px;padding:2px 10px;font-size:13px">Cancel</button></div>` : ''}
      <textarea id="bd-r" placeholder="Write a reply… @name to mention"></textarea>
      <div class="row"><input type="file" id="bd-rf" style="flex:1 1 200px;font-size:14px"><button class="go" data-x="reply" style="flex:1 1 140px">Send reply</button></div></div></div>`;
  }
  function activity() {
    const ev = [...posts.map(p => ({t: p.created_at, who: p.user_id, txt: `posted <b>${esc(p.title)}</b>`, id: p.id})),
      ...replies.map(r => { const p = posts.find(x => x.id === r.post_id); return {t: r.created_at, who: r.user_id, txt: `replied to <b>${esc(p ? p.title : 'a post')}</b>`, id: r.post_id} })]
      .sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 60);
    return `<div class="panel">${ev.length ? ev.map(e => `<div class="act" data-open="${e.id}"><b>${esc(nm(e.who))}</b> ${e.txt} · <span style="color:var(--mute)">${ago(e.t)}</span></div>`).join('') : '<span style="color:var(--mute)">No activity yet.</span>'}</div>`;
  }
  function files() {
    const f = [...posts.filter(p => p.file_path).map(p => ({...p, from: p.title, pid: p.id})), ...replies.filter(r => r.file_path).map(r => ({...r, from: (posts.find(p => p.id === r.post_id) || {}).title, pid: r.post_id}))]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return `<div class="panel">${f.length ? f.map(x => `<div class="act" style="cursor:default"><span class="flink" data-file="${esc(x.file_path)}">📎 ${esc(x.file_name)}</span> <span style="color:var(--mute);font-size:13px">${kb(x.file_size || 0)} · ${esc(nm(x.user_id))} · ${ago(x.created_at)} · in <a href="#" data-open="${x.pid}" style="color:var(--ink)">${esc(x.from || 'post')}</a></span></div>`).join('') : '<span style="color:var(--mute)">No files shared yet.</span>'}</div>`;
  }
  function membersView() {
    const p = P(), adm = isAdmin();
    return `<div class="panel"><b>Invite code</b><div class="code">${esc(p.invite_code)}</div><span style="color:var(--mute);font-size:14px">Anyone signed in to Phone Bridge or Bridge Hub can join with this code.</span><div class="row"><button data-x="copycode">Copy code</button></div></div>
      <div class="panel"><b>Members (${members.length})</b>${members.map(m => `<div class="row" style="justify-content:space-between"><span>${esc(nm(m.user_id))}${m.user_id === me ? ' (you)' : ''} ${m.role === 'admin' ? '· <b>admin</b>' : ''}</span>${adm && m.user_id !== me ? `<span class="row"><button data-role="${m.user_id}" style="min-height:32px;padding:2px 10px;font-size:13px">${m.role === 'admin' ? 'Make member' : 'Make admin'}</button><button class="bad" data-kick="${m.user_id}" style="min-height:32px;padding:2px 10px;font-size:13px">Remove</button></span>` : ''}</div>`).join('')}</div>
      <div class="panel">${adm ? `<b>Project settings</b><div class="row"><input type="text" id="bd-rn" value="${esc(p.name)}" maxlength="60" style="flex:1 1 200px"><button data-x="rename">Rename</button></div><button class="bad" data-x="delproj">Delete project</button>` : ''}<button class="bad" data-x="leave">Leave project</button></div>`;
  }

  /* ---------- actions ---------- */
  const confirm2 = (b, label) => { if (b.dataset.sure === '1') return true; const o = b.textContent; b.dataset.sure = '1'; b.textContent = label || 'Tap again'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = o } }, 3000); return false; };
  root.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-open],[data-file],a'); if (!t || busy) return;
    const d = t.dataset;
    try {
      if (d.p) { cur = d.p; try { localStorage.setItem('bd-cur-' + me, cur) } catch (_) {} openId = null; replyTo = null; await loadProject(); render(); }
      else if (d.t) { tab = d.t; render(); }
      else if (d.f) { filt = d.f; render(); }
      else if (d.file) { e.preventDefault(); toast('Opening…'); window.open(await fileUrl(d.file), '_blank'); }
      else if (d.open) { e.preventDefault(); openId = d.open; replyTo = null; tab = 'board'; const p = posts.find(x => x.id === openId); if (p) markViewed(p); render(); window.scrollTo({top: root.offsetTop - 10}); }
      else if (d.rto) { replyTo = d.rto; render(); root.querySelector('#bd-r')?.focus(); }
      else if (d.rdel) { if (!confirm2(t)) return; await sb.from('hub_replies').delete().eq('id', d.rdel); replies = replies.filter(r => r.id !== d.rdel && r.parent_id !== d.rdel); render(); }
      else if (d.kick) { if (!confirm2(t)) return; await sb.from('hub_members').delete().eq('project_id', cur).eq('user_id', d.kick); await loadProject(); render(); }
      else if (d.role) { const m = members.find(x => x.user_id === d.role); await sb.from('hub_members').update({role: m.role === 'admin' ? 'member' : 'admin'}).eq('project_id', cur).eq('user_id', d.role); await loadProject(); render(); }
      else if (d.x) await act(d.x, t);
    } catch (err) { toast(err.message || 'Something went wrong'); }
  });
  async function act(x, b) {
    const p = openId && posts.find(q => q.id === openId);
    if (x === 'new' || x === 'join') {
      const f = root.querySelector('#bd-form');
      f.innerHTML = `<div class="panel"><b>${x === 'new' ? 'Start a project' : 'Join a project'}</b><div class="row"><input type="text" id="bd-nx" placeholder="${x === 'new' ? 'Project name' : 'Invite code, e.g. 7F3A9C'}" maxlength="60" style="flex:1 1 200px"><button class="go" data-x="${x}-go">${x === 'new' ? 'Create' : 'Join'}</button></div></div>`;
      f.querySelector('input').focus();
    } else if (x === 'new-go' || x === 'join-go') {
      const v = root.querySelector('#bd-nx').value.trim(); if (!v) return;
      busy = true;
      const {data, error} = x === 'new-go' ? await sb.rpc('hub_create_project', {p_name: v}) : await sb.rpc('hub_join_project', {p_code: v});
      busy = false; if (error) return toast(error.message);
      cur = data.id; try { localStorage.setItem('bd-cur-' + me, cur) } catch (_) {}
      tab = x === 'new-go' ? 'members' : 'board'; root.querySelector('#bd-form').innerHTML = ''; await refresh(); toast(x === 'new-go' ? 'Project created. Share the invite code.' : 'Joined ' + data.name);
    } else if (x === 'post') {
      const title = root.querySelector('#bd-t').value.trim(), body = root.querySelector('#bd-b').value.trim();
      if (!title) return toast('Give the post a title.');
      busy = true; b.disabled = true; b.textContent = 'Posting…';
      try { await postTo(cur, {title, body, tag: root.querySelector('#bd-tag').value, due: root.querySelector('#bd-due').value, file: root.querySelector('#bd-f').files[0]}); ['#bd-t', '#bd-b', '#bd-due'].forEach(q => root.querySelector(q).value = ''); root.querySelector('#bd-compose').open = false; toast('Posted'); await loadProject(); render(); }
      catch (err) { b.disabled = false; b.textContent = 'Post to board'; throw err; }
      finally { busy = false; }
    } else if (x === 'back') { openId = null; replyTo = null; render(); }
    else if (x === 'cancelrt') { replyTo = null; render(); }
    else if (x === 'reply') {
      const body = root.querySelector('#bd-r').value.trim(), f = root.querySelector('#bd-rf').files[0]; if (!body) return toast('Write something first.');
      busy = true; b.disabled = true; b.textContent = 'Sending…';
      try { const extra = f ? await upload(cur, f) : {}; const {error} = await sb.from('hub_replies').insert({post_id: p.id, project_id: cur, parent_id: replyTo, body, ...extra}); if (error) throw error; root.querySelector('#bd-r').value = ''; replyTo = null; await loadProject(); render(); }
      catch (err) { b.disabled = false; b.textContent = 'Send reply'; throw err; }
      finally { busy = false; }
    } else if (x === 'status') { await sb.from('hub_posts').update({status: p.status === 'open' ? 'resolved' : 'open', updated_at: new Date().toISOString()}).eq('id', p.id); await loadProject(); render(); }
    else if (x === 'pin') { await sb.from('hub_posts').update({pinned: !p.pinned}).eq('id', p.id); await loadProject(); render(); }
    else if (x === 'delpost') { if (!confirm2(b)) return; if (p.file_path) await sb.storage.from('boards').remove([p.file_path]); await sb.from('hub_posts').delete().eq('id', p.id); openId = null; await loadProject(); render(); }
    else if (x === 'copycode') { try { await navigator.clipboard.writeText(P().invite_code); toast('Code copied') } catch (_) { toast('Code: ' + P().invite_code) } }
    else if (x === 'rename') { const v = root.querySelector('#bd-rn').value.trim(); if (v) { await sb.from('hub_projects').update({name: v}).eq('id', cur); await refresh(); toast('Renamed'); } }
    else if (x === 'leave') { if (!confirm2(b, 'Tap again to leave')) return; await sb.from('hub_members').delete().eq('project_id', cur).eq('user_id', me); cur = null; tab = 'board'; await refresh(); }
    else if (x === 'delproj') { if (!confirm2(b, 'Tap again — deletes everything')) return; await sb.from('hub_projects').delete().eq('id', cur); cur = null; tab = 'board'; await refresh(); }
  }

  /* ---------- live ---------- */
  function live() {
    if (chan) sb.removeChannel(chan);
    const h = pl => { const r = pl.new && Object.keys(pl.new).length ? pl.new : pl.old || {}; if (pl.eventType === 'INSERT' && r.user_id && r.user_id !== me && (pl.table === 'hub_posts' || pl.table === 'hub_replies')) { const pr = projects.find(q => q.id === r.project_id); toast((pl.table === 'hub_posts' ? 'New post' : 'New reply') + (pr ? ' in ' + pr.name : '')); } soon(); };
    chan = sb.channel('boards-' + me);
    ['hub_posts', 'hub_replies', 'hub_views', 'hub_members'].forEach(t => chan.on('postgres_changes', {event: '*', schema: 'public', table: t}, h));
    chan.subscribe();
  }

  (async () => { try { await upsertProfile(); await refresh(); live(); } catch (e) { root.innerHTML = `<div class="empty">Boards couldn't load: ${esc(e.message)}. Has the board setup SQL been run?</div>`; } })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  return {projects: () => projects, postTo, refresh, destroy() { if (chan) sb.removeChannel(chan); root.innerHTML = ''; }};
}
