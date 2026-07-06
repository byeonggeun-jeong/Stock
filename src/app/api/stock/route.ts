import { NextResponse } from 'next/server';

// 2026년 7월 실제 주가 수준의 더미 시세 데이터 (네트워크 실패 시 fallback용)
const MOCK_STOCK_PRICES: Record<string, { price: number; changePercent: number; name: string; currency: string }> = {
  'AAPL': { price: 294.38, changePercent: 1.73, name: '애플', currency: 'USD' },
  'TSLA': { price: 425.30, changePercent: 1.12, name: '테슬라', currency: 'USD' },
  'NVDA': { price: 197.58, changePercent: -1.25, name: '엔비디아', currency: 'USD' },
  'MSFT': { price: 440.10, changePercent: 0.35, name: '마이크로소프트', currency: 'USD' },
  '005930': { price: 286000, changePercent: 9.06, name: '삼성전자', currency: 'KRW' },
  '000660': { price: 2187000, changePercent: 14.57, name: 'SK하이닉스', currency: 'KRW' },
  '035420': { price: 162000, changePercent: -0.90, name: 'NAVER', currency: 'KRW' },
  '035720': { price: 41200, changePercent: -1.20, name: '카카오', currency: 'KRW' }
};

// 단일 종목 실시간 시세를 긁어오는 하이브리드 네이버 금융 API 함수
async function fetchStockInfoFromNaver(ticker: string) {
  const cleanTicker = ticker.trim().toUpperCase();
  
  // 국내 주식은 뒤에 .KS, .KQ 등이 붙을 수 있으므로 정리 (예: 005930.KS -> 005930)
  const numericTicker = cleanTicker.replace(/\.(KS|KQ)$/, '');
  const isKorean = /^\d{6}/.test(numericTicker); // 6자리 숫자 여부 판별

  if (isKorean) {
    // 1. 국내 주식 실시간 조회 (Naver Polling API)
    const code = numericTicker.substring(0, 6);
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
    
    try {
      const res = await fetch(url, {
        next: { revalidate: 60 } // 60초 캐싱 (동기화 주기에 일치)
      });
      const buffer = await res.arrayBuffer();
      // 네이버 폴링 API는 EUC-KR 인코딩이므로 TextDecoder로 한글 깨짐 우회
      const text = new TextDecoder('euc-kr').decode(buffer);
      const data = JSON.parse(text);
      
      const stockData = data.result?.areas?.[0]?.datas?.[0];
      if (!stockData) throw new Error("No polling data found");

      const rawCr = stockData.cr;
      const rf = stockData.rf;
      const changePercent = (rf === '4' || rf === '5') ? -rawCr : rawCr;

      return {
        ticker: cleanTicker,
        price: stockData.nv,
        changePercent,
        name: stockData.nm,
        currency: 'KRW'
      };
    } catch (e: any) {
      console.error(`Naver Polling API Error for ${cleanTicker}:`, e.message);
      
      // Fallback
      const mockInfo = MOCK_STOCK_PRICES[code] || {
        price: 70000,
        changePercent: 0.0,
        name: cleanTicker,
        currency: 'KRW'
      };
      return {
        ticker: cleanTicker,
        price: mockInfo.price,
        changePercent: mockInfo.changePercent,
        name: mockInfo.name,
        currency: 'KRW',
        isFallback: true
      };
    }
  } else {
    // 2. 해외 주식 실시간 조회 (Naver Mobile Basic API - 병렬 3배속 튜닝)
    const baseTicker = cleanTicker.replace(/\.(O|N)$/, '');
    const suffixes = ['.O', '.N', '']; // 스캔할 접미사 리스트

    try {
      const promises = suffixes.map(async (suffix) => {
        const targetTicker = `${baseTicker}${suffix}`;
        const url = `https://api.stock.naver.com/stock/${targetTicker}/basic`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            "Referer": "https://m.stock.naver.com/"
          },
          next: { revalidate: 60 } // 60초 캐싱 (동기화 주기에 일치)
        });
        const data = await res.json();
        if (data.stockName) {
          return data;
        }
        throw new Error(`Suffix ${suffix} not found`);
      });

      // 가장 빠른 성공 응답 채택
      const successfulData = await Promise.any(promises);

      const cleanPrice = parseFloat(successfulData.closePrice.replace(/,/g, ''));
      let changeRatio = parseFloat(successfulData.fluctuationsRatio || '0');
      const compCode = successfulData.compareToPreviousPrice?.code || '';
      if ((compCode === '4' || compCode === '5') && changeRatio > 0) {
        changeRatio = -changeRatio;
      }

      const currencyCode = typeof successfulData.currencyType === 'object' && successfulData.currencyType !== null 
        ? successfulData.currencyType.code || 'USD' 
        : successfulData.currencyType || 'USD';

      return {
        ticker: cleanTicker,
        price: cleanPrice,
        changePercent: changeRatio,
        name: successfulData.stockName,
        currency: currencyCode
      };
    } catch (e) {
      // 모든 병렬 시도 실패 시 아래 fallback으로 흐름
    }

    // 모든 시도 실패 시 Fallback 더미 데이터 반환
    console.error(`Naver Basic API US Stock Error for ${cleanTicker}: All suffixes failed`);
    const mockInfo = MOCK_STOCK_PRICES[cleanTicker] || {
      price: 150.0,
      changePercent: 0.0,
      name: cleanTicker,
      currency: 'USD'
    };
    return {
      ticker: cleanTicker,
      price: mockInfo.price,
      changePercent: mockInfo.changePercent,
      name: mockInfo.name,
      currency: mockInfo.currency,
      isFallback: true
    };
  }
}

// 6시간 주기 캐싱이 반영된 원/달러 실시간 고시 환율 fetch 함수
async function fetchExchangeRate() {
  const url = "https://api.stock.naver.com/marketindex/exchange/FX_USDKRW";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://m.stock.naver.com/"
      },
      next: { revalidate: 21600 } // 6시간 캐싱 (21600초)
    });
    const data = await res.json();
    const rateString = data.exchangeInfo.closePrice;
    return parseFloat(rateString.replace(/,/g, ''));
  } catch (e) {
    console.error("Failed to fetch exchange rate from Naver, fallback to 1380:", e);
    return 1380;
  }
}

// --- 코인(Upbit) API 지원 기능 추가 ---

const COIN_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'SHIB', 'TRX', 'LINK', 'NEAR', 'MATIC', 'BCH', 'LTC', 'ETC', 'APT'
]);

const COIN_FALLBACK_NAMES: Record<string, string> = {
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-SOL': '솔라나',
  'KRW-XRP': '리플',
  'KRW-ADA': '에이다',
  'KRW-DOGE': '도지코인',
  'KRW-DOT': '폴카닷',
  'KRW-AVAX': '아발란체',
  'KRW-SHIB': '시바이누',
  'KRW-TRX': '트론',
  'KRW-LINK': '체인링크',
  'KRW-NEAR': '니어프로토콜',
  'KRW-BCH': '비트코인캐시',
  'KRW-LTC': '라이트코인',
  'KRW-ETC': '이더리움클래식',
  'KRW-APT': '앱토스'
};

function isCoin(ticker: string): boolean {
  const clean = ticker.toUpperCase();
  return clean.startsWith('KRW-') || COIN_SYMBOLS.has(clean);
}

function getUpbitMarketId(ticker: string): string {
  const clean = ticker.toUpperCase();
  if (clean.startsWith('KRW-')) return clean;
  return `KRW-${clean}`;
}

let coinNameMap: Record<string, { korean: string; english: string }> = {};
let lastMarketFetch = 0;

async function fetchCoinNames(): Promise<Record<string, { korean: string; english: string }>> {
  const now = Date.now();
  if (Object.keys(coinNameMap).length > 0 && now - lastMarketFetch < 3600000 * 24) {
    return coinNameMap;
  }
  
  try {
    const res = await fetch('https://api.upbit.com/v1/market/all');
    const markets = await res.json();
    const newMap: Record<string, { korean: string; english: string }> = {};
    if (Array.isArray(markets)) {
      markets.forEach(m => {
        newMap[m.market] = { korean: m.korean_name, english: m.english_name };
      });
      coinNameMap = newMap;
      lastMarketFetch = now;
    }
  } catch (e) {
    console.error('Failed to fetch coin names from Upbit:', e);
  }
  return coinNameMap;
}

async function fetchCoinInfoFromUpbit(ticker: string) {
  const cleanTicker = ticker.trim().toUpperCase();
  const marketId = getUpbitMarketId(cleanTicker);

  try {
    const [priceRes, names] = await Promise.all([
      fetch(`https://api.upbit.com/v1/ticker?markets=${marketId}`, {
        next: { revalidate: 30 } // 코인은 30초 단위로 Next.js 캐싱 적용 (기동 속도 확보)
      }),
      fetchCoinNames()
    ]);
    const priceData = await priceRes.json();
    if (priceData && priceData.length > 0) {
      const info = priceData[0];
      const coinNames = names[marketId] || { 
        korean: COIN_FALLBACK_NAMES[marketId] || cleanTicker.replace('KRW-', ''), 
        english: cleanTicker.replace('KRW-', '') 
      };
      
      return {
        ticker: cleanTicker,
        price: info.trade_price,
        changePercent: info.signed_change_rate * 100,
        name: coinNames.korean,
        currency: 'KRW'
      };
    }
    throw new Error('No ticker data from Upbit');
  } catch (e: any) {
    console.error(`Upbit API error for ${marketId}:`, e.message);
    const fallbackName = COIN_FALLBACK_NAMES[marketId] || cleanTicker;
    return {
      ticker: cleanTicker,
      price: cleanTicker === 'BTC' ? 95000000 : 100000,
      changePercent: 0,
      name: fallbackName,
      currency: 'KRW',
      isFallback: true
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json({ error: 'Tickers parameter is required' }, { status: 400 });
  }

  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase());

  // 환경변수가 mock 모드일 때 강제 목업 반환 분기
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  if (useMock) {
    const data = tickers.map(ticker => {
      const code = ticker.replace(/\.(KS|KQ|O|N)$/, '');
      
      // 목 모드에서의 코인 데이터 모킹
      if (isCoin(ticker)) {
        const marketId = getUpbitMarketId(ticker);
        return {
          ticker,
          price: ticker === 'BTC' || ticker === 'KRW-BTC' ? 92500000 : 4800000,
          changePercent: 1.25,
          name: COIN_FALLBACK_NAMES[marketId] || ticker,
          currency: 'KRW'
        };
      }
      
      const mockInfo = MOCK_STOCK_PRICES[code] || MOCK_STOCK_PRICES[ticker] || {
        price: 100,
        changePercent: 0,
        name: ticker,
        currency: ticker.match(/^\d/) ? 'KRW' : 'USD'
      };
      return {
        ticker,
        price: mockInfo.price,
        changePercent: mockInfo.changePercent,
        name: mockInfo.name,
        currency: mockInfo.currency
      };
    });

    return NextResponse.json({ data, exchangeRate: 1380 });
  }

  try {
    // 모든 요청 티커 및 환율을 병렬로 획득
    const [stockData, exchangeRate] = await Promise.all([
      Promise.all(tickers.map(ticker => {
        if (isCoin(ticker)) {
          return fetchCoinInfoFromUpbit(ticker);
        }
        return fetchStockInfoFromNaver(ticker);
      })),
      fetchExchangeRate()
    ]);

    return NextResponse.json({ data: stockData, exchangeRate });
  } catch (globalError: any) {
    console.error('Hybrid Naver/Upbit API global error:', globalError);
    return NextResponse.json({ error: 'Failed to fetch stock/coin prices', details: globalError.message }, { status: 500 });
  }
}
