# Deploy Free via GitHub (Render + Vercel)

This setup deploys:
- Backend (`backend/`) to Render (free web service)
- Frontend (`frontend/`) to Vercel (free static hosting)
- Database on MongoDB Atlas free tier

## 1) Deploy backend on Render

1. Open: https://dashboard.render.com/blueprints
2. Click **New Blueprint Instance**
3. Connect GitHub repo: `namnguyenx191/homestay-bk-manager`
4. Render reads `render.yaml` automatically.
5. Fill required env vars:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL` (temporary value, update after Vercel deploy)
   - `CLIENT_URLS` (same temporary value)
   - `API_PUBLIC_URL` (set to backend URL, e.g. `https://homestay-api.onrender.com`)
6. Deploy and copy backend URL: `https://<your-render-service>.onrender.com`

## 2) Deploy frontend on Vercel

1. Open: https://vercel.com/new
2. Import the same GitHub repo
3. Set **Root Directory** = `frontend`
4. Add env vars:
   - `VITE_API_URL=https://<your-render-service>.onrender.com/api`
   - `VITE_SOCKET_URL=https://<your-render-service>.onrender.com`
5. Deploy and copy frontend URL: `https://<your-project>.vercel.app`

## 3) Update backend CORS on Render

After frontend URL is ready, go back to Render service env and update:
- `CLIENT_URL=https://<your-project>.vercel.app`
- `CLIENT_URLS=https://<your-project>.vercel.app`

Then trigger redeploy.

## 4) Verify

- Backend health: `https://<your-render-service>.onrender.com/api/health`
- Frontend app opens without CORS errors
- Login/register and booking endpoints work

## Notes

- Free tier can sleep and cold-start.
- For stable realtime with 50 concurrent users, move backend to a VPS later.
