exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      imgbb:      process.env.IMGBB_KEY      || '',
      brevoKey:   process.env.BREVO_KEY      || '',
      brevoList:  process.env.BREVO_LIST_ID_SEND  || '',
      jsonbinId:  process.env.JSONBIN_ID     || '',
      jsonbinKey: process.env.JSONBIN_KEY    || '',
    }),
  };
};
