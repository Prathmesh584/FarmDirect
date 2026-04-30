# 🌿 FarmDirect — Direct Farmer-to-Consumer Marketplace

A production-ready web application connecting local farmers in Bhopal, Madhya Pradesh directly with consumers — no middlemen, honest prices, escrow-protected payments.

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase (Auth + PostgreSQL + Storage + Realtime) · Vercel

---

## 📁 Project File Structure

```
farmdirect/
├── .env.local.example          ← Copy to .env.local, fill in your keys
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── vercel.json                 ← One-click Vercel deployment config
├── package.json
│
├── supabase/
│   └── schema.sql              ← Run this in Supabase SQL Editor FIRST
│
└── src/
    ├── middleware.ts            ← Auth guard + role-based routing
    ├── types/
    │   └── index.ts             ← All shared TypeScript types + constants
    │
    ├── lib/
    │   └── supabase/
    │       ├── client.ts        ← Browser Supabase client
    │       └── server.ts        ← Server Supabase client (RSC + API routes)
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx       ← Role-aware nav with cart badge
    │   │   └── Footer.tsx
    │   └── ui/
    │       └── Toaster.tsx      ← Global toast notification system
    │
    └── app/
        ├── layout.tsx           ← Root layout with fonts
        ├── globals.css          ← Design tokens + component styles
        ├── page.tsx             ← Landing page (ISR, 10min revalidate)
        │
        ├── auth/
        │   ├── login/page.tsx
        │   ├── register/page.tsx
        │   └── callback/route.ts  ← Supabase email verification handler
        │
        ├── marketplace/
        │   ├── page.tsx           ← Product grid with filters + realtime
        │   └── [id]/page.tsx      ← Product detail with reviews
        │
        ├── cart/
        │   └── page.tsx           ← Cart + checkout form + order placement
        │
        ├── orders/
        │   └── page.tsx           ← Order history + confirm delivery (escrow)
        │
        ├── dashboard/             ← Farmer only (middleware enforces)
        │   ├── page.tsx           ← Farmer dashboard overview
        │   └── products/
        │       ├── new/page.tsx   ← Add product + image upload
        │       └── [id]/edit/page.tsx
        │
        └── api/
            ├── products/
            │   ├── route.ts       ← GET (list) + POST (create, farmer only)
            │   └── [id]/route.ts  ← GET, PATCH (farmer-owned), DELETE
            └── orders/
                ├── route.ts       ← GET (role-filtered) + POST (place order)
                └── [id]/route.ts  ← PATCH (confirm delivery, cancel, ship)
```

---

## 🚀 Quick Setup

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/farmdirect.git
cd farmdirect
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Storage** → create bucket `product-images` (set to **Public**)

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and keys
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel
```bash
# Push to GitHub, then import repo in Vercel
# Add the same env vars from .env.local to Vercel project settings
```

---

## 🔑 Environment Variables

| Variable | Where to find | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Your app URL (localhost or Vercel URL) | ✅ |

---

## 🏗 Key Architecture Decisions

| Feature | Implementation |
|---|---|
| **Auth** | Supabase Auth + custom `profiles` table with `role: farmer | consumer` |
| **Role enforcement** | `src/middleware.ts` — redirects at edge before page loads |
| **RLS Security** | Every table has Row Level Security; farmers can only edit their own rows |
| **Realtime Inventory** | Supabase Realtime WebSocket subscription on `products` table |
| **Escrow Orders** | Order status: `pending_payment` → `paid` → `shipped` → `completed` (on consumer confirm) |
| **Atomic Stock** | PostgreSQL function `decrement_stock()` prevents overselling under concurrent load |
| **Image Upload** | Direct to Supabase Storage from browser, URL saved in `products.images[]` |

---

## 🧪 Test Accounts (create via /auth/register)

- **Farmer account**: Register with role "Farmer" → logs in to `/dashboard`
- **Consumer account**: Register with role "Consumer" → logs in to `/marketplace`

---

## 📝 After Deploying

1. Go to **Supabase → Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL
3. Add **Redirect URL**: `https://your-app.vercel.app/**`
