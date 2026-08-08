# Block Optimiser

Lucky Pick read board for [mine.critters.quest](https://mine.critters.quest) — hot / due / patterns / best plays.

## Local

```bash
npm install
npm run dev
```

- UI: http://localhost:5173  
- Cache server: http://localhost:3789  

## Vercel

Connect this repo in Vercel. Build uses Vite; `/api/*` serverless routes proxy + cache rounds from the mine API.

Framework preset: **Vite** (or leave auto). No env vars required.
