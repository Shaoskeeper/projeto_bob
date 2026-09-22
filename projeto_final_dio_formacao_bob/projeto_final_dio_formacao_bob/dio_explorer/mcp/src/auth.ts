/**
 * DIO Explorer — Auth Module
 *
 * Fornece:
 *   - Autenticação local com JWT (login por email/senha demo)
 *   - SSO via OAuth2 (Google e GitHub) — redirect flow
 *   - Middleware Express para validação de Bearer token
 *   - Router Express com as rotas /auth/...
 *
 * Em produção, substitua o store em memória por um banco de dados real.
 */

import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User, AuthToken } from './types.js';

// ─── Segredos e configurações ────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';

// ─── Store de usuários em memória (demo) ─────────────────────────────────────
// Para produção: substitua por consultas a banco de dados.

interface StoredUser extends User {
  passwordHash: string;
}

const userStore: StoredUser[] = [];

async function seedDemoUser() {
  if (userStore.length > 0) return;
  const hash = await bcrypt.hash('demo1234', 10);
  userStore.push({
    id: '1',
    email: 'demo@dio.me',
    nome: 'Usuário Demo',
    role: 'admin',
    passwordHash: hash,
  });
}
seedDemoUser().catch(console.error);

function findUserByEmail(email: string): StoredUser | undefined {
  return userStore.find(u => u.email.toLowerCase() === email.toLowerCase());
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function signToken(user: User): AuthToken {
  const payload = { sub: user.id, email: user.email, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  const expiresIn = JWT_EXPIRES_IN.endsWith('h')
    ? parseInt(JWT_EXPIRES_IN) * 3600
    : parseInt(JWT_EXPIRES_IN);
  return { token, expiresIn, user };
}

function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}

// ─── Middleware JWT ───────────────────────────────────────────────────────────

/**
 * Express middleware que valida o Bearer token no header Authorization.
 * Injeta `req.user` quando o token é válido.
 */
export const jwtMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    // Disponibiliza o payload no request para os handlers seguintes
    (req as Request & { user: jwt.JwtPayload }).user = payload;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token expirado'
      : 'Token inválido';
    res.status(401).json({ error: message });
  }
};

// ─── Auth Router ──────────────────────────────────────────────────────────────

export const authRouter: Router = express.Router();

/**
 * POST /auth/login
 * Body: { email, password }
 * Retorna: { token, expiresIn, user }
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: 'email e password são obrigatórios' });
    return;
  }

  const stored = findUserByEmail(String(email));
  if (!stored) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const valid = await bcrypt.compare(String(password), stored.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const { passwordHash: _, ...user } = stored;
  const authToken = signToken(user);
  res.json(authToken);
});

/**
 * POST /auth/refresh
 * Header: Authorization: Bearer <token>
 * Retorna novo token com prazo renovado.
 */
authRouter.post('/refresh', jwtMiddleware, (req: Request, res: Response) => {
  const payload = (req as Request & { user: jwt.JwtPayload }).user;
  const stored = userStore.find(u => u.id === payload.sub);
  if (!stored) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  const { passwordHash: _, ...user } = stored;
  res.json(signToken(user));
});

/**
 * GET /auth/me
 * Header: Authorization: Bearer <token>
 * Retorna os dados do usuário autenticado.
 */
authRouter.get('/me', jwtMiddleware, (req: Request, res: Response) => {
  const payload = (req as Request & { user: jwt.JwtPayload }).user;
  const stored = userStore.find(u => u.id === payload.sub);
  if (!stored) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  const { passwordHash: _, ...user } = stored;
  res.json(user);
});

// ─── SSO — Google OAuth2 ──────────────────────────────────────────────────────

/**
 * GET /auth/sso/google
 * Redireciona o browser para a página de consentimento do Google.
 */
authRouter.get('/sso/google', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(501).json({ error: 'Google SSO não configurado (GOOGLE_CLIENT_ID ausente)' });
    return;
  }
  const redirectUri = encodeURIComponent(`${PUBLIC_BASE_URL}/auth/sso/google/callback`);
  const scope = encodeURIComponent('openid email profile');
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scope}`;
  res.redirect(url);
});

/**
 * GET /auth/sso/google/callback
 * Recebe o code do Google, troca por token, cria/atualiza usuário local e retorna JWT.
 */
authRouter.get('/sso/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };

  if (!code) {
    res.status(400).json({ error: 'Parâmetro code ausente' });
    return;
  }

  try {
    // Trocar code por access_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${PUBLIC_BASE_URL}/auth/sso/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.status(401).json({ error: tokenData.error ?? 'Falha ao obter token do Google' });
      return;
    }

    // Buscar dados do usuário
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as { sub: string; email: string; name: string };

    // Upsert no store local
    let local = userStore.find(u => u.email === googleUser.email);
    if (!local) {
      local = {
        id: `google-${googleUser.sub}`,
        email: googleUser.email,
        nome: googleUser.name,
        role: 'user',
        passwordHash: '',
      };
      userStore.push(local);
    }

    const { passwordHash: _, ...user } = local;
    const authToken = signToken(user);
    res.json(authToken);
  } catch (err) {
    console.error('[SSO Google]', err);
    res.status(500).json({ error: 'Erro interno no SSO Google' });
  }
});

// ─── SSO — GitHub OAuth2 ─────────────────────────────────────────────────────

/**
 * GET /auth/sso/github
 * Redireciona o browser para a página de autorização do GitHub.
 */
authRouter.get('/sso/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    res.status(501).json({ error: 'GitHub SSO não configurado (GITHUB_CLIENT_ID ausente)' });
    return;
  }
  const redirectUri = encodeURIComponent(`${PUBLIC_BASE_URL}/auth/sso/github/callback`);
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=user:email`;
  res.redirect(url);
});

/**
 * GET /auth/sso/github/callback
 * Recebe o code do GitHub, troca por token, cria/atualiza usuário local e retorna JWT.
 */
authRouter.get('/sso/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };

  if (!code) {
    res.status(400).json({ error: 'Parâmetro code ausente' });
    return;
  }

  try {
    // Trocar code por access_token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${PUBLIC_BASE_URL}/auth/sso/github/callback`,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.status(401).json({ error: tokenData.error ?? 'Falha ao obter token do GitHub' });
      return;
    }

    // Buscar dados do usuário
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'DIOExplorer' },
    });
    const ghUser = await userRes.json() as { id: number; login: string; name: string; email?: string };

    const email = ghUser.email ?? `${ghUser.login}@github.local`;

    let local = userStore.find(u => u.email === email);
    if (!local) {
      local = {
        id: `github-${ghUser.id}`,
        email,
        nome: ghUser.name ?? ghUser.login,
        role: 'user',
        passwordHash: '',
      };
      userStore.push(local);
    }

    const { passwordHash: _, ...user } = local;
    const authToken = signToken(user);
    res.json(authToken);
  } catch (err) {
    console.error('[SSO GitHub]', err);
    res.status(500).json({ error: 'Erro interno no SSO GitHub' });
  }
});

// ─── Informações sobre providers disponíveis ──────────────────────────────────

/**
 * GET /auth/providers
 * Lista os providers de SSO configurados.
 */
authRouter.get('/providers', (_req: Request, res: Response) => {
  res.json({
    local: true,
    google: !!GOOGLE_CLIENT_ID,
    github: !!GITHUB_CLIENT_ID,
  });
});

// Made with Bob
