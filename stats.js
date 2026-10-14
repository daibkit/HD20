/* Đếm truy cập & click (ẩn danh) → Supabase hàm hit(). Bỏ qua khi đang chỉnh sửa/đăng nhập admin. */
(function () {
  var C = window.HDX_CONFIG || {}, U = String(C.supabaseUrl || '').replace(/\/+$/, ''), K = String(C.supabaseAnonKey || '');
  if (!U || !K || /admin\.html/.test(location.pathname)) return;
  var H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'};
  function slug(s, n) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n || 40); }
  function isAdmin() { try { return !!localStorage.getItem('hdx_nostat') || document.documentElement.classList.contains('hdx-editing'); } catch (e) { return false; } }
  function hit(k, label) {
    if (isAdmin()) return;
    try { fetch(U + '/rest/v1/rpc/hit', {method: 'POST', headers: H, keepalive: true, body: JSON.stringify({p_k: k, p_label: label || ''})}).catch(function () {}); } catch (e) {}
  }
  function route() { var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return h || 'trang-chu'; }
  var lastR = '';
  function page() { var r = route(); if (r === lastR) return; lastR = r; hit('p:' + slug(r.replace(/\/\d+$/, '')) + (/\/\d+$/.test(r) ? '/' + r.split('/').pop() : ''), 'Trang: ' + r); }
  // lượt truy cập (1 lần / phiên) + người truy cập (1 lần / trình duyệt)
  try { if (!sessionStorage.getItem('hdx_v')) { sessionStorage.setItem('hdx_v', '1'); hit('visit', 'Lượt truy cập'); } if (!localStorage.getItem('hdx_u')) { localStorage.setItem('hdx_u', '1'); hit('uniq', 'Người truy cập mới'); } } catch (e) { hit('visit', 'Lượt truy cập'); }
  page(); window.addEventListener('hashchange', page);
  // click từng mục — ghi theo dạng: Trang › Khu vực › (thẻ) › nút
  var PAGES = {'trang-chu': 'Trang chủ', home: 'Trang chủ', about: 'Giới thiệu Đội', museum: 'Bảo tàng ký ức', contact: 'Liên hệ & Tài trợ', events: 'Lịch trình'};
  var SECS = {video: 'Video', agenda: 'Lịch trình', 'hoat-dong': 'Chuỗi hoạt động', 'hen-uoc': 'Lời hẹn ước', 'y-nghia': 'Ý nghĩa', 'dang-ky': 'Đăng ký', 'ky-uc': 'Bảo tàng ký ức (cuối trang chủ)', 'hd-nam': 'Một năm của Đội', 'chuoi-hoat-dong': 'Chuỗi hoạt động', 'hd-radio': 'HD Radioshow', 'tieng-goi': 'Tiếng gọi HDX', 'giao-lo': 'Giao lộ thời gian', 'tai-tro': 'Tài trợ', 'lien-he': 'Liên hệ', 'bai-viet': 'Bài viết', 'post-body': 'Bài viết'};
  var SYM = {'×': 'Đóng', '✕': 'Đóng', '‹': 'Trước', '›': 'Sau', '‹‹': 'Bài trước', '››': 'Bài sau'};
  function pageName() { var r = route(); if (/^(hoat-dong|ngay-hoi)\/\d+$/.test(r)) return 'Bài viết'; return PAGES[r] || r; }
  function first(t) { return String(t || '').split('\n').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean)[0] || ''; }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || t.shadowRoot) return;
    var el = t.closest('a,button,[data-hdx-open],[data-hdx-act],[data-hdx-song],[role=button],summary'); if (!el) return;
    if (el.closest('#post-body') && el.tagName !== 'A') return;
    var label = first(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent);
    if (!label) { var im = el.querySelector('img[alt]'); label = im ? im.alt : ''; }
    label = SYM[label] || label; if (!label) return;
    if (label.length > 50) label = label.slice(0, 48) + '…';
    // khu vực: tổ tiên có id có nghĩa (bỏ qua khung gốc), hoặc menu / chân trang
    var area = '', n = el;
    while (n && n !== document.body) {
      if (n.tagName === 'HEADER' || (n.tagName === 'NAV')) { area = 'Menu'; break; }
      if (n.tagName === 'FOOTER') { area = 'Chân trang'; break; }
      if (n.id && n.id !== 'dc-root' && !/^(root|app|__)/.test(n.id)) { area = SECS[n.id] || ''; if (area) break; }
      n = n.parentElement;
    }
    if (!area && (el.closest('[data-hdx-vid]') || el.closest('video'))) area = 'Video';
    // thẻ: tên thẻ (dòng đầu) — chỉ khi nút nằm TRONG thẻ
    var card = el.closest('[data-hdx-act],[data-hdx-song],[data-hdx-radio],[data-hdx-chain]'), cl = '';
    if (card && card !== el) { cl = first(card.innerText).slice(0, 36); } else if (card === el) { cl = ''; }
    var parts = [pageName()]; if (area) parts.push(area); if (cl && cl !== label) parts.push(cl); parts.push(label);
    var text = parts.join(' › ');
    hit('c:' + slug(parts.join('-'), 85), text.slice(0, 80));
  }, true);
})();
