export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, imageType, apiKey, testOnly } = req.body || {};
    // 우선순위: 사용자 입력 키 > 서버 환경변수
    const trimmedKey = (apiKey || '').trim() || (process.env.ANTHROPIC_API_KEY || '').trim();

    if (!trimmedKey) {
      return res.status(400).json({ error: 'API 키가 없습니다. 키를 입력하거나 서버 환경변수를 설정하세요.' });
    }

    // 키 테스트 모드: 간단한 텍스트 요청으로 키 유효성만 확인
    if (testOnly) {
      const testRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': trimmedKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }]
        })
      });

      if (testRes.ok) {
        return res.status(200).json({ testResult: 'ok' });
      } else {
        const err = await testRes.json().catch(() => ({}));
        return res.status(testRes.status).json({
          error: err.error?.message || 'API 키 인증 실패 (HTTP ' + testRes.status + ')'
        });
      }
    }

    // 일반 분석 모드
    if (!imageBase64) {
      return res.status(400).json({ error: '이미지가 없습니다' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: '이 거래명세서(invoice) 이미지에서 모든 정보를 정확하게 추출하세요.\n\n규칙:\n- 숫자(수량, 단가, 금액)는 반드시 정확하게 읽을 것. 쉼표 제거 후 숫자만.\n- 보험코드/제품코드가 있으면 반드시 추출. 없으면 빈 문자열.\n- 제조사(manufacturer)가 있으면 반드시 추출.\n- 단가(unitPrice)는 VAT 불포함 가격, unitPriceVat는 VAT 포함 가격. 하나만 있으면 다른 하나를 계산(VAT 10%).\n- 모든 품목 행을 빠짐없이 추출할 것.\n- 합계금액이 명시되어 있으면 그대로 사용, 없으면 품목 합산.\n\nJSON 형식으로만 응답 (JSON 외 텍스트 없이):\n{"date":"YYYY-MM-DD","docNo":"문서번호","vendor":"공급업체명","bizNo":"사업자등록번호","contact":"담당자/연락처","type":"의약품 또는 의료기기","paymentTerms":"결제조건","items":[{"code":"보험코드/제품코드","name":"품명","spec":"규격","unit":"단위","qty":0,"unitPrice":0,"unitPriceVat":0,"amount":0,"manufacturer":"제조사"}],"supplyAmount":0,"vat":0,"totalAmount":0,"confidence":{"date":0.95,"docNo":0.9,"vendor":0.95,"bizNo":0.9,"contact":0.8,"items":0.95,"supplyAmount":0.95,"totalAmount":0.95}}'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || 'API 오류';
      return res.status(response.status).json({
        error: response.status === 401 ? 'API 키가 유효하지 않습니다. (' + msg + ')' : msg
      });
    }

    const data = await response.json();
    return res.status(200).json({ content: data.content });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
