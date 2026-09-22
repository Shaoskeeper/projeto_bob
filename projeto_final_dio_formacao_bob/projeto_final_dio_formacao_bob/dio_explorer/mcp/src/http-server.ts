/**
 * DIO Explorer — HTTP/HTTPS Server
 *
 * Camada Express que expõe o MCP Server via:
 *   - REST API  →  GET /api/tools | POST /api/tools/:name
 *   - MCP-over-HTTP  →  POST /mcp  (Streamable HTTP transport)
 *   - SSO / JWT auth  →  /auth/login  |  /auth/sso/callback
 *   - HTTPS opcional via TLS (NODE_TLS_CERT + NODE_TLS_KEY)
 */

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
  type Router,
} from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';

export interface HttpServerOptions {
  port: number;
  host: string;
  tlsCert?: string;   // caminho para arquivo PEM de certificado
  tlsKey?: string;    // caminho para arquivo PEM de chave privada
  corsOrigins: string[];
  enableAuth: boolean;
}

/**
 * Lê opções a partir das variáveis de ambiente com fallbacks seguros.
 */
export function resolveOptions(): HttpServerOptions {
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    host: process.env.HOST ?? '0.0.0.0',
    tlsCert: process.env.NODE_TLS_CERT,
    tlsKey: process.env.NODE_TLS_KEY,
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map(s => s.trim()),
    enableAuth: process.env.ENABLE_AUTH !== 'false',
  };
}

/**
 * Cria e configura a aplicação Express.
 *
 * Os routers são recebidos como parâmetros para evitar importações circulares
 * e facilitar testes unitários.
 */
export function createApp(
  opts: HttpServerOptions,
  authRouter: Router,
  jwtMiddleware: express.RequestHandler,
  apiRouter: Router,
  sseRouter?: Router,
): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // necessário para SSE
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Sem origin = curl / Postman / SSE server-side — permitido
        if (!origin) return callback(null, true);
        if (opts.corsOrigins.includes('*') || opts.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));

  // ── Health-check público ──────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      server: 'dio-explorer-mcp',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      transports: ['stdio', 'http'],
      auth: opts.enableAuth,
      tls: !!(opts.tlsCert && opts.tlsKey),
    });
  });

  // ── Auth routes (públicas) ────────────────────────────────────────────────
  app.use('/auth', authRouter);

  // ── Proteção JWT para /api e /mcp ─────────────────────────────────────────
  if (opts.enableAuth) {
    app.use('/api', jwtMiddleware);
    app.use('/mcp', jwtMiddleware);
  }

  // ── REST API ─────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── MCP SSE transport (Streamable HTTP) ──────────────────────────────────
  if (sseRouter) {
    if (opts.enableAuth) app.use('/mcp', jwtMiddleware);
    app.use('/mcp', sseRouter);
  }

  // ── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[HTTP Error]', err.message);
    const status = err.message.startsWith('Origem não permitida') ? 403 : 500;
    res.status(status).json({ error: err.message ?? 'Erro interno' });
  });

  return app;
}

/**
 * Inicia o servidor HTTP ou HTTPS dependendo da presença de certificados TLS.
 */
export async function startHttpServer(
  opts: HttpServerOptions,
  authRouter: Router,
  jwtMiddleware: express.RequestHandler,
  apiRouter: Router,
  sseRouter?: Router,
): Promise<void> {
  const app = createApp(opts, authRouter, jwtMiddleware, apiRouter, sseRouter);

  let server: http.Server | https.Server;
  const hasTls =
    opts.tlsCert &&
    opts.tlsKey &&
    fs.existsSync(opts.tlsCert) &&
    fs.existsSync(opts.tlsKey);

  if (hasTls) {
    const tlsOptions = {
      cert: fs.readFileSync(opts.tlsCert!),
      key: fs.readFileSync(opts.tlsKey!),
    };
    server = https.createServer(tlsOptions, app);
    console.error(`[DIO MCP] HTTPS server iniciando em https://${opts.host}:${opts.port}`);
  } else {
    server = http.createServer(app);
    if (opts.tlsCert || opts.tlsKey) {
      console.error('[DIO MCP] ⚠️  Arquivos TLS especificados mas não encontrados — iniciando sem TLS.');
    }
    console.error(`[DIO MCP] HTTP server iniciando em http://${opts.host}:${opts.port}`);
  }

  await new Promise<void>((resolve) => {
    server.listen(opts.port, opts.host, () => {
      const proto = hasTls ? 'https' : 'http';
      console.error(`[DIO MCP] ✅  Servidor disponível`);
      console.error(`[DIO MCP]    Health → ${proto}://${opts.host}:${opts.port}/health`);
      console.error(`[DIO MCP]    Auth   → ${proto}://${opts.host}:${opts.port}/auth/login`);
      console.error(`[DIO MCP]    API    → ${proto}://${opts.host}:${opts.port}/api/tools`);
      console.error(`[DIO MCP]    MCP    → ${proto}://${opts.host}:${opts.port}/mcp`);
      resolve();
    });
  });

  const shutdown = () => {
    console.error('[DIO MCP] Encerrando servidor...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Made with Bob
