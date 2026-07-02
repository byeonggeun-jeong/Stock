-- 1. Profiles 테이블 생성 (사용자 정보)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Profiles RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles 정책 설정
CREATE POLICY "누구나 프로필을 볼 수 있습니다." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "사용자는 자신의 프로필만 업데이트할 수 있습니다." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Portfolios 테이블 생성 (주식 보유 현황)
CREATE TABLE public.portfolios (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  shares_count NUMERIC NOT NULL CHECK (shares_count >= 0),
  average_buy_price NUMERIC NOT NULL CHECK (average_buy_price >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('KRW', 'USD')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Portfolios RLS 활성화
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Portfolios 정책 설정
CREATE POLICY "누구나 포트폴리오를 조회할 수 있습니다." ON public.portfolios
  FOR SELECT USING (true);

CREATE POLICY "인증된 사용자만 자신의 포트폴리오를 추가할 수 있습니다." ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 포트폴리오만 수정할 수 있습니다." ON public.portfolios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 포트폴리오만 삭제할 수 있습니다." ON public.portfolios
  FOR DELETE USING (auth.uid() = user_id);

-- 3. 회원 가입 시 profiles 자동 생성 트리거 함수 정의
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 회원 가입 트리거 설정
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
