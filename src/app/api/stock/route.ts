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
        next: { revalidate: 10 } // 10초 캐싱
      });
      const buffer = await res.arrayBuffer();
      // 네이버 폴링 API는 EUC-KR 인코딩이므로 TextDecoder로 한글 깨짐 우회
      const text = new TextDecoder('euc-kr').decode(buffer);
      const data = JSON.parse(text);
      
      const stockData = data.result?.areas?.[0]?.datas?.[0];
      if (!stockData) throw new Error("No polling data found");

      return {
        ticker: cleanTicker,
        price: stockData.nv,
        changePercent: stockData.cr,
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
          next: { revalidate: 10 } // 10초 캐싱
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
      const changeRatio = parseFloat(successfulData.fluctuationsRatio || '0');
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

    return NextResponse.json({ data });
  }

  try {
    // 모든 요청 티커를 하이브리드 네이버 금융 API로 병렬 실시간 획득
    const data = await Promise.all(
      tickers.map(ticker => fetchStockInfoFromNaver(ticker))
    );

    return NextResponse.json({ data });
  } catch (globalError: any) {
    console.error('Hybrid Naver API global error:', globalError);
    return NextResponse.json({ error: 'Failed to fetch stock prices', details: globalError.message }, { status: 500 });
  }
}
