'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  RefreshCw, 
  User, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  LogIn, 
  Lock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { supabase, isMockMode } from '@/lib/supabase';

 

// 사용자 이름을 바탕으로 고유한 파스텔/네온 톤 아바타 배경색 반환
const getUserAvatarColor = (name: string) => {
  if (!name) return '#6366f1';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f43f5e'  // Rose
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}; 

// 귀여운 옆모습 실루엣 검정 개미 SVG 아이콘 컴포넌트
const AntIcon = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ transform: 'rotate(-5deg)' }}
  >
    {/* 옆모습 개미 다리 3개 (심플한 실루엣 라인) */}
    <path d="M7.5 14 L 6 18.5" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
    <path d="M12.5 14 L 12.5 19" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
    <path d="M16.5 14 L 18.5 18.5" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
    
    {/* 심플한 더듬이 */}
    <path d="M18.5 11 C 19.5 9, 21.5 8, 22.5 9.5" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* 심플 플랫 몸통 (머리, 가슴, 배) - 검은색 채우기 + 흰색 테두리 */}
    {/* 배 */}
    <ellipse cx="7" cy="12.5" rx="3.8" ry="2.6" fill="#111827" stroke="#f8fafc" strokeWidth="2" />
    {/* 가슴 */}
    <ellipse cx="12.5" cy="12.5" rx="2" ry="1.6" fill="#111827" stroke="#f8fafc" strokeWidth="2" />
    {/* 머리 */}
    <circle cx="17.5" cy="12" r="2.2" fill="#111827" stroke="#f8fafc" strokeWidth="2" />
  </svg>
); 

// 초기 목업 데이터 (이메일은 내부 처리용으로 이름 기반 자동 생성)
const INITIAL_MOCK_PROFILES = [
  { id: 'user-1', email: '김철수@stockus.com', display_name: '김철수', password: '1234' },
  { id: 'user-2', email: '이영희@stockus.com', display_name: '이영희', password: '1234' },
  { id: 'user-3', email: '박민수@stockus.com', display_name: '박민수', password: '1234' }
];

const INITIAL_MOCK_PORTFOLIOS = [
  { id: 'p-1', user_id: 'user-1', ticker: 'AAPL', stock_name: 'Apple Inc.', shares_count: 15, average_buy_price: 195.50, currency: 'USD' },
  { id: 'p-2', user_id: 'user-1', ticker: '005930.KS', stock_name: '삼성전자', shares_count: 80, average_buy_price: 74500, currency: 'KRW' },
  { id: 'p-3', user_id: 'user-2', ticker: 'NVDA', stock_name: 'NVIDIA', shares_count: 35, average_buy_price: 112.80, currency: 'USD' },
  { id: 'p-4', user_id: 'user-2', ticker: 'TSLA', stock_name: 'Tesla', shares_count: 12, average_buy_price: 215.00, currency: 'USD' },
  { id: 'p-5', user_id: 'user-3', ticker: 'MSFT', stock_name: 'Microsoft', shares_count: 10, average_buy_price: 415.20, currency: 'USD' },
  { id: 'p-6', user_id: 'user-3', ticker: '000660.KS', stock_name: 'SK하이닉스', shares_count: 25, average_buy_price: 168000, currency: 'KRW' }
];

interface Profile {
  id: string;
  email: string;
  display_name: string;
  password?: string; // 목업용
}

interface PortfolioItem {
  id: string;
  user_id: string;
  ticker: string;
  stock_name: string;
  shares_count: number;
  average_buy_price: number;
  currency: 'KRW' | 'USD';
}

interface StockPriceInfo {
  ticker: string;
  price: number;
  changePercent: number;
  name: string;
  currency: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid var(--border-color)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        color: '#ffffff',
        fontSize: '0.8rem'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{payload[0].name}</div>
        <div style={{ color: '#94a3b8' }}>
          평가금액: <span style={{ color: '#ffffff', fontWeight: 500 }}>₩{payload[0].value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manage'>('dashboard');
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 데이터 상태
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [stockPrices, setStockPrices] = useState<Record<string, StockPriceInfo>>({});
  
  // 로그인한 유저 상태
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all'); // 대시보드 필터용
  
  // 인증 관련 UI 상태 (이름과 비밀번호만 사용)
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // 실시간 환율 상태 (기본값 1380원)
  const [exchangeRate, setExchangeRate] = useState(1380);
  
  // 정렬 관련 상태
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // 주식 입력 폼 상태
  const [formTicker, setFormTicker] = useState('');
  const [formStockName, setFormStockName] = useState('');
  const [formSharesCount, setFormSharesCount] = useState('');
  const [formBuyPrice, setFormBuyPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState<'KRW' | 'USD'>('USD');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 1. 초기 데이터 마운트 및 로컬스토리지 연동 (Mock 모드 전용)
  useEffect(() => {
    setIsMounted(true);
    
    if (isMockMode) {
      const storedProfilesRaw = localStorage.getItem('mock_profiles');
      const storedPortfoliosRaw = localStorage.getItem('mock_portfolios');
      
      let needsReset = false;
      
      // 로컬 스토리지에 데이터가 없거나, 패스워드가 없는 이전 버전 데이터인 경우 강제 리셋
      if (storedProfilesRaw) {
        try {
          const parsed = JSON.parse(storedProfilesRaw);
          if (parsed.length === 0 || !parsed[0].password) {
            needsReset = true;
          }
        } catch (e) {
          needsReset = true;
        }
      } else {
        needsReset = true;
      }
      
      if (needsReset) {
        localStorage.setItem('mock_profiles', JSON.stringify(INITIAL_MOCK_PROFILES));
        localStorage.setItem('mock_portfolios', JSON.stringify(INITIAL_MOCK_PORTFOLIOS));
      }
      
      const finalProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const finalPortfolios = JSON.parse(localStorage.getItem('mock_portfolios') || '[]');
      
      setProfiles(finalProfiles);
      setPortfolios(finalPortfolios);
      
      // 기본적으로 로그아웃 상태로 기동
      setCurrentUser(null);
      setLoading(false);
    } else {
      checkSupabaseSession();
    }
  }, []);

  const checkSupabaseSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setCurrentUser({
            id: profile.id,
            email: profile.email,
            display_name: profile.display_name || profile.email.split('@')[0]
          });
        }
      }
      await loadSupabaseData();
    } catch (err) {
      console.error('Supabase session load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSupabaseData = async () => {
    try {
      // 2배 속도 개선: Profiles와 Portfolios를 동시에 병렬로 로드
      const [profilesRes, portfoliosRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('portfolios').select('*')
      ]);
        
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (portfoliosRes.data) setPortfolios(portfoliosRes.data);
    } catch (err) {
      console.error('Error loading Supabase data:', err);
    }
  };

  // 실시간 주식 가격 패치
  const fetchStockPrices = useCallback(async (tickersList: string[]) => {
    if (tickersList.length === 0) return;
    
    setRefreshing(true);
    try {
      const tickersString = Array.from(new Set(tickersList)).join(',');
      const res = await fetch(`/api/stock?tickers=${tickersString}`);
      const result = await res.json();
      
      if (result.data) {
        const priceMap: Record<string, StockPriceInfo> = {};
        result.data.forEach((item: StockPriceInfo) => {
          priceMap[item.ticker] = item;
        });
        setStockPrices(prev => ({ ...prev, ...priceMap }));
      }
      if (result.exchangeRate) {
        setExchangeRate(result.exchangeRate);
      }
    } catch (error) {
      console.error('Failed to fetch stock prices:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (portfolios.length > 0) {
      const tickers = portfolios.map(p => p.ticker);
      fetchStockPrices(tickers);
    }
  }, [portfolios, fetchStockPrices]);

  useEffect(() => {
    if (portfolios.length === 0) return;
    const interval = setInterval(() => {
      const tickers = portfolios.map(p => p.ticker);
      fetchStockPrices(tickers);
    }, 60000); // 60,000ms = 1분
    return () => clearInterval(interval);
  }, [portfolios, fetchStockPrices]);

  // 주식 포트폴리오 저장
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('로그인이 필요한 기능입니다.');
      setAuthModalOpen(true);
      return;
    }

    if (!formTicker || !formStockName || !formSharesCount || !formBuyPrice) {
      alert('모든 정보를 정확히 입력해주세요.');
      return;
    }

    const sharesCountNum = parseFloat(formSharesCount);
    const buyPriceNum = parseFloat(formBuyPrice);
    const formattedTicker = formTicker.trim().toUpperCase();

    if (isNaN(sharesCountNum) || sharesCountNum <= 0 || isNaN(buyPriceNum) || buyPriceNum <= 0) {
      alert('수량과 매수단가는 0보다 커야 합니다.');
      return;
    }

    if (isMockMode) {
      const storedPortfolios = JSON.parse(localStorage.getItem('mock_portfolios') || '[]');
      
      if (editingId) {
        const updated = storedPortfolios.map((item: PortfolioItem) => 
          item.id === editingId 
            ? { ...item, ticker: formattedTicker, stock_name: formStockName, shares_count: sharesCountNum, average_buy_price: buyPriceNum, currency: formCurrency }
            : item
        );
        localStorage.setItem('mock_portfolios', JSON.stringify(updated));
        setPortfolios(updated);
        setEditingId(null);
      } else {
        const newItem: PortfolioItem = {
          id: `p-${Date.now()}`,
          user_id: currentUser.id,
          ticker: formattedTicker,
          stock_name: formStockName,
          shares_count: sharesCountNum,
          average_buy_price: buyPriceNum,
          currency: formCurrency
        };
        const updated = [...storedPortfolios, newItem];
        localStorage.setItem('mock_portfolios', JSON.stringify(updated));
        setPortfolios(updated);
      }
      resetForm();
    } else {
      try {
        if (editingId) {
          const { error } = await supabase
            .from('portfolios')
            .update({
              ticker: formattedTicker,
              stock_name: formStockName,
              shares_count: sharesCountNum,
              average_buy_price: buyPriceNum,
              currency: formCurrency,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingId);
            
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('portfolios')
            .insert({
              user_id: currentUser.id,
              ticker: formattedTicker,
              stock_name: formStockName,
              shares_count: sharesCountNum,
              average_buy_price: buyPriceNum,
              currency: formCurrency
            });
            
          if (error) throw error;
        }
        resetForm();
        await loadSupabaseData();
      } catch (err: any) {
        alert(`저장 실패: ${err.message}`);
      }
    }
  };

  const handleDeleteStock = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    if (isMockMode) {
      const storedPortfolios = JSON.parse(localStorage.getItem('mock_portfolios') || '[]');
      const updated = storedPortfolios.filter((item: PortfolioItem) => item.id !== id);
      localStorage.setItem('mock_portfolios', JSON.stringify(updated));
      setPortfolios(updated);
      if (editingId === id) resetForm();
    } else {
      try {
        const { error } = await supabase
          .from('portfolios')
          .delete()
          .eq('id', id);
        if (error) throw error;
        await loadSupabaseData();
        if (editingId === id) resetForm();
      } catch (err: any) {
        alert(`삭제 실패: ${err.message}`);
      }
    }
  };

  const handleEditStock = (item: PortfolioItem) => {
    setEditingId(item.id);
    setFormTicker(item.ticker);
    setFormStockName(item.stock_name);
    setFormSharesCount(item.shares_count.toString());
    setFormBuyPrice(item.average_buy_price.toString());
    setFormCurrency(item.currency);
  };

  const resetForm = () => {
    setFormTicker('');
    setFormStockName('');
    setFormSharesCount('');
    setFormBuyPrice('');
    setFormCurrency('USD');
    setEditingId(null);
  };

  // 친구 목록 클릭 시 이름 채우고 비밀번호 창 오픈
  const handleSwitchMockUserClick = (userId: string) => {
    const user = profiles.find(p => p.id === userId);
    if (user) {
      setAuthDisplayName(user.display_name);
      setAuthPassword('');
      setIsRegisterMode(false);
      setAuthModalOpen(true);
    }
  };

  // Mock 모드 새 친구 추가
  const handleAddMockUser = () => {
    const newName = prompt('추가할 친구의 이름을 입력하세요:');
    if (!newName) return;
    const newPass = prompt(`'${newName}'님의 비밀번호를 설정하세요:`, '1234');
    if (!newPass) return;
    
    const newId = `user-${Date.now()}`;
    const newUser = {
      id: newId,
      email: `${newName}@stockus.com`,
      display_name: newName,
      password: newPass
    };
    
    const updatedProfiles = [...profiles, newUser];
    localStorage.setItem('mock_profiles', JSON.stringify(updatedProfiles));
    setProfiles(updatedProfiles);
    
    // 추가 후 로그인 모달 자동 활성화
    setAuthDisplayName(newUser.display_name);
    setAuthPassword('');
    setIsRegisterMode(false);
    setAuthModalOpen(true);
  };

  // 이름 + 비밀번호 로그인/회원가입 처리
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authDisplayName || !authPassword) {
      alert('이름과 비밀번호를 입력해주세요.');
      return;
    }

    // 한글 이름 등 특수문자 입력 시 Supabase 이메일 유효성 통과를 위한 영숫자 변환 헬퍼
    const getSafeEmail = (name: string) => {
      let code = '';
      const trimmed = name.trim();
      for (let i = 0; i < trimmed.length; i++) {
        code += trimmed.charCodeAt(i).toString(36);
      }
      return `user_${code}@stockus.com`;
    };

    const virtualEmail = getSafeEmail(authDisplayName);

    if (authPassword.length < 4) {
      alert('비밀번호는 최소 4글자 이상이어야 합니다.');
      return;
    }

    if (isMockMode) {
      const storedProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      
      if (isRegisterMode) {
        if (storedProfiles.find((p: any) => p.display_name === authDisplayName.trim())) {
          alert('이미 존재하는 이름입니다.');
          return;
        }
        const newId = `user-${Date.now()}`;
        const newProfile = {
          id: newId,
          email: virtualEmail,
          display_name: authDisplayName.trim(),
          password: authPassword
        };
        const updated = [...storedProfiles, newProfile];
        localStorage.setItem('mock_profiles', JSON.stringify(updated));
        setProfiles(updated);
        setCurrentUser(newProfile);
        alert(`'${authDisplayName}'님으로 회원가입 및 로그인되었습니다.`);
      } else {
        const found = storedProfiles.find(
          (p: any) => p.display_name === authDisplayName.trim() && p.password === authPassword
        );
        if (found) {
          setCurrentUser(found);
        } else {
          alert('등록된 이름이 없거나 비밀번호가 일치하지 않습니다.');
          return;
        }
      }
      setAuthModalOpen(false);
      setAuthPassword('');
    } else {
      try {
        // Supabase Auth의 최소 6자 비밀번호 강제 정책을 우회하기 위해 내부적으로 솔트 접미사 추가
        const securePassword = authPassword.length < 6 ? `${authPassword}_gaemi` : authPassword;

        if (isRegisterMode) {
          const { error } = await supabase.auth.signUp({
            email: virtualEmail,
            password: securePassword,
            options: {
              data: {
                display_name: authDisplayName.trim()
              }
            }
          });
          if (error) throw error;
          alert(`'${authDisplayName}'님 계정이 등록되었습니다.`);
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: virtualEmail,
            password: securePassword
          });
          if (error) throw error;
        }
        setAuthModalOpen(false);
        setAuthPassword('');
        await checkSupabaseSession();
      } catch (err: any) {
        alert(`인증 오류: ${err.message}`);
      }
    }
  };

  const handleLogout = async () => {
    if (isMockMode) {
      setCurrentUser(null);
    } else {
      await supabase.auth.signOut();
      setCurrentUser(null);
      await loadSupabaseData();
    }
    setActiveTab('dashboard');
  };

  // 자산 평가 및 보유 비중 계산 로직
  const getCalculatedStocks = () => {
    const userTotals: Record<string, number> = {};
    
    const rawEvals = portfolios.map(item => {
      const priceInfo = stockPrices[item.ticker];
      const currentPrice = priceInfo ? priceInfo.price : item.average_buy_price;
      const totalCurrentVal = currentPrice * item.shares_count;
      const currentValKRW = item.currency === 'USD' ? totalCurrentVal * exchangeRate : totalCurrentVal;
      
      userTotals[item.user_id] = (userTotals[item.user_id] || 0) + currentValKRW;
      
      return {
        ...item,
        currentPrice,
        currentValKRW
      };
    });

    return rawEvals.map(item => {
      const priceInfo = stockPrices[item.ticker];
      const changePercent = priceInfo ? priceInfo.changePercent : 0;
      
      const totalBuyVal = item.average_buy_price * item.shares_count;
      const totalCurrentVal = item.currentPrice * item.shares_count;
      const profitLoss = totalCurrentVal - totalBuyVal;
      const profitLossRatio = totalBuyVal > 0 ? (profitLoss / totalBuyVal) * 100 : 0;
      
      const buyValKRW = item.currency === 'USD' ? totalBuyVal * exchangeRate : totalBuyVal;
      const profitLossKRW = item.currentValKRW - buyValKRW;

      const owner = profiles.find(p => p.id === item.user_id)?.display_name || '알수없음';
      
      const userTotalAsset = userTotals[item.user_id] || 1;
      const portfolioRatio = (item.currentValKRW / userTotalAsset) * 100;

      const isOwner = currentUser !== null && currentUser.id === item.user_id;

      return {
        ...item,
        owner,
        changePercent,
        totalBuyVal,
        totalCurrentVal,
        profitLoss,
        profitLossRatio,
        buyValKRW,
        profitLossKRW,
        portfolioRatio,
        isOwner
      };
    });
  };

  const calculatedStocks = getCalculatedStocks();

  const filteredCalculatedStocks = selectedUserFilter === 'all'
    ? calculatedStocks
    : calculatedStocks.filter(s => s.user_id === selectedUserFilter);

  // 정렬 핸들러
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null); // 3번째 클릭 시 정렬 해제
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // 정렬 적용된 주식 목록
  const sortedStocks = useMemo(() => {
    const stocks = [...filteredCalculatedStocks];
    if (!sortColumn) return stocks;

    return stocks.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortColumn === 'owner') {
        aVal = a.owner;
        bVal = b.owner;
      } else if (sortColumn === 'ticker') {
        aVal = a.ticker;
        bVal = b.ticker;
      } else if (sortColumn === 'currentPrice') {
        aVal = a.currentPrice;
        bVal = b.currentPrice;
      } else if (sortColumn === 'changePercent') {
        aVal = a.changePercent;
        bVal = b.changePercent;
      } else if (sortColumn === 'profitLossRatio') {
        aVal = a.profitLossRatio;
        bVal = b.profitLossRatio;
      } else if (sortColumn === 'portfolioRatio') {
        aVal = a.portfolioRatio;
        bVal = b.portfolioRatio;
      } else {
        return 0;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCalculatedStocks, sortColumn, sortDirection]);

  // 정렬 화살표 아이콘 렌더링 함수
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown size={12} style={{ marginLeft: '0.25rem', opacity: 0.35, verticalAlign: 'middle' }} />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: '0.25rem', color: 'var(--primary)', verticalAlign: 'middle' }} />
      : <ChevronDown size={12} style={{ marginLeft: '0.25rem', color: 'var(--primary)', verticalAlign: 'middle' }} />;
  };

  const isFilterTargetMe = currentUser !== null && selectedUserFilter === currentUser.id;
  const showSummaryStats = isFilterTargetMe; 

  const totalBuyKRW = filteredCalculatedStocks.reduce((sum, item) => sum + item.buyValKRW, 0);
  const totalCurrentKRW = filteredCalculatedStocks.reduce((sum, item) => sum + item.currentValKRW, 0);
  const totalProfitLossKRW = totalCurrentKRW - totalBuyKRW;
  const totalProfitLossRatio = totalBuyKRW > 0 ? (totalProfitLossKRW / totalBuyKRW) * 100 : 0;

  const chartData = Object.values(
    filteredCalculatedStocks.reduce<Record<string, { name: string; value: number }>>((acc, stock) => {
      const key = stock.ticker;
      if (!acc[key]) {
        acc[key] = { name: stock.stock_name || stock.ticker, value: 0 };
      }
      acc[key].value += stock.currentValKRW;
      return acc;
    }, {})
  ).map(item => ({
    name: item.name,
    value: parseFloat(item.value.toFixed(0))
  }));

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];

  if (!isMounted) return null;

  return (
    <>
      {/* 1. 상단 네비게이션 헤더 */}
      <header className="header">
        <div className="logo-section">
          <AntIcon className="logo-icon" />
          <h1 className="logo-title">GaemiStock Dashboard</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* 탭 네비게이션 */}
          <div className="tabs-nav">
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={16} />
              메인 대시보드
            </button>
            <button 
              className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('manage')}
            >
              <Settings size={16} />
              내 주식 관리
            </button>
          </div>

          {/* 인증 상태 및 로그인 */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                 <div className="stock-avatar" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem', backgroundColor: getUserAvatarColor(currentUser.display_name) }}>
                  {currentUser.display_name.charAt(0)}
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{currentUser.display_name}님</span>
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                <LogOut size={12} />
                로그아웃
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setAuthDisplayName('');
                setAuthPassword('');
                setIsRegisterMode(false);
                setAuthModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              <LogIn size={14} />
              로그인
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <>
          {/* 2. 대시보드 메인 화면 */}
          {activeTab === 'dashboard' && (
            <div>
              {/* 요약 현황 정보 */}
              <div className="summary-bar">
                <div className="stat-item">
                  <div className="stat-label">선택 포트폴리오</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                    {selectedUserFilter === 'all' ? '그룹 전체보기' : `${profiles.find(p => p.id === selectedUserFilter)?.display_name || ''}`}
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">내 총 매수금액</div>
                  <div className="stat-value">
                    {showSummaryStats ? (
                      `₩${totalBuyKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    ) : (
                      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Lock size={14} /> 로그인(본인선택) 필요
                      </span>
                    )}
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">내 평가 자산</div>
                  <div className="stat-value" style={{ color: showSummaryStats && totalProfitLossKRW >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                    {showSummaryStats ? (
                      `₩${totalCurrentKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    ) : (
                      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Lock size={14} /> 로그인(본인선택) 필요
                      </span>
                    )}
                  </div>
                  {showSummaryStats && (
                    <div className="stat-diff" style={{ color: totalProfitLossKRW >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                      {totalProfitLossRatio >= 0 ? '▲' : '▼'} {Math.abs(totalProfitLossRatio).toFixed(2)}% ({totalProfitLossKRW >= 0 ? '+' : ''}₩{totalProfitLossKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </div>
                  )}
                </div>

                <div className="stat-item" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textAlign: 'center' }}>
                    시세 출처: 네이버 금융 API
                  </div>
                  <button 
                    onClick={() => fetchStockPrices(portfolios.map(p => p.ticker))}
                    className="btn btn-secondary"
                    disabled={refreshing}
                    style={{ width: '100%', gap: '0.5rem' }}
                  >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    시세 동기화
                  </button>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.4rem' }}>
                    실시간 시세가 1분마다 자동 동기화됩니다
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.2rem' }}>
                    적용 환율: ₩{exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 2 })} (6시간 갱신)
                  </div>
                </div>
              </div>

              {/* 2단 메인 레이아웃 */}
              <div className="dashboard-grid">
                {/* 왼쪽: 주식 리스트 테이블 */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 className="card-title">
                      <LayoutDashboard size={20} style={{ color: 'var(--secondary)' }} />
                      실시간 보유 주식 현황
                    </h2>
                    
                    {/* 친구 필터 칩 */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        className={`tab-btn ${selectedUserFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedUserFilter('all')}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        전체보기
                      </button>
                      {profiles.map(user => (
                        <button
                          key={user.id}
                          className={`tab-btn ${selectedUserFilter === user.id ? 'active' : ''}`}
                          onClick={() => setSelectedUserFilter(user.id)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          {user.display_name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="stock-table-wrapper">
                    {filteredCalculatedStocks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                        보유 중인 주식이 없습니다.
                      </div>
                    ) : (
                      <table className="stock-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('owner')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              보유자 {getSortIcon('owner')}
                            </th>
                            <th onClick={() => handleSort('ticker')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              종목 (티커) {getSortIcon('ticker')}
                            </th>
                            <th onClick={() => handleSort('currentPrice')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              현재가 {getSortIcon('currentPrice')}
                            </th>
                            <th onClick={() => handleSort('changePercent')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              당일 등락률 {getSortIcon('changePercent')}
                            </th>
                            <th onClick={() => handleSort('profitLossRatio')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              수익률 {getSortIcon('profitLossRatio')}
                            </th>
                            <th onClick={() => handleSort('portfolioRatio')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              보유 비중 (%) {getSortIcon('portfolioRatio')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStocks.map((stock) => (
                            <tr key={stock.id}>
                              <td>
                                <div className="owner-cell">
                                  <div className="stock-avatar" style={{ width: '1.8rem', height: '1.8rem', fontSize: '0.75rem', backgroundColor: getUserAvatarColor(stock.owner) }}>
                                    {stock.owner.charAt(0)}
                                  </div>
                                  <span>{stock.owner}</span>
                                </div>
                              </td>
                              <td>
                                <div className="stock-info">
                                  <span className="stock-ticker">{stock.ticker}</span>
                                  <span className="stock-name">{stock.stock_name}</span>
                                </div>
                              </td>
                              <td>
                                <span className="stock-price">
                                  {stock.currency === 'USD' ? '$' : '₩'}
                                  {stock.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td>
                                <span className={`stock-badge ${stock.changePercent >= 0 ? 'up' : 'down'}`}>
                                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                </span>
                              </td>
                              <td>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: stock.profitLoss >= 0 ? 'var(--stock-up)' : 'var(--stock-down)'
                                }}>
                                  {stock.profitLoss >= 0 ? '+' : ''}{stock.profitLossRatio.toFixed(2)}%
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ 
                                    width: '60px', 
                                    height: '6px', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '3px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{ 
                                      width: `${stock.portfolioRatio}%`, 
                                      height: '100%', 
                                      background: 'var(--primary)' 
                                    }} />
                                  </div>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                    {stock.portfolioRatio.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 포트폴리오 비중 차트 및 친구 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* 차트 */}
                  <div className="card">
                    <h2 className="card-title">종목별 자산 보유 비중</h2>
                    {chartData.length === 0 ? (
                      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        차트 데이터가 없습니다.
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              iconSize={10} 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* 친구 관리 / 선택 사이드바 */}
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h2 className="card-title" style={{ margin: 0 }}>
                        <User size={18} style={{ color: 'var(--secondary)' }} />
                        참여 친구 목록 ({profiles.length}명)
                      </h2>
                      {isMockMode && (
                        <button 
                          onClick={handleAddMockUser}
                          className="btn btn-secondary" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          친구 추가
                        </button>
                      )}
                    </div>
                    <div className="user-list">
                      {profiles.map((user) => (
                        <div 
                          key={user.id} 
                          className={`user-item ${currentUser?.id === user.id ? 'active' : ''}`}
                          onClick={() => isMockMode && handleSwitchMockUserClick(user.id)}
                          style={{ cursor: isMockMode ? 'pointer' : 'default' }}
                          title={isMockMode ? '클릭 시 해당 유저로 로그인 역할을 변경합니다 (비밀번호 확인 필요)' : ''}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div className="stock-avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.8rem', backgroundColor: getUserAvatarColor(user.display_name) }}>
                              {user.display_name.charAt(0)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.display_name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                총 {portfolios.filter(p => p.user_id === user.id).length}개 종목 보유
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right' }}>
                            {currentUser?.id === user.id && (
                              <>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                  ₩{calculatedStocks
                                    .filter(s => s.user_id === user.id)
                                    .reduce((sum, s) => sum + s.currentValKRW, 0)
                                    .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600 }}>
                                  (현재 본인)
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. 보유 주식 관리 화면 (수정 탭) */}
          {activeTab === 'manage' && (
            <div className="dashboard-grid">
              {/* 왼쪽: 주식 추가/수정 폼 */}
              <div className="card">
                <h2 className="card-title">
                  <Plus size={20} style={{ color: 'var(--primary)' }} />
                  {editingId ? '보유 주식 수정하기' : '새로운 보유 주식 추가'}
                </h2>
                
                {!currentUser ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
                      주식을 등록하려면 먼저 로그인이 필요합니다.
                    </p>
                    <button 
                      onClick={() => setAuthModalOpen(true)}
                      className="btn btn-primary"
                    >
                      로그인 하기
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveStock}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label htmlFor="ticker">주식 티커 (Symbol)</label>
                        <input 
                          id="ticker"
                          type="text" 
                          className="form-control" 
                          placeholder="예: AAPL 또는 005930.KS"
                          value={formTicker}
                          onChange={(e) => setFormTicker(e.target.value)}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          * 한국 주식은 종목코드 뒤에 .KS(코스피) 또는 .KQ(코스닥)를 붙여야 합니다.
                        </span>
                      </div>

                      <div className="form-group">
                        <label htmlFor="stockName">한글명/영문명 (표시 이름)</label>
                        <input 
                          id="stockName"
                          type="text" 
                          className="form-control" 
                          placeholder="예: 애플 또는 삼성전자"
                          value={formStockName}
                          onChange={(e) => setFormStockName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <div className="form-group">
                        <label htmlFor="shares">보유 수량 (주) [안전 비공개]</label>
                        <input 
                          id="shares"
                          type="number" 
                          step="any"
                          className="form-control" 
                          placeholder="수량"
                          value={formSharesCount}
                          onChange={(e) => setFormSharesCount(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="buyPrice">평균 매수 단가</label>
                        <input 
                          id="buyPrice"
                          type="number" 
                          step="any"
                          className="form-control" 
                          placeholder="단가"
                          value={formBuyPrice}
                          onChange={(e) => setFormBuyPrice(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="currency">거래 통화</label>
                        <select 
                          id="currency"
                          className="form-control"
                          value={formCurrency}
                          onChange={(e) => setFormCurrency(e.target.value as 'KRW' | 'USD')}
                        >
                          <option value="USD">USD ($)</option>
                          <option value="KRW">KRW (₩)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        {editingId ? '수정사항 저장' : '내 포트폴리오에 추가'}
                      </button>
                      {editingId && (
                        <button type="button" onClick={resetForm} className="btn btn-secondary">
                          취소
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* 오른쪽: 내가 현재 등록한 주식 관리 리스트 */}
              <div className="card">
                <h2 className="card-title">
                  내가 보유 중인 주식 리스트
                  {currentUser && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      ({currentUser.display_name} 님 등록 항목 - 🔒 본인에게만 노출)
                    </span>
                  )}
                </h2>

                {!currentUser ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                    로그인하시면 등록된 자산을 보고 편집할 수 있습니다.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {portfolios.filter(item => item.user_id === currentUser.id).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                        등록된 주식이 없습니다. 왼쪽 폼에서 첫 주식을 추가해보세요!
                      </div>
                    ) : (
                      portfolios
                        .filter(item => item.user_id === currentUser.id)
                        .map(item => (
                          <div 
                            key={item.id} 
                            style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '0.75rem',
                              padding: '1rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.ticker}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.stock_name}</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {item.shares_count}주 | 평단 {item.currency === 'USD' ? '$' : '₩'}{item.average_buy_price.toLocaleString()}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => handleEditStock(item)}
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                수정
                              </button>
                              <button 
                                onClick={() => handleDeleteStock(item.id)}
                                className="btn btn-danger" 
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. 인증 팝업 모달 (이름과 비밀번호만 받도록 단순화) */}
      {authModalOpen && (
        <div className="modal-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="auth-header">
              <h3 className="auth-title">{isRegisterMode ? '친구 등록 (가입)' : '보안 로그인'}</h3>
              <p className="auth-desc">대시보드 권한 획득을 위해 정보를 입력하세요.</p>
            </div>

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label htmlFor="authDisplayName">이름 (아이디)</label>
                <input 
                  id="authDisplayName"
                  type="text" 
                  className="form-control" 
                  placeholder="본인 이름을 입력하세요 (예: 김철수)"
                  value={authDisplayName}
                  onChange={(e) => setAuthDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="authPassword">비밀번호</label>
                <input 
                  id="authPassword"
                  type="password" 
                  className="form-control" 
                  placeholder="비밀번호를 입력하세요"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />

              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {isRegisterMode ? '친구 등록 완료' : '보안 로그인'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {isRegisterMode ? '이미 등록되어 있으신가요?' : '새로운 친구로 등록하시나요?'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--primary)', 
                    fontWeight: 600, 
                    marginLeft: '0.35rem', 
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  {isRegisterMode ? '로그인하기' : '친구 등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
