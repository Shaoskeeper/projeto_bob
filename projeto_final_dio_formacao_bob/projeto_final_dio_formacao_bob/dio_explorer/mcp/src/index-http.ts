#!/usr/bin/env node

/**
 * DIO Explorer MCP Server — Modo HTTP/HTTPS
 *
 * Entrypoint alternativo ao index.ts (stdio).
 * Inicia o servidor Express com:
 *   - REST API autenticada por JWT
 *   - SSO via Google e GitHub OAuth2
 *   - MCP-over-HTTP com SSE (Streamable HTTP Transport)  →  POST /mcp/stream
 *   - HTTPS opcional via certificados TLS
 *
 * Uso:
 *   node dist/index-http.js
 *   npm run start:http        (após npm run build dentro de /mcp)
 *
 * Variáveis de ambiente: veja .env.example
 */

import 'dotenv/config';
import { resolveOptions, startHttpServer } from './http-server.js';
import { authRouter, jwtMiddleware } from './auth.js';
import { apiRouter } from './routes.js';
import { sseRouter } from './streamable-transport.js';
import { tools } from './tools.js';

async function main() {
  const opts = resolveOptions();

  // Aviso de configuração de segurança
  if (opts.enableAuth && process.env.JWT_SECRET === 'TROQUE-ESTE-VALOR-EM-PRODUCAO') {
    console.error('[DIO MCP] ⚠️  AVISO DE SEGURANÇA: JWT_SECRET está com o valor padrão.');
    console.error('[DIO MCP]    Defina JWT_SECRET no arquivo .env antes de usar em produção!');
  }

  await startHttpServer(opts, authRouter, jwtMiddleware, apiRouter, sseRouter);

  console.error('[DIO MCP] Ferramentas registradas:');
  tools.forEach(tool => {
    console.error(`[DIO MCP]   • ${tool.name} — ${tool.description}`);
  });
}

main().catch((error) => {
  console.error('[DIO MCP] Erro fatal ao iniciar servidor HTTP:', error);
  process.exit(1);
});

// Made with Bob
