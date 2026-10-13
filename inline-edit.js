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
    const res = await fetch(URL_ + path, {method: opt.method || 'GET', headers: h, body: opt.blob !== undefined ? opt.blob : opt.body !== undefined ? JSON.stringify(opt.body) : undefined});
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
    html.hdx-editing #hd-radio iframe,html.hdx-editing #hd-radio video,html.hdx-editing #hd-radio audio{pointer-events:none}
    html.hdx-editing [contenteditable="true"]{outline:2px dashed #2B8FD9;outline-offset:4px;border-radius:4px;min-height:1em}
    html.hdx-editing [contenteditable="true"]:focus{outline-style:solid;background:rgba(43,143,217,.06)}
    html.hdx-editing .lede:empty:before,html.hdx-editing [data-hdx-ph]:empty:before{content:attr(data-hdx-ph);opacity:.5}`;

  /* ---------- Khối nội dung trang chủ ---------- */
  const FIELDS = {
    chain: [{k: 'title', l: 'Tên hoạt động', max: 120}, {k: 'desc', l: 'Mô tả', max: 400, ta: 1}],
    agenda: [{k: 'when', l: 'Thời gian', max: 40}, {k: 'title', l: 'Tên hoạt động', max: 160}, {k: 'desc', l: 'Mô tả', max: 400, ta: 1}, {k: 'main', l: 'Đánh dấu “Điểm hẹn chính” (nổi bật)', chk: true}],
    history: [{k: 'year', l: 'Mốc thời gian', max: 40}, {k: 'title', l: 'Tiêu đề', max: 160}, {k: 'text', l: 'Nội dung', max: 1200, ta: 1}],
    sports: [{k: 'name', l: 'Tên giải', max: 80}, {k: 'format', l: 'Thể thức', max: 160}, {k: 'pic', l: 'Người phụ trách', max: 80}, {k: 'phone', l: 'Số điện thoại', max: 30}],
    activities: [{k: 'group', l: 'Nhóm (gõ tên nhóm đã có hoặc tên mới)', max: 80}, {k: 'name', l: 'Tên hoạt động', max: 120}, {k: 'desc', l: 'Mô tả ngắn (hiện trên thẻ)', max: 1200, ta: 1}, {k: 'img', l: 'Ảnh đại diện', max: 500, img: true, re: /^(https?:\/\/[^\s"'<>]+|img\/[\w.\-]+)$/, err: 'Link ảnh phải bắt đầu bằng https:// (hoặc tải ảnh lên).'}],
    radios: [{k: 'title', l: 'Tên số', max: 120}, {k: 'desc', l: 'Mô tả', max: 300}, {k: 'id', l: 'Link hoặc ID video YouTube', max: 300, yt: true}, {k: 'file', l: 'hoặc link tệp video/âm thanh (https://…, .mp4/.mp3) — nếu có sẽ dùng thay cho YouTube', max: 600, re: /^https?:\/\/[^\s"'<>]+$/, err: 'Link tệp phải bắt đầu bằng https://'}],
    songs: [{k: 'title', l: 'Tên bài', max: 120}, {k: 'desc', l: 'Mô tả', max: 300}, {k: 'src', l: 'Link nhạc: Spotify, YouTube, Google Drive hoặc tệp .mp3/.m4a (https://…)', max: 600}],
    contacts: [{k: 'role', l: 'Vai trò / ban', max: 120}, {k: 'name', l: 'Họ tên', max: 80}, {k: 'k', l: 'Khóa (K…)', max: 20}, {k: 'phone', l: 'Số điện thoại', max: 30}],
    slides: [{k: 'text', l: 'Lời nhắn', max: 400, ta: 1}, {k: 'who', l: 'Người gửi', max: 80}, {k: 'k', l: 'Khóa (K…)', max: 20}]
  };
  const REQ = {chain: 'title', agenda: 'title', history: 'title', sports: 'name', activities: 'name', radios: 'title', songs: 'title', contacts: 'role', slides: 'text'};
  const NOUN = {chain: 'hoạt động', agenda: 'hoạt động lịch trình', history: 'mốc lịch sử', sports: 'giải', activities: 'hoạt động', radios: 'số radio', songs: 'bài hát', contacts: 'đầu mối', slides: 'lời nhắn'};
  const unq = s => s.replace(/^[“"«'‘]+|[”"»'’]+$/g, '').trim();

  function homeBlocks() { return window.HDX_HOME && window.HDX_HOME.blocks; }
  function candidates(t) {
    const out = [], bl = homeBlocks(); if (!bl) return out;
    for (const key of Object.keys(FIELDS)) {
      const arr = bl[key] && bl[key].t || [];
      arr.forEach((it, i) => {
        let hit = FIELDS[key].some(f => { if (f.chk) return false; const v = norm(it[f.k]); return v && (v === t || unq(v) === t); });
        if (!hit && key === 'sports') hit = (it.rounds || []).some(r => norm(r.when) === t || norm(r.what) === t);
        if (hit) out.push({key, i});
      });
    }
    return out;
  }
  const songLink = v => {
    v = String(v || '').trim(); if (!v) return {src: '', yt: ''};
    const sp = v.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{10,30})/i); if (sp) return {src: '', yt: '', sp: sp[1].toLowerCase() + '/' + sp[2]};
    const y = ytId(v); if (y) return {src: '', yt: y};
    const d = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,100})/i); if (d) return {src: 'https://drive.google.com/uc?export=download&id=' + d[1], yt: ''};
    if (v.length <= 500 && /^(https?:\/\/[^\s"'<>]+|[\w\-./]+\.(mp3|m4a|ogg|wav))$/i.test(v)) return {src: v, yt: ''};
    return null;
  };
  const ytId = v => { v = String(v || '').trim(); if (!v) return ''; const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{6,20})/i); if (m) return m[1]; return /^[\w-]{6,20}$/.test(v) ? v : null; };
  const b64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej({message: 'Không đọc được tệp.'}); fr.readAsDataURL(blob); });
  async function gas(action, extra) {
    const url = (window.HDX_HOME.settings || {}).driveUrl;
    if (session && session.expires_at && Date.now() / 1000 > session.expires_at - 90) await refresh();
    let j; try { const res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(Object.assign({action, token: session && session.access_token}, extra))}); j = await res.json(); }
    catch (e) { throw {message: 'Không kết nối được Google Apps Script.'}; }
    if (!j || !j.ok) throw {message: j && /Tên thư mục không hợp lệ|Thao tác không hợp lệ/.test(j.error || '') ? 'Apps Script trên Google đang là BẢN CŨ: vào Admin → Bảo tàng ký ức → “Sao chép mã”, dán lại, Lưu rồi Triển khai “Phiên bản mới”.' : (j && j.error) || 'Google Drive báo lỗi.'};
    return j;
  }
  async function driveUpload(file, k, onPct) {
    const mime = file.type || (/\.(mp4|m4v)$/i.test(file.name) ? 'video/mp4' : /\.mov$/i.test(file.name) ? 'video/quicktime' : /\.webm$/i.test(file.name) ? 'video/webm' : '');
    if (!/^video\//.test(mime)) throw {message: 'Chỉ nhận tệp video.'}; if (!file.size) throw {message: 'Tệp rỗng.'};
    const st = await gas('start', {k, name: file.name, mime, size: file.size}), CH = 3 * 1024 * 1024; let off = 0, r;
    while (off < file.size) {
      const end = Math.min(off + CH, file.size), data = await b64(file.slice(off, end));
      for (let t = 1; ; t++) { try { r = await gas('chunk', {session: st.session, start: off, total: file.size, data}); break; } catch (e) { if (t >= 3) throw e; await new Promise(r => setTimeout(r, 1500 * t)); } }
      off = end; onPct(Math.round(off / file.size * 100)); if (r.done) return r.id;
    }
    throw {message: 'Google Drive chưa xác nhận tệp đã tải xong, hãy thử lại.'};
  }
  function videoTarget(target) {
    const sec = target && target.closest && target.closest('#video'); if (!sec || host.contains(target)) return null;
    const el = target.closest('[data-hdx-vid], h2, p'); return el && sec.contains(el) ? {key: 'video', el} : null;
  }
  function openVideo() {
    const H = window.HDX_HOME, S = H.settings || {};
    const F = [{k: 'videoTitle', l: 'Tiêu đề', max: 160, v: S.videoTitle}, {k: 'videoText', l: 'Mô tả', max: 700, ta: 1, v: S.videoText}, {k: 'introVideoId', l: 'Link hoặc ID video YouTube (không tự phát)', max: 300, v: S.introVideoId ? 'https://www.youtube.com/watch?v=' + S.introVideoId : ''}];
    let driveId = S.introDriveId || '';
    const dom = n => { const e = document.querySelector('#video ' + n); return e ? norm(e.textContent) : ''; };
    F[0].v = F[0].v || dom('h2'); F[1].v = F[1].v || dom('p');
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa mục Video"><div class="md"><h2>Sửa mục Video</h2><p class="sub">Dán nguyên link YouTube (hoặc chỉ ID). Video tự phát (tắt tiếng, theo quy định của trình duyệt). Để trống link để ẩn video. Lưu xong, website đổi ngay.</p><p class="err" id="err"></p>
      ${F.map((f, n) => fieldHtml(f, f.v, n)).join('')}
      <div class="fld"><label>Hoặc tải video lên (lưu Google Drive, tự phát tắt tiếng khi mở trang)</label><div id="vinfo" style="font-size:13px;color:#5b6b92"></div>
        <div class="row" style="justify-content:flex-start;margin:0"><label class="b" style="cursor:pointer" id="vlab">Tải video lên<input type="file" id="vfile" accept="video/*,.mp4,.mov,.webm,.m4v" hidden></label><button class="b d" data-vrm style="margin:0">Gỡ video đã tải</button></div></div>
      <div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    const q = s => modal.querySelector(s), first = modal.querySelector('input,textarea'); if (first) first.focus();
    const info = msg => { q('#vinfo').textContent = msg != null ? msg : driveId ? 'Đã có video tải lên — đang được dùng thay cho link YouTube.' : 'Chưa có video tải lên.'; q('[data-vrm]').style.display = driveId ? '' : 'none'; };
    info();
    q('#vfile').onchange = async ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      if (!(/^video\//.test(f.type) || /\.(mp4|mov|webm|m4v)$/i.test(f.name))) { q('#err').textContent = 'Chỉ nhận tệp video (MP4, MOV, WebM).'; return; }
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(S.driveUrl || '')) { q('#err').textContent = 'Chưa kết nối Google Drive: vào Admin → Bảo tàng ký ức dán địa chỉ Apps Script trước.'; return; }
      q('#err').textContent = ''; q('#vlab').style.opacity = '.55'; q('#vfile').disabled = true;
      try { driveId = await driveUpload(f, 'VIDEO', pct => info('Đang tải lên Google Drive… ' + pct + '%')); info('Đã tải xong. Bấm “Lưu thay đổi”.'); }
      catch (er) { q('#err').textContent = (er && er.message) || 'Không tải được video lên.'; info(); }
      q('#vlab').style.opacity = ''; q('#vfile').disabled = false;
    };
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (t.hasAttribute('data-vrm')) { driveId = ''; info(); return; }
      if (!t.hasAttribute('data-save')) return;
      const val = {}; modal.querySelectorAll('[data-k]').forEach(el => { val[el.dataset.k] = el.value.trim(); });
      const id = ytId(val.introVideoId); if (id === null) { q('#err').textContent = 'Link/ID YouTube không hợp lệ.'; return; }
      t.disabled = true; t.textContent = 'Đang lưu…';
      try {
        const cur = await req('/rest/v1/site_content?select=data&key=eq.settings').catch(() => []);
        const b0 = cur && cur[0] && cur[0].data && !Array.isArray(cur[0].data) ? cur[0].data : {};
        const data = Object.assign({}, b0, {videoTitle: val.videoTitle, videoText: val.videoText, introVideoId: id, introDriveId: driveId});
        await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key: 'settings', data, updated_at: new Date().toISOString()}});
        Object.assign(S, {videoTitle: val.videoTitle, videoText: val.videoText, introVideoId: id, introDriveId: driveId});
        try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== 'settings'); rows.push({key: 'settings', data}); lsSet(H.cacheKey, rows); } catch (er) {}
        modal.innerHTML = ''; setHot(null); H.rerender(); toast('Đã lưu. Website đã cập nhật.');
      } catch (er) { const msg = er && er.status === 404 ? 'Chưa có bảng site_content: hãy chạy supabase/site_content.sql trong Supabase.' : errMsg(er); q('#err').textContent = msg; toast(msg, true); t.disabled = false; t.textContent = 'Lưu thay đổi'; }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  function openPledge() {
    const H = window.HDX_HOME, S = H.settings || {};
    const dom = n => { const e = document.querySelector('#hen-uoc ' + n); return e ? e.textContent.trim() : ''; };
    const F = [{k: 'pledgeLabel', l: 'Tiêu đề mục', max: 60, v: S.pledgeLabel || dom('span[data-hdx-pledge]')}, {k: 'pledgeQuote', l: 'Câu hẹn ước (xuống dòng để ngắt dòng)', max: 400, ta: 1, v: S.pledgeQuote || dom('blockquote')}, {k: 'pledgeBy', l: 'Chữ ký', max: 120, v: S.pledgeBy || (e => e[1] ? e[1].textContent.trim() : '')(document.querySelectorAll('#hen-uoc span[data-hdx-pledge]'))}];
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa lời hẹn ước"><div class="md"><h2>Sửa “Lời hẹn ước”</h2>${F.map((f, n) => fieldHtml(f, f.v, n)).join('')}<div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    const q = s => modal.querySelector(s), first = modal.querySelector('input,textarea'); if (first) first.focus();
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (!t.hasAttribute('data-save')) return;
      const val = {}; modal.querySelectorAll('[data-k]').forEach(el => { val[el.dataset.k] = el.value.trim(); });
      t.disabled = true; t.textContent = 'Đang lưu…';
      try {
        const cur = await req('/rest/v1/site_content?select=data&key=eq.settings').catch(() => []);
        const b0 = cur && cur[0] && cur[0].data && !Array.isArray(cur[0].data) ? cur[0].data : {};
        const data = Object.assign({}, b0, {pledgeLabel: val.pledgeLabel, pledgeQuote: val.pledgeQuote, pledgeBy: val.pledgeBy});
        await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key: 'settings', data, updated_at: new Date().toISOString()}});
        Object.assign(S, {pledgeLabel: val.pledgeLabel, pledgeQuote: val.pledgeQuote, pledgeBy: val.pledgeBy});
        try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== 'settings'); rows.push({key: 'settings', data}); lsSet(H.cacheKey, rows); } catch (er) {}
        modal.innerHTML = ''; setHot(null); H.rerender(); toast('Đã lưu. Website đã cập nhật.');
      } catch (er) { const msg = errMsg(er); q('#err').textContent = msg; toast(msg, true); t.disabled = false; t.textContent = 'Lưu thay đổi'; }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  function openMeaning() {
    const H = window.HDX_HOME, S = H.settings || {}, sec = document.getElementById('y-nghia');
    const dom = (n, i) => { const e = sec && sec.querySelectorAll('[data-hdx-meaning]')[i]; return e ? e.textContent.trim() : ''; };
    const F = [{k: 'meaningTitle', l: 'Tiêu đề', max: 160, v: S.meaningTitle || dom('', 0)}, {k: 'meaningText', l: 'Đoạn giới thiệu (xuống dòng để tách đoạn)', max: 1500, ta: 1, v: S.meaningText || dom('', 1)},
      {k: 'meaningC1', l: 'Thẻ “01 · Tiếng gọi”', max: 600, ta: 1, v: S.meaningC1 || (S.meaningHide1 ? '' : dom('', 2))}, {k: 'meaningHide1', l: 'Ẩn (xoá) thẻ 01 khỏi trang chủ', chk: true, v: S.meaningHide1 ? '1' : ''},
      {k: 'meaningC2', l: 'Thẻ “02 · Lời hẹn”', max: 600, ta: 1, v: S.meaningC2 || (S.meaningHide2 ? '' : dom('', S.meaningHide1 ? 2 : 3))}, {k: 'meaningHide2', l: 'Ẩn (xoá) thẻ 02 khỏi trang chủ', chk: true, v: S.meaningHide2 ? '1' : ''}];
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa Ý nghĩa sự kiện"><div class="md"><h2>Sửa “Ý nghĩa sự kiện”</h2>${F.map((f, n) => fieldHtml(f, f.v, n)).join('')}<div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    const q = s => modal.querySelector(s), first = modal.querySelector('input,textarea'); if (first) first.focus();
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (!t.hasAttribute('data-save')) return;
      const val = {}; modal.querySelectorAll('[data-k]').forEach(el => { val[el.dataset.k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value.trim(); });
      t.disabled = true; t.textContent = 'Đang lưu…';
      try {
        const cur = await req('/rest/v1/site_content?select=data&key=eq.settings').catch(() => []);
        const b0 = cur && cur[0] && cur[0].data && !Array.isArray(cur[0].data) ? cur[0].data : {};
        const data = Object.assign({}, b0, val);
        await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key: 'settings', data, updated_at: new Date().toISOString()}});
        Object.assign(S, val, {meaningHide1: val.meaningHide1 === '1', meaningHide2: val.meaningHide2 === '1'});
        try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== 'settings'); rows.push({key: 'settings', data}); lsSet(H.cacheKey, rows); } catch (er) {}
        modal.innerHTML = ''; setHot(null); H.rerender(); toast('Đã lưu. Website đã cập nhật.');
      } catch (er) { const msg = errMsg(er); q('#err').textContent = msg; toast(msg, true); t.disabled = false; t.textContent = 'Lưu thay đổi'; }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  // Thu nhỏ ảnh (tối đa 900px) rồi tải lên kho ảnh “media” của Supabase; trả về địa chỉ công khai.
  async function uploadImage(file, maxDim, folder) {
    maxDim = maxDim || 900; folder = folder || 'sponsors';
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw {message: 'Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.'};
    let blob = file, ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'}[file.type];
    if (file.type !== 'image/gif') {
      try {
        const bmp = await createImageBitmap(file), sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc)); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        const keepPng = file.type === 'image/png', out = await new Promise(res => cv.toBlob(res, keepPng ? 'image/png' : 'image/webp', 0.9));
        if (out) { blob = out; ext = keepPng ? 'png' : 'webp'; }
      } catch (e) {}
    }
    if (blob.size > 5 * 1024 * 1024) throw {message: 'Ảnh quá lớn (tối đa 5 MB).'};
    const path = folder + '/' + new Date().toISOString().slice(0, 7) + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
    await req('/storage/v1/object/media/' + path, {method: 'POST', blob, headers: {'Content-Type': blob.type, 'x-upsert': 'false', 'cache-control': '31536000'}});
    return URL_ + '/storage/v1/object/public/media/' + path;
  }
  function openSponsor() {
    const H = window.HDX_HOME, S = H.settings || {};
    const F = [{k: 'sponsorTitle', l: 'Tiêu đề', max: 160, v: S.sponsorTitle || 'Cùng Đội viết tiếp hành trình 20 năm'}, {k: 'sponsorText', l: 'Mô tả (xuống dòng để tách đoạn)', max: 500, ta: 1, v: S.sponsorText || 'Cá nhân, cựu thành viên và đơn vị muốn đồng hành cùng sinh nhật 20 năm của Đội, vui lòng liên hệ Ban Đối ngoại.'},
      {k: 'sponsorRole', l: 'Vai trò người liên hệ', max: 80, v: S.sponsorRole || 'Phụ trách Đối ngoại'}, {k: 'sponsorName', l: 'Họ tên · Khóa', max: 120, v: S.sponsorName || 'Phạm Mạnh Hùng · K50'}, {k: 'sponsorPhone', l: 'Số điện thoại', max: 30, v: S.sponsorPhone || '0962.991.386'}];
    let imgs = (S.sponsorImages || []).slice();
    const imgHtml = () => `<div class="fld"><label>Ảnh / logo nhà tài trợ (tối đa 12)</label><div style="display:flex;flex-wrap:wrap;gap:8px">${imgs.map((u, n) => `<div style="position:relative;width:92px;height:62px;border-radius:10px;background:#EAF1F8;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${esc(u)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"><button type="button" data-imgdel="${n}" aria-label="Bỏ ảnh" style="position:absolute;top:2px;right:2px;width:22px;height:22px;border:0;border-radius:50%;background:#16285E;color:#fff;cursor:pointer;line-height:1">×</button></div>`).join('')}${imgs.length < 12 ? '<label class="b" id="imglab" style="cursor:pointer;margin:0;align-self:center">＋ Tải ảnh lên<input type="file" id="imgfile" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>' : ''}</div><div id="imginfo" style="font-size:13px;color:#5b6b92;margin-top:6px"></div></div>`;
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa mục Tài trợ"><div class="md"><h2>Sửa mục “Tài trợ &amp; đồng hành”</h2><p class="err" id="err"></p>${F.map((f, n) => fieldHtml(f, f.v, n)).join('')}<div id="imgs">${imgHtml()}</div><div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    const q = s => modal.querySelector(s), first = modal.querySelector('input,textarea'); if (first) first.focus();
    const redraw = msg => { q('#imgs').innerHTML = imgHtml(); if (msg) q('#imginfo').textContent = msg; wireFile(); };
    const wireFile = () => { const fi = q('#imgfile'); if (!fi) return; fi.onchange = async ev => { const fs = [...ev.target.files].slice(0, 12 - imgs.length); ev.target.value = ''; let n = 0; for (const f of fs) { q('#imginfo').textContent = 'Đang tải ảnh ' + (++n) + '/' + fs.length + '…'; try { imgs.push(await uploadImage(f)); } catch (er) { q('#err').textContent = (er && er.message) || 'Không tải được ảnh.'; break; } redraw('Đang tải ảnh ' + n + '/' + fs.length + '…'); } redraw(n ? 'Đã tải ảnh lên. Bấm “Lưu thay đổi” để đăng lên website.' : ''); }; };
    wireFile();
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (t.hasAttribute('data-imgdel')) { imgs.splice(+t.dataset.imgdel, 1); redraw(); return; }
      if (!t.hasAttribute('data-save')) return;
      const val = {}; modal.querySelectorAll('[data-k]').forEach(el => { val[el.dataset.k] = el.value.trim(); }); val.sponsorImages = imgs.slice();
      t.disabled = true; t.textContent = 'Đang lưu…';
      try {
        const cur = await req('/rest/v1/site_content?select=data&key=eq.settings').catch(() => []);
        const b0 = cur && cur[0] && cur[0].data && !Array.isArray(cur[0].data) ? cur[0].data : {};
        const data = Object.assign({}, b0, val);
        await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key: 'settings', data, updated_at: new Date().toISOString()}});
        Object.assign(S, val);
        try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== 'settings'); rows.push({key: 'settings', data}); lsSet(H.cacheKey, rows); } catch (er) {}
        modal.innerHTML = ''; setHot(null); H.rerender(); toast('Đã lưu. Website đã cập nhật.');
      } catch (er) { const msg = errMsg(er); q('#err').textContent = msg; toast(msg, true); t.disabled = false; t.textContent = 'Lưu thay đổi'; }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  function findItem(target) {
    if (target && target.closest && target.closest('[data-hdx-add]')) return null;
    const vt = videoTarget(target); if (vt) return vt;
    const mn = target && target.closest && target.closest('[data-hdx-meaning]'); if (mn && !host.contains(target)) return {key: 'meaning', el: mn};
    const ct = target && target.closest && target.closest('[data-hdx-contact]'); if (ct && !host.contains(target)) { const n = parseInt(ct.getAttribute('data-hdx-contact'), 10) - 1; if (n >= 0) return {key: 'contacts', i: n, el: ct}; }
    const sp = target && target.closest && target.closest('[data-hdx-sponsor]'); if (sp && !host.contains(target)) return {key: 'sponsor', el: sp};
    const ac = target && target.closest && target.closest('[data-hdx-act]'); if (ac && !host.contains(target)) { const n = parseInt(ac.getAttribute('data-hdx-act'), 10) - 1; if (n >= 0) return {key: 'activities', i: n, el: ac}; }
    const sg = target && target.closest && target.closest('[data-hdx-song]'); if (sg && !host.contains(target)) { const n = parseInt(sg.getAttribute('data-hdx-song'), 10) - 1; if (n >= 0) return {key: 'songs', i: n, el: sg}; }
    const rd = target && target.closest && target.closest('[data-hdx-radio]'); if (rd && !host.contains(target)) { const n = parseInt(rd.getAttribute('data-hdx-radio'), 10) - 1; if (n >= 0) return {key: 'radios', i: n, el: rd}; }
    const pl = target && target.closest && target.closest('[data-hdx-pledge]'); if (pl && !host.contains(target)) return {key: 'pledge', el: pl};
    let el = target, d = 0;
    while (el && el !== document.body && el !== document.documentElement && d < 6) {
      if (host.contains(el)) return null;
      const t = unq(norm(el.textContent)).replace(/Điểm hẹn chính$/, '').trim();
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
  const inPost = t => !!(t && t.closest && t.closest('#post-body'));
  const onMove = e => { if (!homeBlocks() || modal.firstChild || inPost(e.target)) return; const f = findItem(e.target); setHot(f ? f.el : null); };
  const onClick = e => {
    if (!editing || host.contains(e.target) || e.composedPath().includes(host)) return;
    if (!homeBlocks() || inPost(e.target)) return;
    if (e.target.closest && e.target.closest('[data-hdx-open]')) return;
    const ab = e.target.closest && e.target.closest('[data-hdx-add]'); if (ab) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openItem(ab.dataset.hdxAdd, -1); return; }
    const f = findItem(e.target); if (!f) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (f.key === 'video') openVideo(); else if (f.key === 'pledge') openPledge(); else if (f.key === 'meaning') openMeaning(); else if (f.key === 'sponsor') openSponsor(); else openItem(f.key, f.i);
  };

  function fieldHtml(f, v, idx, extra) {
    const id = 'f' + idx;
    if (f.img) return `<div class="fld"><label for="${id}">${esc(f.l)}</label><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div id="imgprev" style="width:120px;height:90px;border-radius:12px;background:#EAF1F8 center/cover no-repeat ${v ? 'url(&quot;' + esc(v) + '&quot;)' : ''}"></div><div style="flex:1 1 200px;display:flex;flex-direction:column;gap:6px"><input id="${id}" data-k="${f.k}" type="text" maxlength="${f.max}" value="${esc(v || '')}" placeholder="https://… hoặc tải ảnh lên"><label class="b" style="cursor:pointer;align-self:flex-start;margin:0" id="imglab">Tải ảnh từ máy<input type="file" id="imgup" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><span id="imginfo" style="font-size:12.5px;color:#5b6b92"></span></div></div></div>`;
    if (f.chk) return `<div class="fld"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="${id}" data-k="${f.k}" ${v === '1' || v === true ? 'checked' : ''} style="width:auto"> ${esc(f.l)}</label></div>`;
    return `<div class="fld"><label for="${id}">${esc(f.l)}</label>${f.ta ? `<textarea id="${id}" data-k="${f.k}" maxlength="${f.max}">${esc(v || '')}</textarea>` : `<input id="${id}" data-k="${f.k}" type="text" maxlength="${f.max}" value="${esc(v || '')}">`}</div>`;
  }
  function openItem(key, i) {
    const B = homeBlocks()[key], fields = FIELDS[key], isNew = i < 0, it = isNew ? B.clean({}) : B.clean(B.t[i]); if (key === 'songs' && !it.src) { if (it.sp) it.src = 'https://open.spotify.com/' + it.sp; else if (it.yt) it.src = 'https://youtu.be/' + it.yt; } const canDel = !isNew && B.t.length > 1;
    const rounds = key === 'sports' ? (it.rounds || []).map(r => ({...r})) : null;
    const drawRounds = () => `<div class="fld"><label>Lịch thi đấu</label>${rounds.map((r, j) => `<div class="rd"><input data-r="${j}" data-rk="when" maxlength="80" placeholder="Thời gian" value="${esc(r.when)}"><input data-r="${j}" data-rk="what" maxlength="160" placeholder="Nội dung" value="${esc(r.what)}"><button class="b d" data-rdel="${j}" style="margin:0;padding:8px 12px" aria-label="Xoá vòng">✕</button></div>`).join('')}${rounds.length < 10 ? '<button class="b" data-radd style="padding:7px 14px;font-size:13px">+ Thêm vòng</button>' : ''}</div>`;
    const draw = () => {
      modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Sửa nội dung"><div class="md"><h2>${isNew ? 'Thêm' : 'Sửa'} ${esc(NOUN[key])}${isNew ? '' : ' #' + (i + 1)}</h2><p class="sub">Lưu xong, nội dung trên website đổi ngay.</p><p class="err" id="err"></p>
        ${fields.map((f, n) => fieldHtml(f, it[f.k], n)).join('')}${rounds ? `<div id="rounds">${drawRounds()}</div>` : ''}
        <div class="row">${canDel ? '<button class="b d" data-del>Xoá mục này</button>' : ''}${!isNew && B.t.length > 1 ? `<button class="b" data-mv="-1" ${i === 0 ? 'disabled' : ''} title="Đưa lên trước">▲ Lên</button><button class="b" data-mv="1" ${i === B.t.length - 1 ? 'disabled' : ''} title="Đưa xuống sau">▼ Xuống</button>` : ''}<button class="b" data-cancel>Huỷ</button><button class="b p" data-save>Lưu thay đổi</button></div></div></div>`;
    };
    if (key === 'activities' && isNew) { const L = B.t[B.t.length - 1]; it.group = (L && L.group) || ''; }
    draw();
    const q = s => modal.querySelector(s), setErr = m => { q('#err').textContent = m || ''; };
    const imgUp = modal.querySelector('#imgup');
    if (imgUp) imgUp.onchange = async ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      q('#imginfo').textContent = 'Đang tải ảnh lên…'; setErr('');
      try { const u = await uploadImage(f, 1200, 'activities'); modal.querySelector('#imgup').closest('.fld').querySelector('input[data-k]').value = u; q('#imgprev').style.backgroundImage = 'url("' + u + '")'; q('#imginfo').textContent = 'Đã tải ảnh. Bấm “Lưu thay đổi”.'; }
      catch (er) { q('#imginfo').textContent = ''; setErr(errMsg(er)); }
    };
    const first = modal.querySelector('input,textarea'); if (first) first.focus();
    const sync = () => { modal.querySelectorAll('[data-k]').forEach(el => { it[el.dataset.k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; }); if (rounds) modal.querySelectorAll('[data-r]').forEach(el => { rounds[+el.dataset.r][el.dataset.rk] = el.value; }); };
    modal.onclick = async e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (t.hasAttribute('data-radd')) { sync(); rounds.push({when: '', what: ''}); q('#rounds').innerHTML = drawRounds(); return; }
      if (t.hasAttribute('data-rdel')) { sync(); rounds.splice(+t.dataset.rdel, 1); q('#rounds').innerHTML = drawRounds(); return; }
      if (t.hasAttribute('data-mv')) {
        const j = i + Number(t.dataset.mv); if (j < 0 || j >= B.t.length) return;
        sync(); const arr = B.t.map(B.clean); arr[i] = B.clean(it); [arr[i], arr[j]] = [arr[j], arr[i]];
        t.disabled = true; const ok = await commit(key, arr, 'Đã đổi thứ tự.'); if (ok) { const el = findNth(key, j); if (el) openItemSoon(key, j); } else t.disabled = false; return;
      }
      if (t.hasAttribute('data-del')) {
        if (!confirm(`Xoá ${NOUN[key]} này khỏi website?`)) return;
        await commit(key, B.t.map(B.clean).filter((_, n) => n !== i), 'Đã xoá.'); return;
      }
      if (t.hasAttribute('data-save')) {
        sync();
        if (!norm(it[REQ[key]])) { setErr(`“${fields.find(f => f.k === REQ[key]).l}” không được để trống.`); return; }
        for (const f of fields) { const v = norm(it[f.k]); if (f.yt) { const y = ytId(v); if (y === null) { setErr('Link/ID YouTube không hợp lệ.'); return; } it[f.k] = y; } else if (v && f.re && !f.re.test(v)) { setErr(f.err); return; } }
        if (key === 'songs') { const r = songLink(it.src); if (!r) { setErr('Link nhạc không hợp lệ. Dùng link Spotify, YouTube, link chia sẻ Google Drive hoặc link tệp .mp3 (https://…).'); return; } it.src = r.src; it.yt = r.yt; it.sp = r.sp || ''; }
        if (key === 'radios') it.ftype = /\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(it.file || '') ? 'video' : 'audio';
        if (rounds) it.rounds = rounds.filter(r => norm(r.when) || norm(r.what));
        const arr = B.t.map(B.clean); if (isNew) arr.push(B.clean(it)); else arr[i] = B.clean(it);
        t.disabled = true; t.textContent = 'Đang lưu…';
        const ok = await commit(key, arr, 'Đã lưu. Website đã cập nhật.');
        if (!ok) { t.disabled = false; t.textContent = 'Lưu thay đổi'; }
      }
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  function findNth() { return true; }
  function openItemSoon(key, j) { setTimeout(() => openItem(key, j), 60); }
  async function commit(key, arr, okMsg) {
    const H = window.HDX_HOME, B = H.blocks[key];
    if (!arr.length) { toast('Cần giữ lại ít nhất 1 mục.', true); return false; }
    try {
      await req('/rest/v1/site_content?on_conflict=key', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {key, data: arr, updated_at: new Date().toISOString()}});
    } catch (e) {
      const msg = e && (e.status === 404 || e.code === '23514') ? 'Cần cập nhật cơ sở dữ liệu: chạy lại supabase/site_content.sql trong Supabase (SQL Editor), rồi lưu lại.' : errMsg(e);
      const er = modal.querySelector('#err'); if (er) er.textContent = msg; toast(msg, true); return false;
    }
    B.t.splice(0, B.t.length, ...arr.map(B.derive));
    try { const rows = (lsGet(H.cacheKey) || []).filter(r => r && r.key !== key); rows.push({key, data: arr}); lsSet(H.cacheKey, rows); } catch (e) {}
    modal.innerHTML = ''; setHot(null); H.rerender(); toast(okMsg); return true;
  }

  /* ---------- Bài viết chi tiết của mục “Hoạt động” ---------- */
  const postKey = () => (window.HDX_HOME && window.HDX_HOME.postKey && window.HDX_HOME.postKey()) || 'chain';
  const postIdx = () => (window.HDX_HOME && window.HDX_HOME.post) ? window.HDX_HOME.post() : -1;
  const postEl = () => document.getElementById('post-body');
  let lastRange = null, lastPost = -2;
  document.addEventListener('selectionchange', () => { const el = postEl(), s = window.getSelection(); if (el && s && s.rangeCount && el.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange(); });
  function insertInPost(html) {
    const el = postEl(); if (!el) return; el.focus();
    const s = window.getSelection(); s.removeAllRanges();
    if (lastRange && el.contains(lastRange.startContainer)) s.addRange(lastRange); else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.addRange(r); }
    if (!document.execCommand('insertHTML', false, html)) el.insertAdjacentHTML('beforeend', html);
    try { lastRange = s.getRangeAt(0).cloneRange(); } catch (e) {}
  }
  function startPost() {
    const el = postEl(); if (!el || el.getAttribute('contenteditable') === 'true') return;
    el.setAttribute('contenteditable', 'true');
    if (el.firstElementChild && !el.querySelector('img,iframe,video') && /đang được cập nhật/.test(el.textContent) && el.children.length === 1) el.innerHTML = '';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    draw();
  }
  function stopPost() {
    const el = postEl(); if (el) { el.removeAttribute('contenteditable'); el.removeAttribute('data-rk'); }
    if (window.HDX_HOME && window.HDX_HOME.syncPostBody) window.HDX_HOME.syncPostBody();
  }
  setInterval(() => {
    if (!isAdmin || !mounted) return;
    const pi = postIdx(); if (pi !== lastPost) { lastPost = pi; draw(); }
    const el = postEl();
    if (editing && pi >= 0 && el) startPost(); else if (el && el.getAttribute('contenteditable') === 'true') stopPost();
  }, 400);
  function pickPostImages() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp,image/gif'; inp.multiple = true;
    inp.onchange = async () => {
      const fs = [...inp.files]; let n = 0, ok = 0;
      for (const f of fs) {
        toast('Đang tải ảnh ' + (++n) + '/' + fs.length + '…');
        try { const u = await uploadImage(f, 1600, 'posts'); insertInPost('<p><img src="' + u + '" alt=""></p>'); ok++; } catch (e) { toast(errMsg(e), true); }
      }
      if (ok) toast('Đã chèn ' + ok + ' ảnh. Nhớ bấm “Lưu bài”.');
    };
    inp.click();
  }
  function openPostVideo() {
    const S = (window.HDX_HOME && window.HDX_HOME.settings) || {};
    modal.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="Chèn video"><div class="md"><h2>Chèn video vào bài</h2><p class="sub">Dán link YouTube, link chia sẻ Google Drive hoặc link tệp .mp4/.webm — hoặc tải video từ máy lên (lưu Google Drive).</p><p class="err" id="err"></p>
      <div class="fld"><label for="pv">Link video</label><input id="pv" type="text" maxlength="600" placeholder="https://www.youtube.com/watch?v=…"></div>
      <div class="fld"><label>Hoặc tải video lên</label><div id="vinfo" style="font-size:13px;color:#5b6b92"></div><div class="row" style="justify-content:flex-start;margin:0"><label class="b" style="cursor:pointer" id="vlab">Chọn video từ máy<input type="file" id="vfile" accept="video/*,.mp4,.mov,.webm,.m4v" hidden></label></div></div>
      <div class="row"><button class="b" data-cancel>Huỷ</button><button class="b p" data-ins>Chèn video</button></div></div></div>`;
    const q = s => modal.querySelector(s); q('#pv').focus();
    const put = html => { modal.innerHTML = ''; insertInPost(html); toast('Đã chèn video. Nhớ bấm “Lưu bài”.'); };
    const frame = src => '<p><iframe src="' + src + '"></iframe></p>';
    q('#vfile').onchange = async ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      if (!(/^video\//.test(f.type) || /\.(mp4|mov|webm|m4v)$/i.test(f.name))) { q('#err').textContent = 'Chỉ nhận tệp video (MP4, MOV, WebM).'; return; }
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(S.driveUrl || '')) { q('#err').textContent = 'Chưa kết nối Google Drive: vào Admin → Bảo tàng ký ức dán địa chỉ Apps Script trước.'; return; }
      q('#err').textContent = ''; q('#vlab').style.opacity = '.55'; q('#vfile').disabled = true;
      try { const id = await driveUpload(f, 'VIDEO', pct => { q('#vinfo').textContent = 'Đang tải lên Google Drive… ' + pct + '%'; }); put(frame('https://drive.google.com/file/d/' + id + '/preview')); }
      catch (er) { q('#err').textContent = errMsg(er); q('#vlab').style.opacity = ''; q('#vfile').disabled = false; q('#vinfo').textContent = ''; }
    };
    modal.onclick = e => {
      const t = e.target;
      if (t.matches('.ov') || t.hasAttribute('data-cancel')) { modal.innerHTML = ''; return; }
      if (!t.hasAttribute('data-ins')) return;
      const v = (q('#pv').value || '').trim(); if (!v) { q('#err').textContent = 'Dán link video hoặc tải video lên.'; return; }
      const y = ytId(v), d = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,100})/i);
      if (y && /youtu|^[\w-]{6,20}$/.test(v)) put(frame('https://www.youtube.com/embed/' + y));
      else if (d) put(frame('https://drive.google.com/file/d/' + d[1] + '/preview'));
      else if (/^https:\/\/[^\s"'<>]+\.(mp4|webm|m4v|mov)(\?[^\s"'<>]*)?$/i.test(v)) put('<p><video src="' + v + '" controls></video></p>');
      else q('#err').textContent = 'Link không nhận dạng được. Dùng link YouTube, Google Drive hoặc tệp .mp4/.webm (https://…).';
    };
    modal.onkeydown = e => { if (e.key === 'Escape') modal.innerHTML = ''; };
  }
  async function savePost() {
    const el = postEl(), i = postIdx(), H = window.HDX_HOME; if (!el || i < 0) return;
    const c = el.cloneNode(true); c.querySelectorAll('div').forEach(d => { const p = document.createElement('p'); p.innerHTML = d.innerHTML; d.replaceWith(p); });
    Array.from(c.childNodes).forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) { const p = document.createElement('p'); p.textContent = n.textContent; n.replaceWith(p); } });
    c.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.querySelector('img,iframe,video')) p.remove(); });
    const body = H.cleanHtml(c.innerHTML).replace(/<p>(?:<br>|\s)*<\/p>/g, '').trim();
    if (body.length > 150000) { toast('Nội dung quá dài (tối đa khoảng 150.000 ký tự).', true); return; }
    const pk = postKey(), B = H.blocks[pk], arr = B.t.map(B.clean); if (!arr[i]) { toast('Không tìm thấy hoạt động này.', true); return; }
    arr[i] = Object.assign({}, arr[i], {body});
    const btn = ui.querySelector('[data-psave]'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    const ok = await commit(pk, arr, 'Đã lưu bài viết. Website đã cập nhật.');
    if (ok) stopPost(); else if (btn) { btn.disabled = false; btn.textContent = 'Lưu bài'; }
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
    const pi = postIdx();
    const postTb = editing && pi >= 0 ? `<div class="tb" role="toolbar" aria-label="Soạn bài viết hoạt động">
      <button data-fmt="bold" title="In đậm"><b>B</b></button><button data-fmt="italic" title="In nghiêng"><i>I</i></button><button data-fmt="h2" title="Tiêu đề phụ">H2</button><button data-fmt="ul" title="Danh sách">• Ds</button><button data-fmt="quote" title="Trích dẫn">“ ”</button><button data-fmt="link" title="Liên kết">🔗</button>
      <span class="sep"></span><button data-pimg title="Chèn ảnh">🖼 Ảnh</button><button data-pvid title="Chèn video">🎬 Video</button><button data-ptitle title="Sửa tiêu đề, mô tả hoặc xoá bài">✎ Tiêu đề</button>
      <span class="sep"></span><button class="save" data-psave>Lưu bài</button><button data-pcancel>Bỏ thay đổi</button></div>` : '';
    ui.innerHTML = `${articleTb}${postTb}<div class="fab" role="region" aria-label="Chế độ chỉnh sửa">
      ${editing ? `<span>${pi >= 0 ? 'Viết nội dung bài ngay trong khung viền cam' : art ? 'Sửa trực tiếp tiêu đề, mô tả, nội dung' : homeBlocks() ? 'Bấm vào chữ có viền cam để sửa' : 'Mở một bài viết để sửa'}</span>` : `<span>${em}</span>`}
      <button class="${editing ? 'on' : ''}" data-toggle>${editing ? '✓ Thoát chỉnh sửa' : '✎ Chỉnh sửa trang'}</button><a href="admin.html">Quản trị</a></div>`;
  }
  ui.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-toggle')) { setEditing(!editing); return; }
    if (t.hasAttribute('data-psave')) { savePost(); return; }
    if (t.hasAttribute('data-pcancel')) { stopPost(); toast('Đã bỏ các thay đổi chưa lưu.'); return; }
    if (t.hasAttribute('data-ptitle')) { openItem(postKey(), postIdx()); return; }
    if (t.hasAttribute('data-pimg')) { pickPostImages(); return; }
    if (t.hasAttribute('data-pvid')) { openPostVideo(); return; }
    if (t.hasAttribute('data-asave')) { saveArticle(); return; }
    if (t.hasAttribute('data-acancel')) { if (window.route) window.route(); toast('Đã bỏ các thay đổi chưa lưu.'); return; }
    const f = t.dataset.fmt; if (!f) return;
    if (f === 'h2') fmtCmd('formatBlock', 'h2'); else if (f === 'ul') fmtCmd('insertUnorderedList'); else if (f === 'quote') fmtCmd('formatBlock', 'blockquote');
    else if (f === 'link') { const u = prompt('Địa chỉ liên kết (https://…):', 'https://'); if (u && /^(https?:|mailto:|tel:)/i.test(u)) fmtCmd('createLink', u); else if (u) toast('Liên kết phải bắt đầu bằng https://', true); }
    else fmtCmd(f);
  });
  ui.addEventListener('mousedown', e => { if (e.target.closest('.tb')) e.preventDefault(); }); // giữ vùng chọn khi bấm nút định dạng

  // Nút “Thêm hoạt động” nằm ngay trong mục “Một ngày để trở về”, chỉ hiện khi đang bật chỉnh sửa.
  const ADD_BTNS = [{key: 'agenda', sec: 'agenda', label: '＋ Thêm hoạt động lịch trình', inner: false}, {key: 'chain', sec: 'hoat-dong', label: '＋ Thêm hoạt động', inner: true}, {key: 'activities', sec: 'hd-nam', label: '＋ Thêm hoạt động trong năm', inner: false}, {key: 'slides', sec: 'hen-uoc', label: '＋ Thêm lời hẹn ước', inner: true}, {key: 'radios', sec: 'hd-radio', label: '＋ Thêm số radio', inner: true}, {key: 'songs', sec: 'tieng-goi', label: '＋ Thêm bài hát', inner: true}, {key: 'contacts', sec: 'tai-tro', label: '＋ Thêm đầu mối liên hệ', before: true}];
  function syncAddBtn() {
    ADD_BTNS.forEach(d => {
      const sec = document.getElementById(d.sec), cur = document.querySelector('[data-hdx-add="' + d.key + '"]');
      if (!editing || !sec || !homeBlocks()) { if (cur) cur.remove(); return; }
      const host_ = d.before ? sec.parentNode : d.inner && sec.firstElementChild ? sec.firstElementChild : sec;
      if (cur && cur.parentNode === host_ && (!d.before || cur.nextSibling === sec)) return;
      if (cur) cur.remove();
      const w = document.createElement('div'); w.setAttribute('data-hdx-add', d.key); w.style.cssText = 'display:flex;justify-content:center;margin-top:24px';
      w.innerHTML = '<button type="button" style="cursor:pointer;font:inherit;font-weight:700;font-size:15px;padding:11px 22px;border-radius:999px;border:2px dashed #F28A55;background:#fff;color:#C4571F">' + d.label + '</button>';
      if (d.before) host_.insertBefore(w, sec); else host_.appendChild(w);
    });
  }
  setInterval(syncAddBtn, 400);
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
