exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { password } = JSON.parse(event.body);
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (!correctPassword) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured' }) };
    }

    if (password === correctPassword) {
      // Return a simple session token (timestamp + secret hash)
      const token = Buffer.from(`zf_auth_${Date.now()}_${correctPassword}`).toString('base64');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, token }) };
    } else {
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Incorrect password' }) };
    }
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) };
  }
};
