// 綠界 AIO 需要以 form POST 導向付款頁；絕不可用 iframe 或 fetch，
// 綠界付款頁會被 X-Frame-Options 擋掉（ECPay API Skill guides/01）。
async function startEcpayPayment(orderId) {
  const res = await apiFetch('/api/orders/' + orderId + '/payment', { method: 'POST' });

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = res.data.action;
  form.style.display = 'none';

  Object.entries(res.data.params).forEach(function (entry) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = entry[0];
    input.value = entry[1];
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
