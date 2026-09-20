# Dayline

Dayline is a personal planning and reflection app. It has a React/Vite frontend and an Express/MongoDB API.

## Run locally

1. Install dependencies: `npm install` then `npm run install:all`
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and `JWT_SECRET`.
3. Copy `client/.env.example` to `client/.env` if your API is not on `http://localhost:5000/api`.
4. Start both apps with `npm run dev`.
5. Open `http://localhost:5173`.

The UI can be previewed without a running API using the demo fallback on sign-in. Real accounts and persistence require MongoDB and the API.

## Deploy

### Upload to GitHub

From the project root:

```powershell
git init
git add .
git commit -m "Initial Dayline app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `server/.env`. It is ignored by the root `.gitignore`.

### Render API
Create a Web Service pointing at this repository. The included `render.yaml` uses **Root Directory** `server`, **Build Command** `npm install`, and **Start Command** `npm start`. Add `MONGODB_URI` and set `CLIENT_URL` to your Vercel URL after the frontend is deployed. Render generates `JWT_SECRET` automatically from the blueprint.

### Vercel frontend
Import the repository into Vercel. The root `vercel.json` builds `client` and serves `client/dist`. Set `VITE_API_URL` to the Render API URL ending in `/api`.
