// Cấu hình kết nối Supabase (khoá "anon" là khoá CÔNG KHAI, an toàn để đặt ở đây:
// quyền ghi được bảo vệ bằng RLS — chỉ email trong bảng admins mới ghi được).
// Lấy ở Supabase: Project Settings → API → Project URL và "anon public" key.
window.HDX_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
