export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, imageType, apiKey } = req.body || {};
    const trimmedKey = (apiKey || '').trim();
    if (!imageBase64 || !trimmedKey) {
      return res.status(400).json({ error: '필수 파라미터가 없습니다 (이미지: ' + !!imageBase64 + ', 키: ' + !!trimmedKey + ')' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: '거래명세서에서 모든 정보를 추출하여 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트 없이:\n{"date":"YYYY-MM-DD","docNo":"","vendor":"","bizNo":"","contact":"","type":"의약품 또는 의료기기","paymentTerms":"","items":[{"name":"","spec":"","unit":"","qty":0,"unitPrice":0,"amount":0,"note":""}],"supplyAmount":0,"vat":0,"totalAmount":0,"confidence":{"date":0.9,"docNo":0.8,"vendor":0.95,"bizNo":0.7,"contact":0.6,"items":0.85,"supplyAmount":0.9,"totalAmount":0.9}}'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || 'API 오류';
      return res.status(response.status).json({
        error: response.status === 401 ? 'API 키가 유효하지 않습니다. 키를 확인해주세요. (' + msg + ')' : msg
      });
    }

    const data = await response.json();
    return res.status(200).json({ content: data.content });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
