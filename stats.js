/* Đếm truy cập & click (ẩn danh) → Supabase hàm hit(). Bỏ qua khi đang chỉnh sửa/đăng nhập admin. */
(function () {
  var C = window.HDX_CONFIG || {}, U = String(C.supabaseUrl || '').replace(/\/+$/, ''), K = String(C.supabaseAnonKey || '');
  if (!U || !K || /admin\.html/.test(location.pathname)) return;
  var H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'};
  function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
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
  // click từng mục
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || t.shadowRoot) return;
    var el = t.closest('a,button,[data-hdx-open],[data-hdx-act],[data-hdx-song],[role=button],summary'); if (!el) return;
    if (el.closest('#post-body') && el.tagName !== 'A') return;
    var label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!label) { var im = el.querySelector('img[alt]'); label = im ? im.alt : ''; }
    if (!label) return;
    var sec = el.closest('section[id],header,footer,nav,[id]'), sid = sec ? (sec.tagName === 'HEADER' ? 'menu' : sec.tagName === 'FOOTER' ? 'chan-trang' : sec.id) : '';
    var card = el.closest('[data-hdx-act],[data-hdx-song],[data-hdx-chain]'); if (card && card !== el) { var cl = (card.innerText || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean)[0] || ''; cl = cl.slice(0, 40); if (cl) label = cl + ' › ' + label; }
    hit('c:' + (slug(sid) || 'khac') + ':' + slug(label), (sid ? sid + ' › ' : '') + label);
  }, true);
})();
