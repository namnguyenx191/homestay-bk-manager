# Homestay Booking & Management System

Full-stack web app with role-based booking, reviews, and admin operations.

## Tech Stack

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express (MVC)
- Database: MongoDB + Mongoose
- Auth: JWT + Role-based access control
- Optional payment: Stripe Checkout + Stripe Elements (inline card)

## Project Structure

```text
.
├── backend
│   ├── src
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
├── frontend
│   ├── src
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
└── README.md
```

## Features Implemented

- Authentication
  - Register, login, logout
  - Password hashing with bcrypt
  - JWT auth middleware
  - Role-based permissions (`user`, `admin`)
- Homestays
  - List, detail, search/filter/sort
  - Admin CRUD
  - Availability check endpoint
- Booking
  - Date-based booking creation
  - Overlap prevention (real-time availability logic)
  - Auto total price calculation
  - User booking history
  - Admin booking management
- Reviews
  - Only booked users can review
  - Rating + comment
  - Average rating refresh on homestay
- Admin dashboard
  - Stats (users, homestays, bookings, revenue)
  - User management list
  - Homestay management
  - Booking status updates
- Cloudinary Upload
  - Admin uploads real image files from dashboard
  - Server uploads to Cloudinary and stores secure URLs
- Wishlist
  - Users can add/remove homestays to personal wishlist
  - Dedicated wishlist page in frontend
- Realtime Chat (Socket.IO)
  - User-host conversations per homestay
  - Realtime message receive/send
- Email Notifications
  - Booking confirmation email triggered after booking
  - Queue-based delivery with BullMQ + Redis (fallback to direct sending)
- Payment
  - Stripe Checkout + Stripe inline card (`PaymentIntent`) support
  - Stripe webhook endpoint (`/api/bookings/webhook/stripe`) updates booking status server-side
  - Optional dev fallback for local testing when Stripe keys are not configured

## REST API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/homestays`
- `GET /api/homestays/:id`
- `GET /api/homestays/:id/availability`
- `POST /api/homestays` (admin)
- `PUT /api/homestays/:id` (admin)
- `DELETE /api/homestays/:id` (admin)
- `POST /api/bookings` (user/admin)
- `GET /api/bookings/user` (user/admin)
- `GET /api/bookings/admin` (admin)
- `PUT /api/bookings/:id/status` (admin)
- `POST /api/reviews` (user/admin)
- `GET /api/reviews/:homestayId`
- `GET /api/admin/stats` (admin)
- `GET /api/admin/users` (admin)
- `POST /api/upload/image` (admin)
- `GET /api/wishlist` (user/admin)
- `POST /api/wishlist/toggle` (user/admin)
- `GET /api/chats` (user/admin)
- `GET /api/chats/:chatId/messages` (user/admin)
- `POST /api/chats/start` (user/admin)
- `POST /api/chats/message` (user/admin)

## Run Locally

### 1) Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set required values in `backend/.env`:

- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET`
- `CLIENT_URL` (default `http://localhost:5173`)
- `STRIPE_SECRET_KEY` (`sk_test_...` or `sk_live_...`)
- `STRIPE_PUBLISHABLE_KEY` (`pk_test_...` or `pk_live_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_LIVE_MODE_REQUIRED=true` in production to enforce live keys
- `ENABLE_DEV_CARD_FALLBACK=false` for real charging mode
- Cloudinary vars (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) for real upload
- Redis + SMTP vars for queue email notifications (`REDIS_URL`, `SMTP_HOST`, etc.)

Backend runs on `http://localhost:5000`.

### 2) Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Demo Roles

Create users through register endpoint/UI, then promote one account to admin directly in MongoDB:

```js
db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })
```

## Notes for Advanced Features

- Cloudinary image upload can be added by replacing direct URL input with upload API.
- Wishlist and host-user chat can be implemented using additional collections and socket-based messaging.
- Email notifications can be added via `nodemailer` + queue worker.
- Google Maps integration can be added in detail/search pages using map SDK.

## Stripe Live End-to-End Checklist

1. In `backend/.env` set:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_LIVE_MODE_REQUIRED=true`
   - `ENABLE_DEV_CARD_FALLBACK=false`
2. Set frontend origin in backend env:
   - `CLIENT_URL=https://your-frontend-domain`
   - `CLIENT_URLS=https://your-frontend-domain`
3. In Stripe Dashboard (Live mode), configure webhook to:
   - `https://your-api-domain/api/bookings/webhook/stripe`
   - Events: `payment_intent.succeeded`, `checkout.session.completed`
4. Restart backend after env changes.
5. Verify `/api/bookings/payment-capabilities` shows:
   - `stripeModeMismatch: false`
   - `stripeLiveReady: true`
