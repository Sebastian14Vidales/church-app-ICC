# ICC CASA DE DIOS Backend

This project is the backend for the ICC CASA DE DIOS application. It uses Node.js, Express, TypeScript, and MongoDB.

## Project Structure

```
ICC_CASA_DE_DIOS/
└── backend/
    ├── node_modules/
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    └── src/
        ├── config/
        │   └── db.ts         # MongoDB database connection
        ├── index.ts         # Server entry point
        └── server.ts        # Express app configuration
```

## Available Scripts

- `npm run dev`: Start the server in development mode using Nodemon and ts-node.

## Installation

1. Clone the repository.
2. Go to the `backend` directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set environment variables in a `.env` file inside the `backend` directory:
   ```env
   DATABASE_URL=your_mongodb_url
   PORT=3000
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Main Dependencies

- express
- mongoose
- dotenv
- colors

## Requirements

- Node.js >= 18
- MongoDB
