# Checkout Champs v1 Repo

This is a drop-in starter repo for Checkout Champs with:

- landing page at `/`
- live demo at `/demo/`
- admin view at `/admin/`
- thin logging backend in `/backend/`

## Frontend deploy
Upload these files to the root of your GitHub Pages repo:

- `index.html`
- `demo/`
- `admin/`

## Backend run
```bash
cd backend
npm install
node server.js
```

Backend defaults to:
- `http://localhost:3000`

The frontend looks for that API by default. You can override it in the browser by setting:
- `localStorage.setItem('cc_api_base', 'https://your-backend-url')`

## Endpoints
- `POST /api/merchant/create`
- `POST /api/merchant/save-settings`
- `GET /api/widget-config?merchant_id=...`
- `POST /api/events/log`
- `GET /api/admin/merchants`
- `GET /api/admin/events?limit=200`

## Notes
This is intentionally thin. It logs first and pretties up later.
