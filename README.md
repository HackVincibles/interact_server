# InteractAI Server

Backend server for InteractAI with Piston code execution integration.

## Prerequisites

- Node.js 18+
- npm or yarn
- Piston API Instance (public or self-hosted)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and set your Piston API URL:
```env
PISTON_API_URL=https://emkc.org/api/v2/piston
```

Note: The public Piston API at `emkc.org` is whitelisted. For production or unrestricted use, please self-host your own Piston instance.

## Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

- `POST /api/execute` - Execute code
- `GET /api/execute/languages` - Get supported languages
- `GET /health` - Health check

## Supported Languages

- JavaScript (Node.js)
- TypeScript
- Python 3
- Java
- C++
- C
- C#
- Go
- Rust
- PHP
- Ruby
- Swift

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PISTON_API_URL` | Piston API URL | https://emkc.org/api/v2/piston |
| `PORT` | Server port | 5000 |
| `CLIENT_URL` | CORS allowed origin | http://localhost:3000 |
| `NODE_ENV` | Environment mode | development |

## Security

- API key is kept server-side only
- Rate limiting is enabled
- CORS is configured for specific origins
- Request size limits are in place
