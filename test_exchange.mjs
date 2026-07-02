async function testExchangeAPI() {
  const url = "https://api.stock.naver.com/marketindex/exchange/FX_USDKRW";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://m.stock.naver.com/"
      }
    });
    const data = await res.json();
    console.log("=== exchangeInfo keys ===");
    console.log(Object.keys(data.exchangeInfo));
    console.log("=== Price fields inside exchangeInfo ===");
    console.log({
      closePrice: data.exchangeInfo.closePrice,
      nowVal: data.exchangeInfo.nowVal,
      price: data.exchangeInfo.price,
      nv: data.exchangeInfo.nv,
      recodingPrice: data.exchangeInfo.recodingPrice
    });
    // 혹시 raw value 필드들이 있으면 확인
    const likelyPriceKeys = ['closePrice', 'nowVal', 'price', 'currentPrice', 'nv', 'basePrice', 'dealBasRate'];
    likelyPriceKeys.forEach(k => {
      if (data.exchangeInfo[k] !== undefined) {
        console.log(`Found direct key [${k}]:`, data.exchangeInfo[k]);
      }
    });
  } catch (e) {
    console.log("Error:", e.message);
  }
}

testExchangeAPI();
