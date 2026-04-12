const https = require("https");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("fetchJSON OK:", url.split("?")[0], "| status:", res.statusCode);
          resolve(parsed);
        } catch (e) {
          console.error("fetchJSON parse error:", data.substring(0, 200));
          reject(new Error("Failed to parse JSON: " + data.substring(0, 100)));
        }
      });
    });
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Request timed out: " + url.split("?")[0]));
    });
    req.on("error", (err) => {
      console.error("fetchJSON request error:", err.message);
      reject(err);
    });
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

  console.log("Env check — email set:", !!email, "| password set:", !!password);

  if (!email || !password) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing Myfxbook credentials in environment variables." }),
    };
  }

  try {
    // Step 1: Login
    console.log("Step 1: Logging in to Myfxbook...");
    const loginUrl = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const loginData = await fetchJSON(loginUrl);
    console.log("Login response — error:", loginData.error, "| session:", !!loginData.session, "| message:", loginData.message);

    if (loginData.error || !loginData.session) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Myfxbook login failed: " + loginData.message }),
      };
    }

    const session = loginData.session;

    // Step 2: Get accounts
    console.log("Step 2: Fetching accounts...");
    const accountsUrl = `https://www.myfxbook.com/api/get-my-accounts.json?session=${session}`;
    const accountsData = await fetchJSON(accountsUrl);
    console.log("Accounts response — error:", accountsData.error, "| count:", accountsData.accounts?.length);

    if (accountsData.error || !accountsData.accounts || accountsData.accounts.length === 0) {
      await fetchJSON(`https://www.myfxbook.com/api/logout.json?session=${session}`).catch(() => {});
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch accounts: " + accountsData.message }),
      };
    }

    // Step 3: Get trade history
    let trades = [];
    try {
      console.log("Step 3: Fetching trade history...");
      const accountId = accountsData.accounts[0].id;
      const historyUrl = `https://www.myfxbook.com/api/get-history.json?session=${session}&id=${accountId}`;
      const historyData = await fetchJSON(historyUrl);
      console.log("History response — error:", historyData.error, "| trades:", historyData.history?.length);
      if (!historyData.error && historyData.history) {
        trades = historyData.history
          .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))
          .slice(0, 5);
      }
    } catch (histErr) {
      console.warn("Trade history fetch failed (non-fatal):", histErr.message);
    }

    // Step 4: Logout
    await fetchJSON(`https://www.myfxbook.com/api/logout.json?session=${session}`).catch(() => {});

    const account = accountsData.accounts[0];
    console.log("Success — account name:", account.name, "| gain:", account.gain);

    // Calculate stats from trade history if account fields are missing
    let wonTrades = account.wonTrades || 0;
    let lostTrades = account.lostTrades || 0;
    let totalTrades = account.totalTrades || 0;

    if (trades.length > 0 && (wonTrades === 0 && lostTrades === 0)) {
      // Use full history to calculate (not just last 5)
      try {
        const accountId = accountsData.accounts[0].id;
        const fullHistoryUrl = `https://www.myfxbook.com/api/get-history.json?session=${session}&id=${accountId}`;
        const fullHistoryData = await fetchJSON(fullHistoryUrl).catch(() => null);
        if (fullHistoryData && fullHistoryData.history) {
          const allTrades = fullHistoryData.history;
          totalTrades = allTrades.length;
          wonTrades = allTrades.filter(t => parseFloat(t.profit) > 0).length;
          lostTrades = allTrades.filter(t => parseFloat(t.profit) <= 0).length;
        }
      } catch (e) {
        console.warn("Could not recalculate from history:", e.message);
      }
    }

    const winRate = (wonTrades + lostTrades) > 0
      ? ((wonTrades / (wonTrades + lostTrades)) * 100).toFixed(1)
      : null;

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
        wonTrades,
        lostTrades,
        totalTrades,
        winRate,
        lastUpdateDate: account.lastUpdateDate,
        currency: account.currency || "USD",
        trades: trades,
      }),
    };
  } catch (err) {
    console.error("Handler error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error: " + err.message }),
    };
  }
};
