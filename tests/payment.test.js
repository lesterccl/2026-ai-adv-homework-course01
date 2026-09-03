const { app, request, registerUser, getAdminToken } = require('./setup');
const ecpay = require('../src/services/ecpay');

const HASH_KEY = 'pwFHCqoQZGmho4w6';
const HASH_IV = 'EkRm7iFT261dpevs';

function signedCallback(overrides) {
  const body = {
    MerchantID: '3002607',
    RtnCode: '1',
    RtnMsg: 'Succeeded',
    TradeNo: '2609021645001234',
    PaymentDate: '2026/09/02 16:45:00',
    PaymentType: 'Credit_CreditCard',
    PaymentTypeChargeFee: '25',
    TradeDate: '2026/09/02 16:40:00',
    SimulatePaid: '0',
    ...overrides
  };
  body.CheckMacValue = ecpay.generateCheckMacValue(body, HASH_KEY, HASH_IV);
  return body;
}

describe('Payment API', () => {
  let token;
  let productId;

  beforeAll(async () => {
    const user = await registerUser();
    token = user.token;

    // 這個檔案每輪會建立十餘張訂單，每張都扣庫存。用種子商品會把共用庫存抽乾，
    // 導致第二次執行時其他測試檔拿到 STOCK_INSUFFICIENT。改建專用的高庫存商品。
    const adminToken = await getAdminToken();
    const created = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `付款測試專用商品-${Date.now()}`,
        description: 'payment suite fixture',
        price: 100,
        stock: 100000,
        image_url: 'https://example.com/fixture.png'
      });
    productId = created.body.data.id;
  });

  async function createPendingOrder() {
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientName: '測試收件人',
        recipientEmail: 'recipient@example.com',
        recipientAddress: '台北市信義區信義路五段7號'
      });

    return res.body.data;
  }

  async function startPayment(orderId) {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${token}`);
    return res;
  }

  it('should build ECPay form params for a pending order', async () => {
    const order = await createPendingOrder();
    const res = await startPayment(order.id);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.action).toContain('/Cashier/AioCheckOut/V5');
    expect(res.body.data.params).toHaveProperty('CheckMacValue');
    expect(res.body.data.params.MerchantTradeNo).toMatch(/^[A-Za-z0-9]{1,20}$/);
    expect(Number(res.body.data.params.TotalAmount)).toBe(order.total_amount);
  });

  it('should issue a fresh MerchantTradeNo on each payment attempt', async () => {
    const order = await createPendingOrder();
    const first = await startPayment(order.id);
    const second = await startPayment(order.id);

    // ECPay rejects a resubmitted MerchantTradeNo (10100050), which happens
    // whenever its payment page expires, so retries must get a new one.
    expect(second.body.data.params.MerchantTradeNo)
      .not.toBe(first.body.data.params.MerchantTradeNo);
  });

  it('should allow retrying payment after a failed attempt', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);

    await request(app).post('/api/payments/ecpay/callback').type('form')
      .send(signedCallback({
        MerchantTradeNo: started.body.data.params.MerchantTradeNo,
        TradeAmt: String(order.total_amount),
        RtnCode: '10100058'
      }));

    const retry = await startPayment(order.id);

    expect(retry.status).toBe(200);
    expect(retry.body.data.params).toHaveProperty('CheckMacValue');
  });

  it('should resolve a late callback for a superseded MerchantTradeNo via CustomField1', async () => {
    const order = await createPendingOrder();
    const stale = await startPayment(order.id);
    const staleTradeNo = stale.body.data.params.MerchantTradeNo;
    await startPayment(order.id);

    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({
        MerchantTradeNo: staleTradeNo,
        TradeAmt: String(order.total_amount),
        CustomField1: order.id
      }));

    expect(res.text).toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('paid');
  });

  it('should reject a callback carrying a different MerchantID', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);

    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({
        MerchantID: '9999999',
        MerchantTradeNo: started.body.data.params.MerchantTradeNo,
        TradeAmt: String(order.total_amount)
      }));

    expect(res.text).not.toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('pending');
  });

  it('should not reflect unverified input into the redirect target', async () => {
    const body = signedCallback({ MerchantTradeNo: 'FLX', CustomField1: '//evil.example.com' });
    body.CheckMacValue = 'DEADBEEF';

    const res = await request(app).post('/api/payments/ecpay/result').type('form').send(body);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/orders');
  });

  it('should require authentication to build payment params', async () => {
    const order = await createPendingOrder();
    const res = await request(app).post(`/api/orders/${order.id}/payment`);

    expect(res.status).toBe(401);
  });

  it('should return 404 for an order owned by someone else', async () => {
    const order = await createPendingOrder();
    const other = await registerUser();
    const res = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

  it('should mark the order paid on a valid success callback', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: String(order.total_amount) }));

    expect(res.status).toBe(200);
    expect(res.text).toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('paid');
    expect(detail.body.data.ecpay_trade_no).toBe('2609021645001234');
  });

  it('should mark the order failed when RtnCode is not 1', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({
        MerchantTradeNo: tradeNo,
        TradeAmt: String(order.total_amount),
        RtnCode: '10100058',
        RtnMsg: 'Card declined'
      }));

    expect(res.text).toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('failed');
  });

  it('should reject a callback with a tampered CheckMacValue', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    const body = signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: String(order.total_amount) });
    body.TradeAmt = '1';

    const res = await request(app).post('/api/payments/ecpay/callback').type('form').send(body);

    expect(res.text).not.toBe('1|OK');
    expect(res.text).toContain('CheckMacValue');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('pending');
  });

  it('should reject a correctly signed callback whose amount does not match', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: '1' }));

    expect(res.text).not.toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('pending');
  });

  it('should be idempotent when ECPay resends the same callback', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;
    const payload = signedCallback({
      MerchantTradeNo: tradeNo, TradeAmt: String(order.total_amount)
    });

    const first = await request(app).post('/api/payments/ecpay/callback').type('form').send(payload);
    const second = await request(app).post('/api/payments/ecpay/callback').type('form').send(payload);

    expect(first.text).toBe('1|OK');
    expect(second.text).toBe('1|OK');

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('paid');
    expect(detail.body.data.ecpay_trade_no).toBe('2609021645001234');
  });

  it('should not flip a paid order to failed on a late failure callback', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;
    const amount = String(order.total_amount);

    await request(app).post('/api/payments/ecpay/callback').type('form')
      .send(signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: amount }));
    await request(app).post('/api/payments/ecpay/callback').type('form')
      .send(signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: amount, RtnCode: '10100058' }));

    const detail = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.status).toBe('paid');
  });

  it('should handle a callback for an unknown MerchantTradeNo without crashing', async () => {
    const res = await request(app)
      .post('/api/payments/ecpay/callback')
      .type('form')
      .send(signedCallback({ MerchantTradeNo: 'FLNOTEXIST0000000000', TradeAmt: '100' }));

    expect(res.status).toBe(200);
    expect(res.text).not.toBe('1|OK');
  });

  it('should redirect the browser to the order page after OrderResultURL', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    const res = await request(app)
      .post('/api/payments/ecpay/result')
      .type('form')
      .send(signedCallback({
        MerchantTradeNo: tradeNo,
        TradeAmt: String(order.total_amount),
        CustomField1: order.id
      }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/orders/${order.id}?payment=success`);
  });

  it('should reject building payment params for an already paid order', async () => {
    const order = await createPendingOrder();
    const started = await startPayment(order.id);
    const tradeNo = started.body.data.params.MerchantTradeNo;

    await request(app).post('/api/payments/ecpay/callback').type('form')
      .send(signedCallback({ MerchantTradeNo: tradeNo, TradeAmt: String(order.total_amount) }));

    const res = await startPayment(order.id);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STATUS');
  });
});
