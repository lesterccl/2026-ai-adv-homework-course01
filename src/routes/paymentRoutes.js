const express = require('express');
const db = require('../database');
const ecpay = require('../services/ecpay');

const router = express.Router();

// 這兩支端點由綠界伺服器與消費者瀏覽器直接呼叫，不帶 JWT，
// 所以不能掛在 orderRoutes 的 authMiddleware 底下。身分驗證改由 CheckMacValue 擔保。
// 回應格式亦是全站唯一不套用 { data, error, message } 的例外：綠界規定
// ReturnURL 必須回純文字 1|OK，OrderResultURL 則直接導頁。

// 主查 merchant_trade_no；重試付款會換一組新的，舊交易編號的遲到回調靠
// CustomField1（建單時我們自己塞進去的訂單 id）才對得回來。
function findOrder(body) {
  if (body.MerchantTradeNo) {
    const byTradeNo = db.prepare('SELECT * FROM orders WHERE merchant_trade_no = ?')
      .get(body.MerchantTradeNo);
    if (byTradeNo) return byTradeNo;
  }
  if (body.CustomField1) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(body.CustomField1) || null;
  }
  return null;
}

function applyPaymentResult(order, body) {
  const paid = String(body.RtnCode) === '1';
  const status = paid ? 'paid' : 'failed';

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = ?, ecpay_trade_no = ?, payment_type = ?, paid_at = ?
       WHERE id = ? AND status != 'paid'`
    ).run(status, body.TradeNo || null, body.PaymentType || null,
      paid ? (body.PaymentDate || null) : null, order.id);
  });

  update();
  return status;
}

// 回傳 null = 可以處理；回傳字串 = 拒絕的理由
function rejectionReason(order, body) {
  if (!order) return 'order not found';
  if (body.MerchantID !== ecpay.getConfig().merchantId) return 'merchant mismatch';
  if (Number(body.TradeAmt) !== Number(order.total_amount)) return 'amount mismatch';
  return null;
}

/**
 * @openapi
 * /api/payments/ecpay/callback:
 *   post:
 *     summary: 綠界 ReturnURL 付款結果通知（Server-to-Server）
 *     description: >
 *       由綠界伺服器直接呼叫，不帶 JWT，身分由 CheckMacValue 擔保。
 *       回應為純文字 `1|OK`（綠界規定），非本站統一的 JSON 格式。
 *       驗簽失敗或金額不符時回 `0|<reason>`，綠界會重送最多 4 次。
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               MerchantTradeNo:
 *                 type: string
 *               RtnCode:
 *                 type: string
 *                 description: 1 代表付款成功
 *               TradeNo:
 *                 type: string
 *               TradeAmt:
 *                 type: string
 *               PaymentDate:
 *                 type: string
 *               PaymentType:
 *                 type: string
 *               CheckMacValue:
 *                 type: string
 *     responses:
 *       200:
 *         description: "純文字 1|OK（成功受理）或 0|<reason>（拒絕）"
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.post('/ecpay/callback', (req, res) => {
  const body = req.body || {};

  if (!ecpay.verifyCallback(body)) {
    console.error('ECPay callback rejected: CheckMacValue mismatch', body.MerchantTradeNo);
    return res.type('text/plain').send('0|CheckMacValue Error');
  }

  const order = findOrder(body);
  const reason = rejectionReason(order, body);
  if (reason) {
    console.error('ECPay callback rejected:', reason, body.MerchantTradeNo);
    return res.type('text/plain').send(`0|${reason}`);
  }

  // 綠界最多重送 4 次，重複通知必須是 no-op 且仍回 1|OK，否則會一直重試。
  // paid 是終態，遲到的失敗通知不得把它翻回 failed。
  if (order.status !== 'paid') {
    applyPaymentResult(order, body);
  }

  res.type('text/plain').send('1|OK');
});

/**
 * @openapi
 * /api/payments/ecpay/result:
 *   post:
 *     summary: 綠界 OrderResultURL 付款結果導回（消費者瀏覽器）
 *     description: >
 *       消費者付款後由瀏覽器 form POST 回來，不帶 JWT。
 *       驗簽後 302 導向 /orders/{id}?payment=success|failed，不回 JSON。
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               MerchantTradeNo:
 *                 type: string
 *               RtnCode:
 *                 type: string
 *               TradeAmt:
 *                 type: string
 *               CustomField1:
 *                 type: string
 *                 description: 建單時帶入的訂單 id
 *               CheckMacValue:
 *                 type: string
 *     responses:
 *       302:
 *         description: 導向訂單詳情頁並帶上 payment 查詢參數
 */
router.post('/ecpay/result', (req, res) => {
  const body = req.body || {};
  const orderId = body.CustomField1 || '';

  if (!ecpay.verifyCallback(body)) {
    // 驗簽失敗代表這份 payload 不可信，不拿它的任何欄位組導向網址。
    console.error('ECPay result rejected: CheckMacValue mismatch', body.MerchantTradeNo);
    return res.redirect(302, '/orders');
  }

  const order = findOrder(body);
  const reason = rejectionReason(order, body);
  if (reason) {
    console.error('ECPay result rejected:', reason, body.MerchantTradeNo);
    return res.redirect(302, orderId ? `/orders/${orderId}?payment=failed` : '/orders');
  }

  // ReturnURL 與 OrderResultURL 的抵達順序不保證，這裡同樣落狀態以免使用者看到過期資訊。
  if (order.status !== 'paid') {
    applyPaymentResult(order, body);
  }

  const result = String(body.RtnCode) === '1' ? 'success' : 'failed';
  res.redirect(302, `/orders/${order.id}?payment=${result}`);
});

module.exports = router;
