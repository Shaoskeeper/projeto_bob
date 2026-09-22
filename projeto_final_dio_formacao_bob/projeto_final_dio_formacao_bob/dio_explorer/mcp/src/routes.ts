/**
 * DIO Explorer — REST API Router
 *
 * Rotas disponíveis (todas protegidas por JWT — exceto se ENABLE_AUTH=false):
 *
 *   GET  /api/tools           → Lista todas as ferramentas MCP disponíveis
 *   POST /api/tools/:name     → Chama uma ferramenta pelo nome
 *   POST /api/mcp             → Endpoint MCP-over-HTTP (JSON-RPC 2.0 simplificado)
 *   GET  /api/info            → Informações sobre o servidor
 */

import express, { type Router, type Request, type Response } from 'express';
import { tools, toolHandlers } from './tools.js';

export const apiRouter: Router = express.Router();

// ─── GET /api/info ────────────────────────────────────────────────────────────

/**
 * Retorna metadados sobre o servidor MCP.
 */
apiRouter.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'dio-explorer-mcp',
    version: '1.0.0',
    description: 'MCP Server para o DIO Explorer — trilhas, desafios e certificados',
    transport: ['stdio', 'http'],
    toolCount: tools.length,
    tools: tools.map(t => t.name),
  });
});

// ─── GET /api/tools ───────────────────────────────────────────────────────────

/**
 * Lista todas as ferramentas MCP registradas com seus schemas.
 *
 * Exemplo de resposta:
 * [
 *   { name: "buscar_trilha", description: "...", inputSchema: { ... } },
 *   ...
 * ]
 */
apiRouter.get('/tools', (_req: Request, res: Response) => {
  res.json(tools);
});

// ─── GET /api/tools/:name ─────────────────────────────────────────────────────

/**
 * Retorna detalhes de uma ferramenta específica.
 */
apiRouter.get('/tools/:name', (req: Request, res: Response) => {
  const tool = tools.find(t => t.name === req.params.name);
  if (!tool) {
    res.status(404).json({ error: `Ferramenta não encontrada: ${req.params.name}` });
    return;
  }
  res.json(tool);
});

// ─── POST /api/tools/:name ────────────────────────────────────────────────────

/**
 * Chama uma ferramenta MCP e retorna o resultado.
 *
 * Body: qualquer JSON compatível com o inputSchema da ferramenta.
 *
 * Exemplo:
 *   POST /api/tools/buscar_trilha
 *   { "tecnologia": "Python" }
 *
 * Resposta de sucesso:
 *   {
 *     "success": true,
 *     "tool": "buscar_trilha",
 *     "result": { "content": [{ "type": "text", "text": "..." }] }
 *   }
 *
 * Resposta de erro de negócio (isError=true na ferramenta):
 *   { "success": false, "tool": "...", "result": { ... } }
 *
 * Resposta de erro HTTP (ferramenta não existe):
 *   { "error": "Ferramenta não encontrada: ..." }
 */
apiRouter.post('/tools/:name', async (req: Request, res: Response) => {
  const { name } = req.params;
  const handler = toolHandlers[name as keyof typeof toolHandlers];

  if (!handler) {
    res.status(404).json({ error: `Ferramenta não encontrada: ${name}` });
    return;
  }

  try {
    const result = await handler(req.body ?? {});
    const isError = (result as { isError?: boolean }).isError === true;
    res.status(isError ? 422 : 200).json({
      success: !isError,
      tool: name,
      result,
    });
  } catch (err) {
    console.error(`[API] Erro ao executar ${name}:`, err);
    res.status(500).json({
      success: false,
      tool: name,
      error: err instanceof Error ? err.message : 'Erro interno',
    });
  }
});

// ─── POST /api/mcp ────────────────────────────────────────────────────────────

/**
 * Endpoint MCP-over-HTTP com envelope JSON-RPC 2.0.
 *
 * Suporta os métodos:
 *   - tools/list   → retorna lista de ferramentas
 *   - tools/call   → chama uma ferramenta
 *
 * Exemplo tools/call:
 *   {
 *     "jsonrpc": "2.0",
 *     "id": 1,
 *     "method": "tools/call",
 *     "params": { "name": "buscar_trilha", "arguments": { "tecnologia": "Java" } }
 *   }
 */
apiRouter.post('/mcp', async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== '2.0' || !method) {
    res.status(400).json(jsonRpcError(id, -32600, 'Requisição inválida'));
    return;
  }

  try {
    if (method === 'tools/list') {
      res.json(jsonRpcResult(id, { tools }));
      return;
    }

    if (method === 'tools/call') {
      const toolName: string = params?.name;
      const args = params?.arguments ?? {};

      if (!toolName) {
        res.status(400).json(jsonRpcError(id, -32602, 'params.name é obrigatório'));
        return;
      }

      const handler = toolHandlers[toolName as keyof typeof toolHandlers];
      if (!handler) {
        res.status(404).json(jsonRpcError(id, -32601, `Ferramenta não encontrada: ${toolName}`));
        return;
      }

      const result = await handler(args);
      res.json(jsonRpcResult(id, result));
      return;
    }

    // Método desconhecido
    res.status(404).json(jsonRpcError(id, -32601, `Método não encontrado: ${method}`));
  } catch (err) {
    console.error('[MCP HTTP]', err);
    res.status(500).json(
      jsonRpcError(id, -32603, err instanceof Error ? err.message : 'Erro interno'),
    );
  }
});

// ─── Helpers JSON-RPC ─────────────────────────────────────────────────────────

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// Made with Bob
