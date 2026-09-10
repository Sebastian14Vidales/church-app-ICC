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
   FRONTEND_URL=http://localhost:5173
   JWT_SECRET=your_random_jwt_secret_min_32_chars
   JWT_EXPIRES_IN=1h
   ACTION_TOKEN_EXPIRES_SECONDS=3600
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_USER=your_mailtrap_user
   SMTP_PASS=your_mailtrap_password
   SMTP_SECURE=false
   MAIL_FROM=no-reply@icccasadedios.com
   APP_NAME=ICC Casa de Dios
   SUPERADMIN_EMAIL=superadmin@icccasadedios.com
   SUPERADMIN_PASSWORD=your_new_strong_superadmin_password
   ```

   - `JWT_SECRET` — secreto para firmar tokens de sesión (obligatorio).
   - `JWT_EXPIRES_IN` — tiempo de expiración del token de sesión (default `1h`).
   - `ACTION_TOKEN_EXPIRES_SECONDS` — tiempo de expiración de tokens de acción (default `3600`).
   - `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` — bootstrap del superadmin al arrancar el
     servidor. Si falta alguna de las dos, el bootstrap se omite con un `warning` en consola
     y no se crea ni actualiza el usuario superadmin (ADR-0016 D2). **En producción estas
     variables son obligatorias y la contraseña debe ser nueva y fuerte**; no reutilizar
     credenciales expuestas previamente en el historial de git (ADR-0016 D3).
5. Start the development server:
   ```bash
   npm run dev
   ```

## Main Dependencies

- express
- mongoose
- dotenv
- colors
- nodemailer

## Requirements

- Node.js >= 18
- MongoDB
