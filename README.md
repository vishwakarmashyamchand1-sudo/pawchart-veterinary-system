# PawChart MERN System

PawChart is now a MERN app with a React client, Express API, and MongoDB data layer.

## Prerequisites

- Node.js 20+
- MongoDB Community Server installed and running locally, or a MongoDB Atlas connection string
- npm

## First-Time Setup After Cloning

Install dependencies for the root app, server, and client:

```bash
npm run install:all
```

Create the backend environment file:

```bash
copy server\.env.example server\.env
```

The default `server/.env` values are:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/pawchart
CLIENT_ORIGIN=http://localhost:3000
```

Start MongoDB before seeding. On Windows, if MongoDB is installed as a service, open an administrator terminal and run:

```powershell
net start MongoDB
```

If it says the service is already running, continue. If your MongoDB service has a different name, check it with:

```powershell
Get-Service *mongo*
```

If you use MongoDB Atlas instead of local MongoDB, edit `server/.env` and replace `MONGO_URI` with your Atlas connection string.

Seed the database:

```bash
npm run seed
```

Start the full app:

```bash
npm run dev
```

The app runs at:

- React client: http://localhost:3000
- Express API: http://localhost:5000/api

## Daily Development

After the first setup, make sure MongoDB is running, then start the app:

```bash
npm run dev
```

Run `npm run seed` again only when you want to reset the demo database.

## Project Structure

```text
client/   React + Vite frontend
server/   Express API, Mongoose models, seed data
```

## Scripts

- `npm run install:all` installs dependencies in the root, server, and client folders.
- `npm run dev` starts the API and React client together.
- `npm run server` starts only the API.
- `npm run client` starts only React.
- `npm run seed` resets and loads demo clinic data.
- `npm run build` builds the React production bundle.

## Troubleshooting

- If `net start MongoDB` says access is denied, run the terminal as administrator.
- If `net start MongoDB` says the service name is invalid, MongoDB may not be installed as a Windows service. Open MongoDB Compass or start your installed MongoDB server another way.
- If `npm run seed` cannot connect to `127.0.0.1:27017`, MongoDB is not running or `MONGO_URI` points to the wrong location.
