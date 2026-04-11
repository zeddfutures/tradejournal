const https = require("https");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse JSON: " + data));
        }
      });
    }).on("error", reject);
  });
}

exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;

  if (!email || !password) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing Myfxbook credentials in environment variables." }),
    };
  }

  try {
    // Step 1: Login
    const loginUrl = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const loginData = await fetchJSON(loginUrl);

    if (loginData.error || !loginData.session) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Myfxbook login failed: " + loginData.message }),
      };
    }

    const session = loginData.session;

    // Step 2: Get accounts
    const accountsUrl = `https://www.myfxbook.com/api/get-my-accounts.json?session=${session}`;
    const accountsData = await fetchJSON(accountsUrl);

    // Step 3: Logout
    await fetchJSON(`https://www.myfxbook.com/api/logout.json?session=${session}`);

    if (accountsData.error || !accountsData.accounts) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch accounts: " + accountsData.message }),
      };
    }

    // Return the first account's key stats
    const account = accountsData.accounts[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        name: account.name,
        gain: account.gain,
        absGain: account.absGain,
        drawdown: account.drawdown,
        balance: account.balance,
        equity: account.equity,
        profit: account.profit,
        deposits: account.deposits,
        interest: account.interest,
        profitFactor: account.profitFactor,
        pips: account.pips,
        wonTrades: account.wonTrades,
        lostTrades: account.lostTrades,
        totalTrades: account.totalTrades || (account.wonTrades + account.lostTrades),
        winRate: account.wonTrades && account.totalTrades
          ? ((account.wonTrades / (account.wonTrades + account.lostTrades)) * 100).toFixed(1)
          : null,
        lastUpdateDate: account.lastUpdateDate,
        currency: account.currency || "USD",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error: " + err.message }),
    };
  }
};
