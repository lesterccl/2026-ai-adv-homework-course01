const ecpay = require('../src/services/ecpay');
const vectorFile = require('./fixtures/ecpay-checkmacvalue.json');

const HASH_KEY = 'pwFHCqoQZGmho4w6';
const HASH_IV = 'EkRm7iFT261dpevs';

describe('ECPay CheckMacValue', () => {
  const applicable = vectorFile.vectors.filter(v => v.formula !== 'ecticket');

  it('should match every official test vector', () => {
    expect(applicable.length).toBeGreaterThan(0);

    for (const vector of applicable) {
      const actual = ecpay.generateCheckMacValue(
        vector.params, vector.hashKey, vector.hashIV, vector.method.toLowerCase()
      );
      expect(actual, vector.name).toBe(vector.expected);
    }
  });

  it('should ignore an existing CheckMacValue when recalculating', () => {
    const base = applicable[0];
    const withMac = { ...base.params, CheckMacValue: 'SHOULD_BE_IGNORED' };

    expect(ecpay.generateCheckMacValue(withMac, base.hashKey, base.hashIV)).toBe(base.expected);
  });

  it('should sort keys case-insensitively', () => {
    const a = { MerchantID: '3002607', TotalAmount: '100', ItemName: 'x' };
    const b = { ItemName: 'x', TotalAmount: '100', MerchantID: '3002607' };

    expect(ecpay.generateCheckMacValue(a, HASH_KEY, HASH_IV))
      .toBe(ecpay.generateCheckMacValue(b, HASH_KEY, HASH_IV));
  });

  it('should verify a correctly signed payload', () => {
    const params = { MerchantID: '3002607', MerchantTradeNo: 'FL0001', TradeAmt: '1680' };
    params.CheckMacValue = ecpay.generateCheckMacValue(params, HASH_KEY, HASH_IV);

    expect(ecpay.verifyCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(true);
  });

  it('should reject a tampered payload', () => {
    const params = { MerchantID: '3002607', MerchantTradeNo: 'FL0001', TradeAmt: '1680' };
    params.CheckMacValue = ecpay.generateCheckMacValue(params, HASH_KEY, HASH_IV);
    params.TradeAmt = '1';

    expect(ecpay.verifyCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(false);
  });

  it('should reject a missing or wrong-length CheckMacValue without throwing', () => {
    const params = { MerchantID: '3002607', TradeAmt: '100' };

    expect(ecpay.verifyCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(false);
    expect(ecpay.verifyCheckMacValue({ ...params, CheckMacValue: 'SHORT' }, HASH_KEY, HASH_IV)).toBe(false);
  });
});

describe('ECPay url encode', () => {
  it('should encode space as plus, not percent-twenty', () => {
    expect(ecpay.ecpayUrlEncode('a b')).toBe('a+b');
  });

  it('should restore the .NET unreserved characters', () => {
    expect(ecpay.ecpayUrlEncode('-_.!*()')).toBe('-_.!*()');
  });

  it('should lowercase percent escapes', () => {
    expect(ecpay.ecpayUrlEncode('~')).toBe('%7e');
  });
});

describe('ECPay MerchantTradeNo', () => {
  it('should be alphanumeric and at most 20 characters', () => {
    const tradeNo = ecpay.generateMerchantTradeNo();

    expect(tradeNo).toMatch(/^[A-Za-z0-9]+$/);
    expect(tradeNo.length).toBeLessThanOrEqual(20);
  });

  it('should not collide across many rapid calls', () => {
    const values = new Set(Array.from({ length: 5000 }, () => ecpay.generateMerchantTradeNo()));

    expect(values.size).toBe(5000);
  });
});

describe('ECPay MerchantTradeDate', () => {
  it('should render an instant as Taipei wall time in ECPay format', () => {
    const instant = new Date('2026-09-02T08:45:00Z');

    expect(ecpay.formatTradeDate(instant)).toBe('2026/09/02 16:45:00');
  });

  it('should roll over the date across the UTC+8 boundary', () => {
    expect(ecpay.formatTradeDate(new Date('2026-09-02T16:00:00Z'))).toBe('2026/09/03 00:00:00');
  });

  it('should zero-pad every component', () => {
    expect(ecpay.formatTradeDate(new Date('2026-01-05T01:02:03Z'))).toBe('2026/01/05 09:02:03');
  });
});

describe('ECPay parameter sanitising', () => {
  it('should strip html tags and control characters', () => {
    expect(ecpay.sanitizeText('<b>玫瑰</b>花束', 100)).toBe('玫瑰 花束');
  });

  it('should strip shell metacharacters that the ECPay WAF blocks', () => {
    expect(ecpay.sanitizeText('rose;|`x', 100)).toBe('rose x');
  });

  it('should strip WAF-blocked system keywords', () => {
    expect(ecpay.sanitizeText('curl rose', 100)).toBe('rose');
  });

  it('should truncate to the given length', () => {
    expect(ecpay.sanitizeText('a'.repeat(500), 200)).toHaveLength(200);
  });

  it('should keep ItemName within the 400 character limit', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      product_name: `超長商品名稱測試用途${i}`.repeat(5), quantity: 2
    }));

    expect(ecpay.buildItemName(items).length).toBeLessThanOrEqual(400);
  });

  it('should join multiple items with a hash separator', () => {
    const items = [
      { product_name: '粉色玫瑰花束', quantity: 1 },
      { product_name: '白色百合花禮盒', quantity: 2 }
    ];

    expect(ecpay.buildItemName(items)).toBe('粉色玫瑰花束 x1#白色百合花禮盒 x2');
  });
});

describe('ECPay payment params', () => {
  const order = {
    id: 'order-uuid-1',
    merchant_trade_no: 'FL2026090212345678',
    total_amount: 1680
  };
  const items = [{ product_name: '粉色玫瑰花束', quantity: 1 }];

  it('should include every required AIO field', () => {
    const params = ecpay.buildPaymentParams(order, items, { baseUrl: 'https://example.com' });

    for (const key of ['MerchantID', 'MerchantTradeNo', 'MerchantTradeDate', 'PaymentType',
      'TotalAmount', 'TradeDesc', 'ItemName', 'ReturnURL', 'ChoosePayment',
      'EncryptType', 'CheckMacValue']) {
      expect(params, key).toHaveProperty(key);
    }
    expect(params.PaymentType).toBe('aio');
    expect(params.EncryptType).toBe('1');
    expect(params.ChoosePayment).toBe('Credit');
  });

  it('should point the three callback URLs at different paths', () => {
    const params = ecpay.buildPaymentParams(order, items, { baseUrl: 'https://example.com' });
    const urls = [params.ReturnURL, params.OrderResultURL, params.ClientBackURL];

    expect(new Set(urls).size).toBe(3);
    expect(params.ReturnURL).toBe('https://example.com/api/payments/ecpay/callback');
  });

  it('should produce params that verify against their own CheckMacValue', () => {
    const params = ecpay.buildPaymentParams(order, items, { baseUrl: 'https://example.com' });

    expect(ecpay.verifyCallback(params)).toBe(true);
  });

  it('should carry the order id back in CustomField1', () => {
    const params = ecpay.buildPaymentParams(order, items, { baseUrl: 'https://example.com' });

    expect(params.CustomField1).toBe(order.id);
  });
});
