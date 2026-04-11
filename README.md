# ZeddFutures Landing Page

A live performance landing page connected to Myfxbook, deployable on Netlify.

## Project Structure

```
zeddfutures/
├── public/
│   └── index.html          ← Your landing page
├── netlify/
│   └── functions/
│       └── myfxbook.js     ← Serverless function (proxies Myfxbook API)
└── netlify.toml            ← Netlify config
```

## Deploy to Netlify

### Step 1 — Push to GitHub
1. Create a new GitHub repository
2. Upload this entire folder to it

### Step 2 — Connect to Netlify
1. Go to [netlify.com](https://netlify.com) → New site → Import from GitHub
2. Select your repo
3. Build settings are auto-detected from `netlify.toml`
4. Click **Deploy**

### Step 3 — Add Your Myfxbook Credentials
1. In Netlify: **Site Settings → Environment Variables**
2. Add these two variables:
   - `MYFXBOOK_EMAIL` → your Myfxbook login email
   - `MYFXBOOK_PASSWORD` → your Myfxbook password
3. Click **Trigger Deploy** to redeploy with credentials active

Your live stats will now auto-populate from Myfxbook. ✅

## Customisation

- **Colours**: Edit CSS variables at the top of `index.html`
- **Email capture**: Connect the form to Mailchimp / ConvertKit by replacing the `handleSubmit()` function
- **Multiple accounts**: Edit `myfxbook.js` to return `accounts[1]` or aggregate multiple accounts
- **Caching**: Add a cache layer in the Netlify function to avoid hitting Myfxbook API on every page load
