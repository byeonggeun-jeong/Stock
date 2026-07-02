# StockUs: 친구들과 함께 쓰는 실시간 주식 포트폴리오 대시보드

이 프로젝트는 친구들(10명 이하)이 각자의 주식 보유 현황을 직접 입력하고, 실시간 주가 등락률과 그룹 전체의 포트폴리오 자산 비중을 공유하여 모니터링할 수 있는 **24시간 무료 웹 대시보드**입니다.

## 🚀 주요 기능
1. **메인 대시보드**:
   - 친구들이 보유한 모든 주식을 취합하여 보여주는 실시간 현황판.
   - 그룹 전체 또는 개별 친구를 선택하여 필터링해 볼 수 있는 자산 요약 카드.
   - Recharts 기반의 원화 환산 보유 주식 비중 시각화(도넛 차트).
   - 야후 파이낸스(Yahoo Finance) 라이브러리를 활용한 30초 주기 실시간 시세 갱신.
2. **내 주식 관리**:
   - 각 사용자가 로그인하여 자신의 보유 주식 목록을 추가, 수정, 삭제(CRUD)할 수 있는 화면.
3. **데모 모드 지원**:
   - Supabase 연동 전에도 화면에서 가상으로 친구들을 추가하고 포트폴리오를 주무를 수 있는 완벽한 목업 데이터 상태 제공.

---

## 🛠️ 기술 스택
- **Framework**: Next.js 14 (React, TypeScript)
- **Database / Auth**: Supabase (PostgreSQL)
- **Hosting**: Vercel (Free Tier - 24시간 가동)
- **Stock API**: `yahoo-finance2` (무료 실시간 주가 조회 라이브러리)
- **UI Styling**: Vanilla CSS (모던 다크 테마 & 글래스모피즘 적용)

---

## ⚙️ 시작하기 (로컬 실행)

### 1. 패키지 설치
프로젝트 폴더 내에서 다음 명령어를 실행하여 필요한 패키지를 설치합니다.
```bash
npm install
```

### 2. 로컬 실행
개발 서버를 켭니다. 기본적으로 데모 모드(`NEXT_PUBLIC_USE_MOCK_DATA=true`)로 실행되어 즉시 UI를 만져볼 수 있습니다.
```bash
npm run dev
```
브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

---

## 🗄️ Supabase 연동 설정 (실제 공유하여 사용 시)

친구들과 실제 데이터를 동기화하여 서비스하려면 Supabase 데이터베이스와의 연동이 필요합니다.

### 1. Supabase 프로젝트 생성
- [Supabase 공식 홈페이지](https://supabase.com)에 로그인하여 무료 프로젝트를 생성합니다.

### 2. SQL Schema 적용
- Supabase 대시보드 좌측의 **SQL Editor**로 이동합니다.
- `New Query`를 누르고, 이 프로젝트의 [supabase/schema.sql](file://./supabase/schema.sql) 파일 내용을 복사하여 붙여넣은 뒤 **Run** 버튼을 눌러 테이블과 권한 트리거를 생성합니다.

### 3. 환경 변수 설정
- 프로젝트 루트 디렉토리의 `.env.local` 파일을 열고 다음과 같이 수정합니다:
```env
# Supabase 프로젝트 설정 (Settings -> API 메뉴에서 URL과 anon key를 확인하여 넣으세요)
NEXT_PUBLIC_SUPABASE_URL=당신의_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=당신의_SUPABASE_ANON_KEY

# 실제 Supabase 연동을 시작하므로 false로 변경합니다.
NEXT_PUBLIC_USE_MOCK_DATA=false
```

---

## ☁️ Vercel 배포 가이드 (24시간 무료 웹 배포)

Vercel을 통해 전 세계 어디서든 친구들이 접속할 수 있도록 웹에 배포합니다.

1. **GitHub 저장소 생성 및 코드 푸시**:
   - 본 프로젝트 코드를 본인의 깃허브 저장소(Private 또는 Public)에 푸시합니다.
2. **Vercel 연동**:
   - [Vercel](https://vercel.com)에 로그인 후 `Add New...` -> `Project`를 누릅니다.
   - 방금 코드를 올린 깃허브 저장소를 Import합니다.
3. **환경 변수 추가 (Environment Variables)**:
   - 빌드 설정 전, 하단의 **Environment Variables** 탭에 로컬 `.env.local`에 설정한 환경 변수 3개를 추가합니다.
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SUPABASE_USE_MOCK_DATA` = `false`
4. **Deploy**:
   - `Deploy` 버튼을 누르고 1분가량 기다리면, 제공되는 도메인을 통해 친구들과 함께 사용할 수 있습니다.

---

## 💡 주식 입력 팁 (Ticker 가이드)
야후 파이낸스 API 기준의 정확한 티커를 입력해야 실시간 주가가 연동됩니다.
* **미국 주식**: `AAPL`(애플), `TSLA`(테슬라), `NVDA`(엔비디아) 등 영문 약어를 그대로 입력합니다.
* **한국 주식**: 종목코드 뒤에 거래소 식별자를 붙입니다.
  * 코스피 종목: 종목코드 뒤에 `.KS` 부착 (예: 삼성전자는 `005930.KS`, NAVER는 `035420.KS`)
  * 코스닥 종목: 종목코드 뒤에 `.KQ` 부착 (예: 에코프로는 `086520.KQ`)
