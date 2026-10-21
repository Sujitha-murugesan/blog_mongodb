# BlogApp – Module 3: Database Integration (Express + MongoDB)

Full-stack blog app. Users and blog posts are stored in **MongoDB** (via Mongoose) and the frontend loads everything from the REST API.

## What's new in this module
- MongoDB connection with Mongoose (`config/db.js`)
- **User** and **Blog** schemas with validation (`models/`)
- Secure credential storage: bcrypt-hashed passwords, `select: false` on the password field, JWT auth
- All blogs fetched from the database (search, category filter, pagination)
- **Blog detail page** (`public/blog.html?id=<id>`) with edit/delete for the author
- Dashboard shows only your own posts, loaded from the database

## Setup

### 1. Get a MongoDB (pick one)
| Option | How |
|--------|-----|
| **MongoDB Atlas (cloud, free)** | Create a free cluster at mongodb.com/atlas → Database Access: add a user → Network Access: allow your IP → Connect → "Drivers" → copy the connection string into `MONGODB_URI` |
| **Docker** | `docker compose up -d` (uses `docker-compose.yml`), keep the default `MONGODB_URI` |
| **Local install** | Install MongoDB Community Server and start it; keep the default `MONGODB_URI` |

### 2. Run the app
```bash
npm install
# edit .env: set MONGODB_URI and a long random JWT_SECRET
npm run seed     # optional: demo user + 3 sample posts
npm start        # or: npm run dev
```
Open http://localhost:5000  (demo login after seeding: `demo@blogapp.com` / `demo1234`)

## Project structure
```
server.js              App entry: security middleware, routes, error handler, DB connect
config/db.js           Mongoose connection
models/User.js         name, email (unique), hashed password
models/Blog.js         title, content, category, author (ref User), timestamps
middleware/auth.js     JWT check, loads the user from MongoDB
routes/auth.js         register, login, me
routes/blogs.js        list, mine, detail, create, update, delete
scripts/seed.js        sample data
public/                frontend (HTML/CSS/JS) served by Express
  js/api.js            fetch() wrapper for the API
  js/app.js            page logic
  blog.html            single blog detail page
```

## REST API
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | – | Create account → token |
| POST | `/api/auth/login` | – | Login → token |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/blogs?search=&category=&page=&limit=` | – | List blogs (paginated) |
| GET | `/api/blogs/mine` | ✔ | Your blogs |
| GET | `/api/blogs/:id` | – | Single blog details |
| POST | `/api/blogs` | ✔ | Create blog |
| PUT | `/api/blogs/:id` | ✔ owner | Update blog |
| DELETE | `/api/blogs/:id` | ✔ owner | Delete blog |

Status codes: 200/201 success · 400 validation / bad id · 401 not logged in · 403 not the owner · 404 not found · 409 duplicate email.

## Security measures
- Passwords hashed with **bcrypt** (never stored or returned in plain text)
- Password field excluded from queries by default (`select: false`)
- Inputs coerced to strings → protects against NoSQL operator injection (`{"$ne": ""}`)
- Search text is regex-escaped
- `helmet` security headers, request body size limit, rate limiting on `/api/auth`
- Ownership checks on edit/delete; ObjectId validation on `:id`
- Frontend escapes all user content before rendering (XSS)
- Secrets live in `.env` (git-ignored) – **change `JWT_SECRET` before deploying**

## Troubleshooting
- *"Could not connect to MongoDB"* → check `MONGODB_URI`, that MongoDB is running, and (Atlas) that your IP is allowed and the password is URL-encoded.
- *Blank home page* → open the browser console / Network tab; make sure you opened http://localhost:5000, not the HTML file directly.

## Using Supabase instead?
This project uses MongoDB. If you prefer Supabase (Postgres), keep the frontend and routes' shapes, and replace `models/` + `config/db.js` with `@supabase/supabase-js` queries.
