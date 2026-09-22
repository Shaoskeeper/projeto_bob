/**
 * DIO Explorer — MCP Streamable HTTP Transport
 *
 * Expõe o MCP Server do DIO Explorer via SSE (Server-Sent Events) sobre HTTP/HTTPS,
 * seguindo o protocolo MCP Streamable HTTP Transport:
 *   https://spec.modelcontextprotocol.io/specification/basic/transports/#streamable-http
 *
 * Endpoints registrados no Express app externo:
 *   POST /mcp/stream  →  abre sessão SSE e processa mensagens MCP
 *   DELETE /mcp/stream  →  encerra a sessão pelo sessionId
 *
 * O cliente (ex: Claude Desktop, Bob, outro LLM) deve:
 *   1. Fazer POST /mcp/stream com Accept: text/event-stream
 *   2. Ler os eventos SSE retornados (cada evento é um JSON-RPC message)
 *   3. Para enviar mensagens ao servidor, fazer POST /mcp/stream com o sessionId
 *      no header Mcp-Session-Id e o body JSON-RPC
 */

import express, { type Router, type Request, type Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { tools, toolHandlers } from './tools.js';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface SseSession {
  id: string;
  res: Response;
  createdAt: Date;
  lastActivity: Date;
}

// ─── Store de sessões ────────────────────────────────────────────────────────

const sessions = new Map<string, SseSession>();

// Limpeza de sessões inativas a cada 5 minutos (TTL: 30 min)
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity.getTime() > SESSION_TTL_MS) {
      console.error(`[SSE] Sessão expirada removida: ${id}`);
      session.res.end();
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ─── MCP Server interno ──────────────────────────────────────────────────────

function createMcpServer(): Server {
  const server = new Server(
    { name: 'dio-explorer-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Ferramenta desconhecida: ${name}`);
    }
    return await handler(args ?? {});
  });

  return server;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // Força flush do buffer (necessário com compression middleware)
  if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
    (res as Response & { flush: () => void }).flush();
  }
}

function sendJsonRpc(
  res: Response,
  id: unknown,
  result?: unknown,
  error?: { code: number; message: string },
): void {
  const msg = error
    ? { jsonrpc: '2.0', id, error }
    : { jsonrpc: '2.0', id, result };
  sendSseEvent(res, 'message', msg);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const sseRouter: Router = express.Router();

/**
 * POST /mcp/stream
 *
 * Comportamento dual:
 *   a) Se Accept: text/event-stream → cria nova sessão SSE e envia o sessionId
 *   b) Se header Mcp-Session-Id presente → encaminha mensagem JSON-RPC para a sessão
 */
sseRouter.post('/stream', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const acceptsSse = (req.headers.accept ?? '').includes('text/event-stream');

  // ── (a) Nova sessão SSE ────────────────────────────────────────────────────
  if (!sessionId && acceptsSse) {
    const id = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // desativa buffering no Nginx
    res.setHeader('Mcp-Session-Id', id);
    res.flushHeaders();

    const session: SseSession = { id, res, createdAt: new Date(), lastActivity: new Date() };
    sessions.set(id, session);
    console.error(`[SSE] Nova sessão: ${id}`);

    // Evento de boas-vindas com capabilities
    sendSseEvent(res, 'connected', {
      sessionId: id,
      server: 'dio-explorer-mcp',
      version: '1.0.0',
      capabilities: { tools: {} },
    });

    req.on('close', () => {
      console.error(`[SSE] Sessão encerrada pelo cliente: ${id}`);
      sessions.delete(id);
    });

    return;
  }

  // ── (b) Mensagem para sessão existente ────────────────────────────────────
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: `Sessão não encontrada: ${sessionId}` });
      return;
    }

    session.lastActivity = new Date();
    const { jsonrpc, id, method, params } = req.body ?? {};

    if (jsonrpc !== '2.0' || !method) {
      sendJsonRpc(session.res, id, undefined, { code: -32600, message: 'Requisição inválida' });
      res.status(202).end();
      return;
    }

    // Processar a mensagem usando uma instância temporária do MCP server
    try {
      if (method === 'tools/list') {
        sendJsonRpc(session.res, id, { tools });
        res.status(202).end();
        return;
      }

      if (method === 'tools/call') {
        const toolName: string = params?.name;
        const args = params?.arguments ?? {};
        const handler = toolHandlers[toolName as keyof typeof toolHandlers];

        if (!handler) {
          sendJsonRpc(session.res, id, undefined, {
            code: -32601,
            message: `Ferramenta não encontrada: ${toolName}`,
          });
          res.status(202).end();
          return;
        }

        const result = await handler(args);
        sendJsonRpc(session.res, id, result);
        res.status(202).end();
        return;
      }

      // Método desconhecido
      sendJsonRpc(session.res, id, undefined, {
        code: -32601,
        message: `Método não suportado: ${method}`,
      });
      res.status(202).end();
    } catch (err) {
      console.error('[SSE handler]', err);
      sendJsonRpc(session.res, id, undefined, {
        code: -32603,
        message: err instanceof Error ? err.message : 'Erro interno',
      });
      res.status(202).end();
    }

    return;
  }

  res.status(400).json({
    error: 'Para nova sessão envie Accept: text/event-stream; para mensagem inclua Mcp-Session-Id',
  });
});

/**
 * DELETE /mcp/stream
 * Header: Mcp-Session-Id: <id>
 * Encerra a sessão SSE e remove do store.
 */
sseRouter.delete('/stream', (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: 'Header Mcp-Session-Id ausente' });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: `Sessão não encontrada: ${sessionId}` });
    return;
  }

  session.res.end();
  sessions.delete(sessionId);
  console.error(`[SSE] Sessão encerrada por DELETE: ${sessionId}`);
  res.status(204).end();
});

/**
 * GET /mcp/sessions  (somente para admin / debug)
 * Retorna lista de sessões ativas.
 */
sseRouter.get('/sessions', (_req: Request, res: Response) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    lastActivity: s.lastActivity.toISOString(),
  }));
  res.json({ activeSessions: list.length, sessions: list });
});

// Re-exporta a factory para possíveis usos em testes
export { createMcpServer };

// Made with Bob
