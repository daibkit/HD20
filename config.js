// Cấu hình kết nối Supabase (khoá "anon" là khoá CÔNG KHAI, an toàn để đặt ở đây:
// quyền ghi được bảo vệ bằng RLS — chỉ email trong bảng admins mới ghi được).
// Lấy ở Supabase: Project Settings → API Keys. Dùng khoá "anon public" (eyJ...) hoặc "publishable" (sb_publishable_...).
// TUYỆT ĐỐI không dán khoá "service_role" hay "secret" vào đây.
window.HDX_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
