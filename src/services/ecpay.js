const crypto = require('crypto');

// Source: ECPay API Skill v3.4 guides/13-checkmacvalue.md §Node.js
// encodeURIComponent 不編碼 ' ( ) ! * ~ 且空格編為 %20，與 PHP urlencode 行為不同，
// 需逐項校正後才會與綠界端算出同一個 CheckMacValue。
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')'
  };
  for (const [from, to] of Object.entries(replacements)) {
    encoded = encoded.split(from).join(to);
  }
  return encoded;
}

function generateCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== 'CheckMacValue')
  );
  // 綠界規定按 ASCII 排序。localeCompare 依 ICU locale 而定，換環境可能排出不同順序，
  // 導致合法回調被誤判為簽章錯誤，因此用 ordinal 比較。
  const sorted = Object.keys(filtered).sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  const paramStr = sorted.map(key => `${key}=${filtered[key]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  return crypto.createHash(method).update(ecpayUrlEncode(raw), 'utf8').digest('hex').toUpperCase();
}

// 綠界規定驗證碼比對必須 timing-safe，禁止用 === (guides/13 §timing-safe)
function verifyCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  const received = params.CheckMacValue || '';
  const calculated = generateCheckMacValue(params, hashKey, hashIv, method);
  const a = Buffer.from(String(received));
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// 綠界公開的測試帳號，官方文件上人人可見。只准在測試環境當預設值——
// 正式環境若漏設環境變數而回退到這組金鑰，任何人都能自行簽出合法的
// CheckMacValue 偽造付款成功回調，等於免費下單。
const STAGING_DEFAULTS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs'
};

function getConfig() {
  const env = process.env.ECPAY_ENV || 'staging';
  const isProduction = env === 'production' || process.env.NODE_ENV === 'production';
  const fallback = isProduction ? {} : STAGING_DEFAULTS;

  const config = {
    merchantId: process.env.ECPAY_MERCHANT_ID || fallback.merchantId,
    hashKey: process.env.ECPAY_HASH_KEY || fallback.hashKey,
    hashIv: process.env.ECPAY_HASH_IV || fallback.hashIv,
    env,
    baseUrl: process.env.BASE_URL || 'http://localhost:3001'
  };

  if (!config.merchantId || !config.hashKey || !config.hashIv) {
    throw new Error('ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV 為正式環境必填，拒絕使用測試金鑰');
  }
  return config;
}

function getGatewayUrl() {
  const host = getConfig().env === 'production'
    ? 'https://payment.ecpay.com.tw'
    : 'https://payment-stage.ecpay.com.tw';
  return `${host}/Cashier/AioCheckOut/V5`;
}

// MerchantTradeDate 必須是台北時間 (UTC+8)，格式 yyyy/MM/dd HH:mm:ss。
// 伺服器時區不論為何都要換算，否則綠界會因時差拒絕訂單。
function formatTradeDate(date) {
  const taipei = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60000);
  const pad = n => String(n).padStart(2, '0');
  return `${taipei.getFullYear()}/${pad(taipei.getMonth() + 1)}/${pad(taipei.getDate())}`
    + ` ${pad(taipei.getHours())}:${pad(taipei.getMinutes())}:${pad(taipei.getSeconds())}`;
}

// 綠界限制：英數字、最長 20 碼、永久唯一（重複會被拒絕）。訂單的 order_no 含連字號不能直接用。
// 刻意不吃 order_no 當種子：長度預算只有 20 碼，摻入種子會排擠掉隨機位元而產生碰撞。
// 訂單的對應關係由 DB 的 merchant_trade_no 欄位與回傳的 CustomField1 保存。
function generateMerchantTradeNo() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-8);
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `FL${stamp}${random}`;
}

// 綠界 CDN WAF 會攔截含系統指令字詞的參數，且 ItemName 超長截斷會產生亂碼
// 導致 CheckMacValue 不一致 (SKILL.md §AI 注意事項)。
const WAF_KEYWORDS = /\b(echo|python|cmd|wget|curl|ping|net|nmap|telnet|chmod|bash|sh|eval|exec)\b/gi;

function sanitizeText(value, maxLength) {
  const cleaned = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F;|`]/g, ' ')
    .replace(WAF_KEYWORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLength);
}

function buildItemName(items) {
  const names = items.map(item => `${sanitizeText(item.product_name, 60)} x${item.quantity}`);
  let joined = names.join('#');
  if (joined.length > 400) joined = joined.slice(0, 400);
  return joined;
}

function buildPaymentParams(order, items, options = {}) {
  const config = getConfig();
  const baseUrl = options.baseUrl || config.baseUrl;
  const now = options.now || new Date();

  const params = {
    MerchantID: config.merchantId,
    MerchantTradeNo: order.merchant_trade_no,
    MerchantTradeDate: formatTradeDate(now),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: sanitizeText('flower life order', 200),
    ItemName: buildItemName(items),
    ReturnURL: `${baseUrl}/api/payments/ecpay/callback`,
    OrderResultURL: `${baseUrl}/api/payments/ecpay/result`,
    ClientBackURL: `${baseUrl}/orders/${order.id}`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
    CustomField1: order.id
  };

  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);
  return params;
}

function verifyCallback(body) {
  const config = getConfig();
  return verifyCheckMacValue(body, config.hashKey, config.hashIv);
}

module.exports = {
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
  verifyCallback,
  getConfig,
  getGatewayUrl,
  formatTradeDate,
  generateMerchantTradeNo,
  sanitizeText,
  buildItemName,
  buildPaymentParams
};
