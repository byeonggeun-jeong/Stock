import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Mock 데이터로 기동 중이거나 Supabase URL/Key가 설정되지 않은 경우 경고 표시
export const isMockMode =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
  !supabaseUrl ||
  supabaseUrl === 'your-supabase-project-url' ||
  !supabaseAnonKey ||
  supabaseAnonKey === 'your-supabase-anon-key';

// Mock 모드가 아닐 때만 실제 Supabase 클라이언트 초기화
export const supabase = !isMockMode
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any); // Mock 모드에서는 null로 처리하고 클라이언트 코드에서 대응
