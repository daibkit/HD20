/* HDX — chế độ chỉnh sửa trực tiếp trên website (chỉ hiện với tài khoản admin đã đăng nhập ở /admin).
   - Trang chủ: bấm vào chữ của các khối (lịch sử, giải thể thao, hoạt động, radio, bài hát, liên hệ, lời hẹn ước) để sửa.
   - Trang Tin tức: sửa tiêu đề, mô tả ngắn và nội dung bài viết ngay trên trang.
   Quyền ghi vẫn do Supabase (RLS) quyết định: người không phải admin không thể lưu dù có chạy mã này. */
(function () {
  'use strict';
  const CFG = window.HDX_CONFIG || {};
  const URL_ = String(CFG.supabaseUrl || '').trim().replace(/\/+$/, ''), KEY = String(CFG.supabaseAnonKey || '').trim();
  if (!URL_ || !KEY) return;
  const SK = 'hdx-admin-session', MODE_K = 'hdx-edit-mode';
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

  /* ---------- Xác thực (dùng chung phiên đăng nhập với /admin) ---------- */
  let session = lsGet(SK), isAdmin = false;
  async function raw(path, opt) {
    opt = opt || {};
    const h = Object.assign({apikey: KEY}, opt.headers || {});
    if (opt.auth !== false && session) h.Authorization = 'Bearer ' + session.access_token;
    else if (/^eyJ/.test(KEY)) h.Authorization = 'Bearer ' + KEY;
    if (opt.body !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(URL_ + path, {method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined});
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) throw {status: res.status, code: data && (data.code || data.error_code), message: (data && (data.message || data.msg)) || ('HTTP ' + res.status)};
    return data;
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw {status: 401, message: 'Hết phiên đăng nhập'};
    const d = await raw('/auth/v1/token?grant_type=refresh_token', {method: 'POST', body: {refresh_token: session.refresh_token}, auth: false});
    session = {access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Number(d.expires_at) || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600), email: (d.user && d.user.email) || session.email};
    lsSet(SK, session);
  }
  async function req(path, opt) {
    if (session && session.expires_at && Date.now() / 1000 > session.expires_at - 90) await refresh();
    try { return await raw(path, opt); }
    catch (e) { if (e && e.status === 401 && session) { await refresh(); return raw(path, opt); } throw e; }
  }
  const errMsg = e => e && e.status === 403 || e && e.code === '42501' ? 'Tài khoản này không có quyền chỉnh sửa.' : e && e.status === 401 ? 'Phiên đăng nhập hết hạn — hãy đăng nhập lại ở trang quản trị.' : (e && e.message) || 'Không lưu được. Thử lại sau.';

  /* ---------- Giao diện (Shadow DOM để không đụng CSS của trang) ---------- */
  const host = document.createElement('div'); host.id = 'hdx-edit-host';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{all:initial}
    *{box-sizing:border-box;font-family:'Raleway',system-ui,-apple-system,'Segoe UI',sans-serif}
    .fab{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:#16285E;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;box-shadow:0 8px 28px rgba(10,25,70,.35);font-size:14px;font-weight:600;max-width:calc(100vw - 32px)}
    .fab button,.fab a{border:0;cursor:pointer;font:inherit;font-weight:700;font-size:13px;border-radius:999px;padding:9px 14px;color:#16285E;background:#F6CF5C;text-decoration:none;white-space:nowrap}
    .fab a{background:rgba(255,255,255,.14);color:#fff}
    .fab .on{background:#2AA56A;color:#fff}
    .fab span{opacity:.85;font-weight:500;font-size:13px}
    .tb{position:fixed;right:16px;bottom:16px;z-index:2147483001;display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#16285E;color:#fff;border-radius:16px;padding:8px 10px;box-shadow:0 10px 30px rgba(10,25,70,.4);max-width:calc(100vw - 24px)}
    .tb button{border:0;cursor:pointer;font:inherit;font-weight:700;font-size:13px;min-width:34px;height:34px;padding:0 10px;border-radius:10px;background:rgba(255,255,255,.12);color:#fff}
    .tb button:hover{background:rgba(255,255,255,.22)}
    .tb .save{background:#F6CF5C;color:#16285E}.tb .save:disabled{opacity:.5;cursor:default}
    .tb .sep{width:1px;height:22px;background:rgba(255,255,255,.25);margin:0 4px}
    .tb .t{font-size:12.5px;opacity:.85;padding:0 6px}
    .ov{position:fixed;inset:0;z-index:2147483002;background:rgba(10,20,50,.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}
    .md{background:#fff;color:#16285E;width:min(680px,100%);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:20px}
    .md h2{margin:0 0 4px;font-size:20px}.md .sub{margin:0 0 14px;font-size:13px;color:#5b6b92}
    .fld{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
    .fld label{font-size:12.5px;font-weight:700;color:#5b6b92}
    .fld input,.fld textarea{width:100%;padding:10px 12px;border:1.5px solid #c9d6e6;border-radius:12px;font-size:15px;color:#16285E;background:#fff;font-family:inherit}
    .fld textarea{min-height:90px;resize:vertical;line-height:1.5}
    .fld input:focus,.fld textarea:focus{outline:2px solid #2B8FD9;border-color:#2B8FD9}
    .rd{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;margin-bottom:8px}
    .row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:6px}
    .b{border:0;cursor:pointer;font:inherit;font-weight:700;font-size:14px;border-radius:999px;padding:10px 18px;background:#eaf1f8;color:#16285E}
    .b.p{background:linear-gradient(135deg,#F28A55,#F6CF5C);color:#16285E}
    .b.d{background:#fdeceb;color:#b3261e;margin-right:auto}
    .b:disabled{opacity:.55;cursor:default}
    .err{color:#b3261e;font-size:13px;margin:0 0 10px;min-height:0}
    .toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:2147483003;background:#16285E;color:#fff;border-radius:12px;padding:10px 16px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:calc(100vw - 32px)}
    .toast.e{background:#b3261e}
    @media(max-width:900px){.tb{left:12px;right:12px;bottom:76px;justify-content:center}}
    @media(max-width:560px){.rd{grid-template-columns:1fr auto}.rd input:first-child{grid-column:1/-1}}
  </style><div id="ui"></div><div id="modal"></div><div id="toast"></div>`;
  const ui = root.getElementById('ui'), modal = root.getElementById('modal'), toastEl = root.getElementById('toast');
  let toastT;
  function toast(msg, bad) { toastEl.innerHTML = `<div class="toast ${bad ? 'e' : ''}" role="status">${esc(msg)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.innerHTML = ''; }, bad ? 6000 : 3200); }

  const pageCss = document.createElement('style');
  pageCss.textContent = `html.hdx-editing [data-hdx-hot]{outline:2px dashed #F28A55 !important;outline-offset:3px;cursor:text !important;border-radius:4px}
    html.hdx-editing #video iframe{pointer-events:none}
    html.hdx-editing [contenteditable="true"]{outline:2px dashed #2B8FD9;outline-offset:4px;border-radius:4px;min-height:1em}
    html.hdx-editing [contenteditable="true"]:focus{outline-style:solid;background:rgba(43,143,217,.06)}
    html.hdx-editing .lede:empty:before,html.hdx-editing [data-hdx-ph]:empty:before{content:attr(data-hdx-ph);opacity:.5}`;

  /* ---------- Khối nội dung trang chủ ---------- */
  const FIELDS = {
    history: [{k: 'year', l: 'Mốc thời gian', max: 40}, {k: 'title', l: 'Tiêu đề', max: 160}, {k: 'text', l: 'Nội dung', max: 1200, ta: 1}],
    sports: [{k: 'name', l: 'Tên giải', max: 80}, {k: 'format', l: 'Thể thức', max: 160}, {k: 'pic', l: 'Người phụ trách', max: 80}, {k: 'phone', l: 'Số điện thoại', max: 30}],
    activities: [{k: 'name', l: 'Tên hoạt động', max: 120}, {k: 'when', l: 'Thời gian', max: 80}, {k: 'photo', l: 'Gợi ý ảnh', max: 80}, {k: 'desc', l: 'Mô tả', max: 800, ta: 1}],
    radios: [{k: 'title', l: 'Tên số', max: 120}, {k: 'desc', l: 'Mô tả', max: 300}, {k: 'id', l: 'ID YouTube', max: 20, re: /^[\w-]{6,20}$/, err: 'ID YouTube chỉ gồm chữ, số, “-”, “_” (6–20 ký tự).'}],
    songs: [{k: 'title', l: 'Tên bài', max: 120}, {k: 'desc', l: 'Mô tả', max: 300}, {k: 'src', l: 'Link tệp âm thanh (.mp3)', max: 500, re: /^(https?:\/\/[^\s"'<>]+|[\w\-./]+\.(mp3|m4a|ogg|wav))$/i, err: 'Link âm thanh phải bắt đầu bằng https:// hoặc là tệp .mp3/.m4a/.ogg/.wav.'}, {k: 'yt', l: 'hoặc ID YouTube', max: 20, re: /^[\w-]{6,20}$/, err: 'ID YouTube không hợp lệ.'}],
    contacts: [{k: 'role', l: 'Vai trò / ban', max: 120}, {k: 'name', l: 'Họ tên', max: 80}, {k: 'k', l: 'Khóa (K…)', max: 20}, {k: 'phone', l: 'Số điện thoại', max: 30}],
    slides: [{k: 'text', l: 'Lời nhắn', max: 400, ta: 1}, {k: 'who', l: 'Người gửi', max: 80}, {k: 'k', l: 'Khóa (K…)', max: 20}]
  };
  const REQ = {history: 'title', sports: 'name', activities: 'name', radios: 'title', songs: 'title', contacts: 'role', slides: 'text'};
  const NOUN = {history: 'mốc lịch sử', sports: 'giải', activities: 'hoạt động', radios: 'số radio', songs: 'bài hát', contacts: 'đầu mối', slides: 'lời nhắn'};
  const unq = s => s.replace(/^[“"«'‘]+|[”"»'’]+$/g, '').trim();

  function homeBlocks() { return window.HDX_HOME && window.HDX_HOME.blocks; }
  function candidates(t) {
    const out = [], bl = homeBlocks(); if (!bl) return out;
    for (const key of Object.keys(FIELDS)) {
      const arr = bl[key] && bl[key].t || [];
      arr.forEach((it, i) => {
        let hit = FIELDS[key].some(f => { const v = norm(it[f.k]); return v && (v === t || unq(v) === t); });
        if (!hit && key === 'sports') hit = (it.rounds || []).some(r => norm(r.when) === t || norm(r.what) === t);
        if (hit) out.push({key, i});
      });
    }
    return out;
  }
  const ytId = v => { v = String(v || '').trim(); if (!v) return ''; const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{6,20})/i); if (m) return m[1]; return /^[\w-]{6,20}$/.test(v) ? v : null; };
  function videoTarget(target) {
    const sec = target && target.closest && target.closest('#video'); if (!sec || host.contains(target)) return null;
    const el = target.closest('[data-hdx-vid], h2, p, button'); return el && sec.contains(el) ? {key: 'video', el} : null;
  }
  function openVideo() {
    const H = window.HDX_HOME, S = H.settings || {};
    const F = [{k: 'videoTitle', l: 'Tiêu đề', max: 160, v: S.videoTitle}, {k: 'videoText', l: 'Mô tả', max: 700, ta: 1, v: S.videoText}, {k: 'videoBtn', l: 'Chữ trên nút', max: 60, v: S.videoBtn}, {k: 'introVideoId', l: 'Link hoặc ID video YouTube', max: 300, v: S.introVideoId ? 'https://www.youtube.com/watch?v=' + S.introVideoId : ''}];
    const dom = n => { const e = document.querySelector('#video ' + n); return e ? norm(e.textContent) : ''; };
    F[0].v = F[0].v || dom('h2'); F[1].v = F[1].v || dom('p'); F[2].v = F[2].v || dom('button');
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa mục Video"><div class="md"><h2>Sửa mục Video</h2><p class="sub">Dán nguyên link YouTube (hoặc chỉ ID). Để trống link để ẩn video. Lưu xong, website đổi ngay.</p><p class="err" id="err"></p>
      ${F.map((f, n) => fieldHtml(f, f.v, n)).join('')}<div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    const q = s => modal.querySelector(s), first = modal.querySelector('input,textarea'); if (first) first.focus();
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (!t.hasAttribute('data-save')) return;
      const val = {}; modal.querySelectorAll('[data-k]').forEach(el => { val[el.dataset.k] = el.value.trim(); });
      const id = ytId(val.introVideoId); if (id === null) { q('#err').textContent = 'Link/ID YouTube không hợp lệ.'; return; }
      t.disabled = true; t.textContent = 'Đang lưu…';
      try {
        const cur = await req('/rest/v1/site_content?select=data&key=eq.settings').catch(() => []);
        const b0 = cur && cur[0] && cur[0].data && !Array.isArray(cur[0].data) ? cur[0].data : {};
        const data = Object.assign({}, b0, {videoTitle: val.videoTitle, videoText: val.videoText, videoBtn: val.videoBtn, introVideoId: id});
        await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key: 'settings', data, updated_at: new Date().toISOString()}});
        Object.assign(S, {videoTitle: val.videoTitle, videoText: val.videoText, videoBtn: val.videoBtn, introVideoId: id});
        try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== 'settings'); rows.push({key: 'settings', data}); lsSet(H.cacheKey, rows); } catch (er) {}
        modal.innerHTML = ''; setHot(null); H.rerender(); toast('Đã lưu. Website đã cập nhật.');
      } catch (er) { const msg = er && er.status === 404 ? 'Chưa có bảng site_content: hãy chạy supabase/site_content.sql trong Supabase.' : errMsg(er); q('#err').textContent = msg; toast(msg, true); t.disabled = false; t.textContent = 'Lưu thay đổi'; }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  function findItem(target) {
    const vt = videoTarget(target); if (vt) return vt;
    let el = target, d = 0;
    while (el && el !== document.body && el !== document.documentElement && d < 6) {
      if (host.contains(el)) return null;
      const t = unq(norm(el.textContent));
      if (t && t.length <= 1500) {
        const m = candidates(t);
        if (m.length) {
          if (m.length > 1) { // trùng chữ (VD “Đang cập nhật”): chọn theo thứ tự xuất hiện trên trang
            const same = [...document.querySelectorAll(el.tagName)].filter(e => !host.contains(e) && unq(norm(e.textContent)) === t), idx = same.indexOf(el);
            if (same.length === m.length && idx >= 0) return {...m[idx], el};
          }
          return {...m[0], el};
        }
      }
      el = el.parentElement; d++;
    }
    return null;
  }

  let editing = false, hot = null, mounted = false;
  function setHot(el) { if (hot === el) return; if (hot) hot.removeAttribute('data-hdx-hot'); hot = el; if (hot) hot.setAttribute('data-hdx-hot', ''); }
  const onMove = e => { if (!homeBlocks() || modal.firstChild) return; const f = findItem(e.target); setHot(f ? f.el : null); };
  const onClick = e => {
    if (!editing || host.contains(e.target) || e.composedPath().includes(host)) return;
    if (!homeBlocks()) return;
    const f = findItem(e.target); if (!f) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (f.key === 'video') openVideo(); else openItem(f.key, f.i);
  };

  function fieldHtml(f, v, idx, extra) {
    const id = 'f' + idx;
    return `<div class="fld"><label for="${id}">${esc(f.l)}</label>${f.ta ? `<textarea id="${id}" data-k="${f.k}" maxlength="${f.max}">${esc(v || '')}</textarea>` : `<input id="${id}" data-k="${f.k}" type="text" maxlength="${f.max}" value="${esc(v || '')}">`}</div>`;
  }
  function openItem(key, i) {
    const B = homeBlocks()[key], fields = FIELDS[key], it = B.clean(B.t[i]), canDel = B.t.length > 1;
    const rounds = key === 'sports' ? (it.rounds || []).map(r => ({...r})) : null;
    const drawRounds = () => `<div class="fld"><label>Lịch thi đấu</label>${rounds.map((r, j) => `<div class="rd"><input data-r="${j}" data-rk="when" maxlength="80" placeholder="Thời gian" value="${esc(r.when)}"><input data-r="${j}" data-rk="what" maxlength="160" placeholder="Nội dung" value="${esc(r.what)}"><button class="b d" data-rdel="${j}" style="margin:0;padding:8px 12px" aria-label="Xoá vòng">✕</button></div>`).join('')}${rounds.length < 10 ? '<button class="b" data-radd style="padding:7px 14px;font-size:13px">+ Thêm vòng</button>' : ''}</div>`;
    const draw = () => {
      modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa nội dung"><div class="md"><h2>Sửa ${esc(NOUN[key])} #${i + 1}</h2><p class="sub">Lưu xong, nội dung trên website đổi ngay.</p><p class="err" id="err"></p>
        ${fields.map((f, n) => fieldHtml(f, it[f.k], n)).join('')}${rounds ? `<div id="rounds">${drawRounds()}</div>` : ''}
        <div class="row">${canDel ? '<button class="b d" data-del>Xoá mục này</button>' : ''}<button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    };
    draw();
    const q = s => modal.querySelector(s), setErr = m => { q('#err').textContent = m || ''; };
    const first = modal.querySelector('input,textarea'); if (first) first.focus();
    const sync = () => { modal.querySelectorAll('[data-k]').forEach(el => { it[el.dataset.k] = el.value; }); if (rounds) modal.querySelectorAll('[data-r]').forEach(el => { rounds[+el.dataset.r][el.dataset.rk] = el.value; }); };
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (t.hasAttribute('data-radd')) { sync(); rounds.push({when: '', what: ''}); q('#rounds').innerHTML = drawRounds(); return; }
      if (t.hasAttribute('data-rdel')) { sync(); rounds.splice(+t.dataset.rdel, 1); q('#rounds').innerHTML = drawRounds(); return; }
      if (t.hasAttribute('data-del')) {
        if (!confirm(`Xoá ${NOUN[key]} này khỏi website?`)) return;
        await commit(key, B.t.map(B.clean).filter((_, n) => n !== i), 'Đã xoá.'); return;
      }
      if (t.hasAttribute('data-save')) {
        sync();
        if (!norm(it[REQ[key]])) { setErr(`“${fields.find(f => f.k === REQ[key]).l}” không được để trống.`); return; }
        for (const f of fields) { const v = norm(it[f.k]); if (v && f.re && !f.re.test(v)) { setErr(f.err); return; } }
        if (rounds) it.rounds = rounds.filter(r => norm(r.when) || norm(r.what));
        const arr = B.t.map(B.clean); arr[i] = B.clean(it);
        t.disabled = true; t.textContent = 'Đang lưu…';
        const ok = await commit(key, arr, 'Đã lưu. Website đã cập nhật.');
        if (!ok) { t.disabled = false; t.textContent = 'Lưu thay đổi'; }
      }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  async function commit(key, arr, okMsg) {
    const H = window.HDX_HOME, B = H.blocks[key];
    if (!arr.length) { toast('Cần giữ lại ít nhất 1 mục.', true); return false; }
    try {
      await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key, data: arr, updated_at: new Date().toISOString()}});
    } catch (e) {
      const msg = e && e.status === 404 ? 'Chưa có bảng site_content: hãy chạy supabase/site_content.sql trong Supabase.' : errMsg(e);
      const er = modal.querySelector('#err'); if (er) er.textContent = msg; toast(msg, true); return false;
    }
    B.t.splice(0, B.t.length, ...arr.map(B.derive));
    try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== key); rows.push({key, data: arr}); lsSet(H.cacheKey, rows); } catch (e) {}
    modal.innerHTML = ''; setHot(null); H.rerender(); toast(okMsg); return true;
  }

  /* ---------- Bài viết trên trang Tin tức ---------- */
  let art = null, artUndo = null;
  function afterRoute(info) {
    art = info && info.article || null; artUndo = null;
    if (!isAdmin) return;
    draw();
    if (editing && art) startArticle();
  }
  function startArticle() {
    const app = document.getElementById('app'); if (!app || !art) return;
    const h1 = app.querySelector('.band h1'), prose = app.querySelector('.prose'); let lede = app.querySelector('.lede');
    if (!h1 || !prose) return;
    if (!lede) { lede = document.createElement('p'); lede.className = 'lede'; lede.setAttribute('data-hdx-ph', 'Mô tả ngắn (không bắt buộc)'); const r = app.querySelector('.read'); r.insertBefore(lede, prose); }
    [h1, lede, prose].forEach(el => el.setAttribute('contenteditable', 'true'));
    h1.setAttribute('data-hdx-ph', 'Tiêu đề'); prose.setAttribute('data-hdx-ph', 'Nội dung bài viết');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    [h1, lede].forEach(el => el.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.preventDefault(); }));
    [h1, lede].forEach(el => el.addEventListener('paste', ev => { ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ')); }));
    artUndo = {title: art.title, excerpt: art.excerpt || '', content: art.content || ''};
    draw();
  }
  function stopArticle(rerender) { if (rerender && window.route) window.route(); }
  function fmtCmd(cmd, val) { document.execCommand(cmd, false, val || null); }
  async function saveArticle() {
    const app = document.getElementById('app'), h1 = app.querySelector('.band h1'), lede = app.querySelector('.lede'), prose = app.querySelector('.prose');
    const title = norm(h1.textContent), excerpt = norm(lede ? lede.textContent : '');
    if (!title) { toast('Tiêu đề không được để trống.', true); return; }
    if (title.length > 200) { toast('Tiêu đề tối đa 200 ký tự.', true); return; }
    if (excerpt.length > 400) { toast('Mô tả ngắn tối đa 400 ký tự.', true); return; }
    const c = prose.cloneNode(true); c.querySelectorAll('div').forEach(d => { const p = document.createElement('p'); p.innerHTML = d.innerHTML; d.replaceWith(p); });
    const content = (window.sanitize ? window.sanitize(c.innerHTML) : c.innerHTML).trim();
    if (!norm(content.replace(/<(?!img)[^>]*>/gi, ''))) { if (!/<img/i.test(content)) { toast('Bài viết cần có nội dung.', true); return; } }
    if (content.length > 250000) { toast('Nội dung quá dài.', true); return; }
    const btn = ui.querySelector('[data-asave]'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    try {
      await req('/rest/v1/articles?id=eq.' + encodeURIComponent(art.id), {method: 'PATCH', headers: {Prefer: 'return=minimal'}, body: {title, excerpt, content, updated_at: new Date().toISOString()}});
    } catch (e) { toast(errMsg(e), true); if (btn) { btn.disabled = false; btn.textContent = 'Lưu bài'; } return; }
    art.title = title; art.excerpt = excerpt; art.content = content; artUndo = {title, excerpt, content};
    toast('Đã lưu bài viết. Website đã cập nhật.');
    if (window.route) window.route(); // vẽ lại từ dữ liệu đã lưu
  }

  /* ---------- Thanh điều khiển ---------- */
  function draw() {
    if (!isAdmin) { ui.innerHTML = ''; return; }
    const em = session && session.email ? esc(session.email) : '';
    const articleTb = editing && art ? `<div class="tb" role="toolbar" aria-label="Định dạng bài viết">
      <button data-fmt="bold" title="In đậm"><b>B</b></button><button data-fmt="italic" title="In nghiêng"><i>I</i></button><button data-fmt="h2" title="Tiêu đề phụ">H2</button><button data-fmt="ul" title="Danh sách">• Ds</button><button data-fmt="quote" title="Trích dẫn">“ ”</button><button data-fmt="link" title="Chèn liên kết">Link</button><button data-fmt="undo" title="Hoàn tác">↶</button>
      <span class="sep"></span><button class="save" data-asave>Lưu bài</button><button data-acancel>Bỏ thay đổi</button></div>` : '';
    ui.innerHTML = `${articleTb}<div class="fab" role="region" aria-label="Chế độ chỉnh sửa">
      ${editing ? `<span>${art ? 'Sửa trực tiếp tiêu đề, mô tả, nội dung' : homeBlocks() ? 'Bấm vào chữ có viền cam để sửa' : 'Mở một bài viết để sửa'}</span>` : `<span>${em}</span>`}
      <button class="${editing ? 'on' : ''}" data-toggle>${editing ? '✓ Thoát chỉnh sửa' : '✎ Chỉnh sửa trang'}</button><a href="admin.html">Quản trị</a></div>`;
  }
  ui.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-toggle')) { setEditing(!editing); return; }
    if (t.hasAttribute('data-asave')) { saveArticle(); return; }
    if (t.hasAttribute('data-acancel')) { if (window.route) window.route(); toast('Đã bỏ các thay đổi chưa lưu.'); return; }
    const f = t.dataset.fmt; if (!f) return;
    if (f === 'h2') fmtCmd('formatBlock', 'h2'); else if (f === 'ul') fmtCmd('insertUnorderedList'); else if (f === 'quote') fmtCmd('formatBlock', 'blockquote');
    else if (f === 'link') { const u = prompt('Địa chỉ liên kết (https://…):', 'https://'); if (u && /^(https?:|mailto:|tel:)/i.test(u)) fmtCmd('createLink', u); else if (u) toast('Liên kết phải bắt đầu bằng https://', true); }
    else fmtCmd(f);
  });
  ui.addEventListener('mousedown', e => { if (e.target.closest('.tb')) e.preventDefault(); }); // giữ vùng chọn khi bấm nút định dạng

  function setEditing(on) {
    editing = on; try { sessionStorage.setItem(MODE_K, on ? '1' : ''); } catch (e) {}
    document.documentElement.classList.toggle('hdx-editing', on);
    if (!on) { setHot(null); if (art && window.route) window.route(); }
    else if (art) startArticle();
    draw();
  }
  window.addEventListener('beforeunload', e => {
    if (!editing || !art || !artUndo) return;
    const app = document.getElementById('app'); const h1 = app && app.querySelector('.band h1'), pr = app && app.querySelector('.prose');
    if (h1 && pr && (norm(h1.textContent) !== norm(artUndo.title) || norm(pr.textContent) !== norm(((d => (d.innerHTML = artUndo.content, d.textContent))(document.createElement('div')))))) { e.preventDefault(); e.returnValue = ''; }
  });

  async function init() {
    if (!session || !session.access_token) return;
    try { isAdmin = (await req('/rest/v1/rpc/is_admin', {method: 'POST', body: {}})) === true; } catch (e) { isAdmin = false; }
    if (!isAdmin) return;
    document.head.appendChild(pageCss); document.body.appendChild(host);
    document.addEventListener('mousemove', onMove, {passive: true});
    document.addEventListener('click', onClick, true);
    let on = false; try { on = sessionStorage.getItem(MODE_K) === '1'; } catch (e) {}
    editing = on; document.documentElement.classList.toggle('hdx-editing', on);
    if (on && art) startArticle();
    draw(); mounted = true;
    // Trang chủ dựng sau khi script này chạy: vẽ lại thanh khi dữ liệu sẵn sàng
    let n = 0; const iv = setInterval(() => { draw(); if (homeBlocks() || ++n > 20) clearInterval(iv); }, 500);
  }
  window.HDXEdit = {afterRoute};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
