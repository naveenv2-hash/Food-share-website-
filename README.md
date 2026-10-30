# FoodShare — Community Food Surplus & Donation Website

FoodShare helps food donors share surplus food with NGOs, shelters, and community groups. This is a full-stack starter project with a responsive frontend, Express REST API, role-based accounts, donation listings, claims, and an admin view.

## Features

- Responsive landing page and donation cards
- Search donations by name, description, donor, or location
- Filter by category and availability
- Register/login with hashed passwords and JWT sessions
- Donor accounts can create and remove their own listings
- Recipient accounts can claim available donations
- Donors, recipients, and admins can mark eligible donations completed
- Admin dashboard can review users and toggle verification
- MongoDB persistence when configured; in-memory demo mode works without MongoDB
- Demo accounts and sample listings are created automatically

## Requirements

- Node.js 18+
- npm
- Optional: MongoDB for persistent data

## Run locally

1. Extract the ZIP and open the `foodshare-project` folder in VS Code.
2. Open a terminal in that folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Set a long random `JWT_SECRET` in `.env`. Leave `MONGO_URI` blank to try the demo mode.
6. Start the server:

   ```bash
   npm start
   ```

7. Visit `http://localhost:3000`.

### Demo accounts

All demo accounts use password `FoodShare123!`.

| Role | Email |
|---|---|
| Donor | `donor@foodshare.demo` |
| Recipient / NGO | `recipient@foodshare.demo` |
| Admin | `admin@foodshare.demo` |

**Demo mode note:** When `MONGO_URI` is blank, data is kept in memory and resets when the server stops. Set a MongoDB connection string in `.env` to keep accounts and listings between restarts.

## Publish to GitHub

1. Create a new empty repository on GitHub, e.g. `foodshare`.
2. Extract this ZIP and open a terminal inside the extracted folder.
3. Run:

   ```bash
   git init
   git add .
   git commit -m "Build FoodShare community donation platform"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/foodshare.git
   git push -u origin main
   ```

4. Replace `YOUR-USERNAME` with your GitHub username.
5. Do not upload `.env`, passwords, database credentials, or JWT secrets. `.gitignore` excludes `.env`.

## Deploying

The app is a Node.js web service. Deploy it to a Node-compatible host, configure `JWT_SECRET` and `MONGO_URI` as environment variables, and use the provider's assigned public URL. A database is recommended for any public deployment.

## API overview

- `GET /api/health` — service status
- `POST /api/auth/register` — create donor/recipient account
- `POST /api/auth/login` — login
- `GET /api/auth/me` — current user
- `GET /api/foods` — list/search/filter donations
- `POST /api/foods` — create donation (donor/admin)
- `POST /api/foods/:id/claim` — claim donation (recipient)
- `POST /api/foods/:id/complete` — mark donation completed (authorized user)
- `DELETE /api/foods/:id` — remove listing (owner/admin)
- `GET /api/dashboard` — role-aware dashboard data
- `GET /api/admin/users` — list users (admin)
- `PATCH /api/admin/users/:id/verify` — toggle verification (admin)

## Project structure

```text
foodshare-project/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Important project notes

- This is a student project starter, not a production food-safety or charity-verification service.
- Demo accounts are for local testing only. Change secrets and remove demo seeding before a real public launch.
- Before real-world use, add rate limiting, stronger validation, audit logging, email verification, secure cookie/session strategy, contact coordination, and formal food safety and recipient verification workflows.
- Food pickup deadlines and food safety details should always be confirmed by the donor and recipient.
