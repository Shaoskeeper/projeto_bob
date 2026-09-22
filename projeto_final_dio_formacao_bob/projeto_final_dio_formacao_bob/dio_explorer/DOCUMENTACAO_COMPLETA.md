# 📚 Documentação Completa — DIO Explorer

> **Projeto Final da Formação IBM com Bob — Digital Innovation One (DIO)**
> Desenvolvido com IA assistida pelo IBM Bob (Cursor AI)

---

## Índice

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Arquitetura e Estrutura de Arquivos](#2-arquitetura-e-estrutura-de-arquivos)
3. [Camada 1 — Slash Commands (CLI)](#3-camada-1--slash-commands-cli)
4. [Camada 2 — MCP Server (stdio)](#4-camada-2--mcp-server-stdio)
5. [Camada 3 — MCP Server HTTP/HTTPS + SSO](#5-camada-3--mcp-server-httphttps--sso)
6. [Prompts Usados com o IBM Bob](#6-prompts-usados-com-o-ibm-bob)
7. [Guia de Instalação e Uso](#7-guia-de-instalação-e-uso)
8. [Modos de Uso](#8-modos-de-uso)
9. [Referência da API HTTP](#9-referência-da-api-http)
10. [Testes e Qualidade](#10-testes-e-qualidade)
11. [Dicas de Uso e Boas Práticas](#11-dicas-de-uso-e-boas-práticas)
12. [Insights para Futuros Profissionais](#12-insights-para-futuros-profissionais)
13. [Roadmap Futuro](#13-roadmap-futuro)

---

## 1. Visão Geral do Projeto

O **DIO Explorer** é um sistema educacional construído em **TypeScript/Node.js** que expõe funcionalidades da plataforma Digital Innovation One (DIO) em três camadas progressivas de acesso:

| Camada | Tecnologia | Acesso |
|--------|------------|--------|
| Slash Commands | TypeScript direto | Programático / CLI |
| MCP Server (stdio) | MCP SDK + Node.js | IBM Bob, Claude Desktop |
| MCP Server HTTP | Express + JWT + OAuth2 | API REST, HTTPS, SSO |

### O que o projeto faz

- **`/trilha <tecnologia>`** — Busca e exibe plano de estudos detalhado com módulos, badges, XP e fases de aprendizado
- **`/desafio <tecnologia> [nivel]`** — Gera desafios de código com requisitos, dicas e sistema de XP
- **`/certificado "<nome>" "<tecnologia>"`** — Emite certificados de conclusão em Markdown com código único de verificação
- **`listar_tecnologias`** — Lista as 20+ tecnologias disponíveis na plataforma

### Stack técnica

```
TypeScript 5.3      —  linguagem principal
Node.js ≥ 18        —  runtime
@modelcontextprotocol/sdk ^1.0  —  protocolo MCP
Express 4.18        —  servidor HTTP
Helmet 7 + CORS     —  segurança HTTP
jsonwebtoken 9      —  autenticação JWT
bcryptjs            —  hash de senhas
zod 3.22            —  validação de schemas
dotenv              —  variáveis de ambiente
```

---

## 2. Arquitetura e Estrutura de Arquivos

```
dio_explorer/
│
├── commands/                   # Camada 1 — Slash Commands
│   ├── index.ts                # Router principal: processarComando()
│   ├── trilha.ts               # Handler do /trilha
│   ├── desafio.ts              # Handler do /desafio
│   ├── certificado.ts          # Handler do /certificado
│   └── tests.ts                # Suite de testes integrada
│
├── data/
│   └── trilhas_dio.json        # Base de dados de trilhas (JSON estático)
│
├── docs/
│   └── certificados-emitidos/  # Certificados gerados automaticamente
│
├── tests/                      # Testes unitários e de integração
│   ├── trilha.test.ts
│   ├── desafio.test.ts
│   ├── certificado.test.ts
│   ├── run-all-tests.ts
│   └── fluxo-completo-java.ts
│
├── mcp/                        # Camadas 2 e 3 — MCP Server
│   ├── src/
│   │   ├── index.ts            # Entrypoint stdio (Camada 2)
│   │   ├── index-http.ts       # Entrypoint HTTP/HTTPS (Camada 3)
│   │   ├── tools.ts            # Definição das 4 ferramentas MCP
│   │   ├── services.ts         # Lógica de negócio (busca, desafio, certificado)
│   │   ├── types.ts            # Interfaces TypeScript
│   │   ├── auth.ts             # JWT middleware + SSO Google/GitHub
│   │   ├── routes.ts           # REST API router
│   │   ├── http-server.ts      # Servidor Express (HTTPS, CORS, Helmet)
│   │   └── streamable-transport.ts  # SSE transport (MCP over HTTP)
│   ├── certs/
│   │   └── README.md           # Guia de certificados TLS
│   ├── dist/                   # Código compilado (gerado por tsc)
│   ├── .env.example            # Template de variáveis de ambiente
│   ├── package.json
│   └── tsconfig.json
│
├── package.json
├── tsconfig.json
├── README.md
├── EXEMPLOS.md
├── RELATORIO_FINAL_TESTES.txt
└── DOCUMENTACAO_COMPLETA.md    # Este arquivo
```

---

## 3. Camada 1 — Slash Commands (CLI)

### Como funciona

A função central é [`processarComando(input: string)`](commands/index.ts) que:
1. Valida que o input começa com `/`
2. Extrai o comando e argumentos (com suporte a aspas)
3. Despacha para o handler correspondente
4. Retorna Markdown formatado

### Comandos disponíveis

#### `/trilha <tecnologia>`

```typescript
import processarComando from './commands';

const resultado = processarComando('/trilha Python');
// Retorna: Markdown com plano de estudos completo
```

**O que retorna:**
- Informações gerais (nível, módulos, XP, acesso vitalício)
- Badges disponíveis
- Lives ao vivo programadas
- Promoções ativas
- Plano de estudos em 3 fases (Fundamentos → Intermediário → Avançado)

#### `/desafio <tecnologia> [nivel]`

```typescript
const resultado = processarComando('/desafio JavaScript Intermediário');
// Nível pode ser: Básico (100 XP), Intermediário (250 XP), Avançado (500 XP)
```

**O que retorna:**
- Título e descrição do desafio
- Requisitos detalhados
- Dicas de resolução
- Exemplos de entrada/saída
- Recompensas em XP e badges

#### `/certificado "<nome>" "<tecnologia>"`

```typescript
const resultado = processarComando('/certificado "Maria Silva" "Python"');
// Gera arquivo em docs/certificados-emitidos/
```

**O que retorna:**
- Certificado completo em Markdown
- Código único de verificação (`DIO-{timestamp}-{random}`)
- Carga horária calculada automaticamente
- Arquivo salvo em `docs/certificados-emitidos/`

#### `/help`

```typescript
processarComando('/help'); // Lista todos os comandos com exemplos
```

### Usando comandos individualmente

```typescript
import {
  executarComandoTrilha,
  executarComandoDesafio,
  executarComandoCertificado
} from './commands';

const trilha = executarComandoTrilha('React');
const desafio = executarComandoDesafio('Java', 'Avançado');
const cert = executarComandoCertificado('João Silva', 'Node.js');
```

---

## 4. Camada 2 — MCP Server (stdio)

### O que é MCP

O **Model Context Protocol (MCP)** é um protocolo aberto da Anthropic que permite que agentes de IA (como IBM Bob, Claude, ChatGPT Plugins) se conectem a servidores externos e usem suas ferramentas de forma padronizada. É como um "USB" para habilidades de IA.

### Arquitetura stdio

```
IBM Bob / Claude Desktop
        │
        │  JSON-RPC 2.0 via stdin/stdout
        ▼
  MCP Server (Node.js)
        │
        ├── tools/list  → retorna as 4 ferramentas
        └── tools/call  → executa a ferramenta solicitada
                │
                └── services.ts → lógica de negócio → data/trilhas_dio.json
```

### Iniciar o servidor stdio

```bash
cd mcp
npm install
npm run build
npm start
# ou
node dist/index.js
```

### Registrar no IBM Bob

Adicione ao arquivo de configuração MCP do Bob (`~/.cursor/mcp.json` ou similar):

```json
{
  "mcpServers": {
    "dio-explorer": {
      "command": "node",
      "args": [
        "C:/caminho/completo/para/dio_explorer/mcp/dist/index.js"
      ]
    }
  }
}
```

### Registrar no Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dio-explorer": {
      "command": "node",
      "args": ["/caminho/completo/mcp/dist/index.js"]
    }
  }
}
```

### As 4 ferramentas MCP

| Ferramenta | Parâmetros | Descrição |
|---|---|---|
| `buscar_trilha` | `tecnologia: string` | Busca plano de estudos |
| `gerar_desafio` | `tecnologia: string`, `nivel?: string` | Gera desafio de código |
| `gerar_certificado` | `nome: string`, `tecnologia: string` | Emite certificado |
| `listar_tecnologias` | — | Lista tecnologias disponíveis |

---

## 5. Camada 3 — MCP Server HTTP/HTTPS + SSO

Esta camada expõe o mesmo servidor MCP via HTTP/HTTPS com autenticação JWT e SSO OAuth2, permitindo acesso remoto por qualquer cliente HTTP.

### Iniciar o servidor HTTP

```bash
cd mcp
cp .env.example .env
# Edite .env com suas configurações
npm run start:http
# ou em desenvolvimento:
npm run dev:http
```

### Configuração via .env

```env
# Porta e host
PORT=3000
HOST=0.0.0.0
PUBLIC_BASE_URL=http://localhost:3000

# CORS (separar origens por vírgula)
CORS_ORIGINS=http://localhost:3000,https://meusite.com

# JWT
ENABLE_AUTH=true
JWT_SECRET=seu-segredo-aqui-min-32-chars
JWT_EXPIRES_IN=8h

# TLS (opcional — deixe vazio para usar proxy reverso)
NODE_TLS_CERT=./certs/server.crt
NODE_TLS_KEY=./certs/server.key

# SSO Google
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret

# SSO GitHub
GITHUB_CLIENT_ID=seu-client-id
GITHUB_CLIENT_SECRET=seu-client-secret
```

### Fluxo de autenticação JWT

```
1. POST /auth/login  →  { email, password }
2. Recebe: { token, expiresIn, user }
3. Usa token no header: Authorization: Bearer <token>
4. Acessa: GET /api/tools, POST /api/tools/:name, etc.
```

### Fluxo SSO (OAuth2)

```
1. Redireciona o browser para:
   GET /auth/sso/google   (ou /auth/sso/github)

2. Usuário faz login no provedor

3. Provedor redireciona para callback:
   GET /auth/sso/google/callback?code=...

4. Servidor troca o code por access_token
   e retorna JWT próprio do sistema:
   { token, expiresIn, user }
```

### Transportes disponíveis

| Transporte | Endpoint | Protocolo | Uso |
|---|---|---|---|
| stdio | — | JSON-RPC via stdin/stdout | Bob, Claude Desktop |
| REST API | `POST /api/tools/:name` | HTTP/HTTPS | Qualquer cliente HTTP |
| JSON-RPC | `POST /api/mcp` | JSON-RPC 2.0 | Clientes MCP genéricos |
| SSE Stream | `POST /mcp/stream` | Server-Sent Events | Agentes de IA remotos |

---

## 6. Prompts Usados com o IBM Bob

Esta seção documenta os prompts reais utilizados durante o desenvolvimento, servindo como guia de como trabalhar efetivamente com IA no desenvolvimento de software.

### Prompt 1 — Criação inicial do projeto

> *"Crie um sistema de comandos slash em TypeScript para explorar trilhas, desafios e certificados da plataforma DIO. O sistema deve ter os comandos /trilha, /desafio e /certificado com uma base de dados em JSON."*

**Resultado:** Criação de toda a estrutura `commands/`, `data/trilhas_dio.json` e o sistema de parsing de comandos.

**O que o Bob fez:**
- Analisou o domínio do problema (plataforma educacional)
- Criou a estrutura de dados `trilhas_dio.json` com trilhas realistas
- Implementou o parser de comandos com suporte a argumentos entre aspas
- Adicionou tratamento de erros e mensagens de feedback

---

### Prompt 2 — Geração de testes unitários

> *"Crie testes unitários para todos os comandos do DIO Explorer com pelo menos 70% de cobertura. Teste casos de sucesso, erros e edge cases."*

**Resultado:** Suite completa com 101 testes, 100% de aprovação.

**O que o Bob fez:**
- Criou testes para `/trilha`, `/desafio` e `/certificado`
- Cobriu casos extremos (tecnologia inexistente, parâmetros vazios, case-insensitive)
- Gerou relatório de testes em `RELATORIO_FINAL_TESTES.txt`
- Criou teste de fluxo completo Java (trilha → desafio → certificado)

---

### Prompt 3 — Criação do MCP Server

> *"Quero que vc crie um mcp server do projeto recém clonado para que futuramente pessoas possam vir acessar por meio de um servidor https ou sso ou via api. use a pasta mcp para isso"*

**Resultado:** Servidor MCP completo com 5 novos arquivos TypeScript, autenticação JWT, SSO OAuth2 (Google + GitHub) e transporte SSE.

**O que o Bob fez:**
1. Leu e analisou todos os arquivos existentes antes de escrever qualquer código
2. Identificou que já havia uma estrutura MCP básica (stdio) na pasta `mcp/`
3. Planejou 3 camadas de transporte: stdio (existente), REST API, e SSE
4. Criou os arquivos na ordem correta para evitar dependências circulares:
   - `types.ts` (já existia, aproveitado)
   - `auth.ts` (novo — JWT + OAuth2)
   - `routes.ts` (novo — REST API)
   - `streamable-transport.ts` (novo — SSE)
   - `http-server.ts` (novo — Express + TLS)
   - `index-http.ts` (novo — entrypoint)
5. Atualizou `package.json` e corrigiu a vulnerabilidade de segurança no SDK
6. Validou o build com `tsc` antes de reportar conclusão

---

### Prompt 4 — Documentação completa

> *"Gostaria que você documentasse todo o projeto feito até o momento, com todos prompts usados, modos de uso, dicas de uso e insights para futuros profissionais que vão aprender com nosso projeto."*

**Resultado:** Este documento.

---

### Padrões de prompt que funcionaram bem

#### ✅ Contexto + objetivo + restrição
```
"Crie [o quê] para [para quem/onde] 
que [comportamento esperado]. 
Use [tecnologia/pasta específica]."
```

#### ✅ Iterativo — pedir extensão de algo existente
```
"Adicione [nova funcionalidade] ao [módulo existente]
mantendo compatibilidade com [o que já existe]."
```

#### ✅ Solicitar validação explícita
```
"Após criar, valide o build com tsc e corrija 
quaisquer erros de tipagem."
```

#### ❌ O que evitar
- Prompts vagos sem contexto do projeto
- Pedir múltiplas funcionalidades não relacionadas de uma vez
- Não especificar onde salvar os arquivos

---

## 7. Guia de Instalação e Uso

### Pré-requisitos

- **Node.js** 18+ ([download](https://nodejs.org))
- **npm** (incluso com Node.js)
- **TypeScript** (instalado automaticamente como devDependency)

### Instalação do projeto principal

```bash
# 1. Clone ou navegue até o projeto
cd dio_explorer

# 2. Instale dependências (se necessário)
npm install

# 3. Execute o exemplo de uso
npx ts-node exemplo-uso.ts
```

### Instalação do MCP Server

```bash
# 1. Entre na pasta mcp
cd mcp

# 2. Instale dependências
npm install

# 3. Compile
npm run build

# 4. Modo stdio (para IBM Bob / Claude Desktop)
npm start

# 5. Modo HTTP (para API remota)
cp .env.example .env
# Edite o .env com JWT_SECRET e configurações desejadas
npm run start:http
```

### Verificando a instalação

```bash
# Deve mostrar os 4 módulos compilados e mais
ls mcp/dist/
# auth.js  http-server.js  index-http.js  index.js
# routes.js  services.js  streamable-transport.js  tools.js  types.js

# Testar o servidor HTTP (em outro terminal)
npm run start:http
# Em outro terminal:
curl http://localhost:3000/health
```

---

## 8. Modos de Uso

### Modo 1 — Programático (TypeScript direto)

Ideal para integrar os comandos em outra aplicação Node.js.

```typescript
import processarComando from './commands';

// Comandos básicos
console.log(processarComando('/trilha Python'));
console.log(processarComando('/desafio Java Intermediário'));
console.log(processarComando('/certificado "Ana Paula" "React"'));
console.log(processarComando('/help'));

// Funções individuais
import { executarComandoTrilha } from './commands';
const markdown = executarComandoTrilha('DevOps');
```

### Modo 2 — Via IBM Bob (stdio MCP)

Após registrar o servidor no arquivo de configuração do Bob:

```
Você: "Busque informações sobre a trilha de Python"
Bob: [chama buscar_trilha automaticamente] → retorna plano de estudos

Você: "Gere um desafio avançado de React"
Bob: [chama gerar_desafio com nivel="Avançado"] → retorna desafio

Você: "Crie meu certificado. Meu nome é Carlos Mendes, estudei Java"
Bob: [chama gerar_certificado] → certificado salvo em docs/
```

### Modo 3 — Via REST API (HTTP)

```bash
# 1. Autenticar
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@dio.me","password":"demo1234"}'
# → { "token": "eyJ...", "expiresIn": 28800, "user": {...} }

# 2. Listar ferramentas
curl http://localhost:3000/api/tools \
  -H "Authorization: Bearer eyJ..."

# 3. Chamar uma ferramenta
curl -X POST http://localhost:3000/api/tools/buscar_trilha \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"tecnologia":"Python"}'

# 4. Verificar status (sem auth)
curl http://localhost:3000/health
```

### Modo 4 — Via JSON-RPC 2.0 (MCP over HTTP)

```bash
# Chamada no padrão MCP oficial
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "gerar_desafio",
      "arguments": {"tecnologia": "JavaScript", "nivel": "Básico"}
    }
  }'
```

### Modo 5 — Via SSE (Streaming para agentes IA remotos)

```bash
# 1. Abrir sessão SSE
curl -X POST http://localhost:3000/mcp/stream \
  -H "Authorization: Bearer eyJ..." \
  -H "Accept: text/event-stream" \
  --no-buffer
# → event: connected
# → data: {"sessionId":"uuid","server":"dio-explorer-mcp","capabilities":...}

# 2. Enviar mensagem para a sessão
curl -X POST http://localhost:3000/mcp/stream \
  -H "Authorization: Bearer eyJ..." \
  -H "Mcp-Session-Id: uuid-da-sessão" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 3. Encerrar sessão
curl -X DELETE http://localhost:3000/mcp/stream \
  -H "Authorization: Bearer eyJ..." \
  -H "Mcp-Session-Id: uuid-da-sessão"
```

### Modo 6 — Via SSO (Login com Google ou GitHub)

```bash
# 1. Verificar providers disponíveis
curl http://localhost:3000/auth/providers
# → {"local":true,"google":false,"github":false}

# 2. Iniciar fluxo SSO (abre no browser)
http://localhost:3000/auth/sso/google
http://localhost:3000/auth/sso/github

# 3. Callback retorna JWT automaticamente
# → {"token":"eyJ...","expiresIn":28800,"user":{...}}
```

---

## 9. Referência da API HTTP

### Endpoints públicos (sem autenticação)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Status do servidor |
| `POST` | `/auth/login` | Login com email/senha |
| `POST` | `/auth/refresh` | Renovar token |
| `GET` | `/auth/me` | Dados do usuário atual |
| `GET` | `/auth/providers` | Provedores SSO disponíveis |
| `GET` | `/auth/sso/google` | Inicia SSO Google |
| `GET` | `/auth/sso/google/callback` | Callback SSO Google |
| `GET` | `/auth/sso/github` | Inicia SSO GitHub |
| `GET` | `/auth/sso/github/callback` | Callback SSO GitHub |

### Endpoints protegidos (requer Bearer token)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/info` | Metadados do servidor MCP |
| `GET` | `/api/tools` | Lista todas as ferramentas |
| `GET` | `/api/tools/:name` | Detalhes de uma ferramenta |
| `POST` | `/api/tools/:name` | Executa uma ferramenta |
| `POST` | `/api/mcp` | Endpoint JSON-RPC 2.0 |
| `POST` | `/mcp/stream` | Abre sessão SSE ou envia mensagem |
| `DELETE` | `/mcp/stream` | Encerra sessão SSE |
| `GET` | `/mcp/sessions` | Lista sessões ativas |

### Resposta padrão de sucesso (`POST /api/tools/:name`)

```json
{
  "success": true,
  "tool": "buscar_trilha",
  "result": {
    "content": [
      { "type": "text", "text": "# 🎯 Plano de Estudos..." }
    ]
  }
}
```

### Resposta de erro

```json
{
  "success": false,
  "tool": "buscar_trilha",
  "error": "Tecnologia não encontrada: XYZ"
}
```

---

## 10. Testes e Qualidade

### Resultados da suite de testes

| Módulo | Testes | Aprovados | Taxa |
|--------|--------|-----------|------|
| `/trilha` | 40 | 40 | 100% |
| `/desafio` | 31 | 31 | 100% |
| `/certificado` | 30 | 30 | 100% |
| **Total** | **101** | **101** | **100%** |

- **Meta de cobertura:** 70%
- **Cobertura alcançada:** 100% ✅
- **Tempo de execução:** 0,17 segundos

### Executar os testes

```bash
# Todos os testes
npx ts-node tests/run-all-tests.ts

# Fluxo completo (trilha → desafio → certificado)
npx ts-node tests/fluxo-completo-java.ts

# Testes individuais
npx ts-node tests/trilha.test.ts
npx ts-node tests/desafio.test.ts
npx ts-node tests/certificado.test.ts
```

### O que foi testado

- **Casos de sucesso** — todas as tecnologias disponíveis
- **Casos de erro** — tecnologia inexistente, parâmetros vazios
- **Edge cases** — busca case-insensitive (`java`, `JAVA`, `JaVa`)
- **Geração de arquivos** — certificados salvos em disco
- **Fluxo completo** — do início ao fim com a trilha Java

---

## 11. Dicas de Uso e Boas Práticas

### Dicas para os slash commands

1. **Busca parcial funciona:** `/trilha java` encontra "Formação Java Developer"
2. **Case-insensitive:** `/trilha PYTHON` = `/trilha python` = `/trilha Python`
3. **Aspas para nomes com espaço:** `/certificado "Ana Paula Costa" "JavaScript"`
4. **Nível padrão é "todos":** `/desafio React` gera desafio com nível Intermediário

### Dicas para o MCP Server (IBM Bob)

1. **Seja específico na pergunta:** "Busque a trilha de React" é melhor que "fale sobre React"
2. **Fluxo natural de aprendizado:**
   ```
   "Quero aprender [tecnologia]"
   → Bob usa buscar_trilha automaticamente

   "Me dê um desafio [nível]"
   → Bob usa gerar_desafio

   "Gere meu certificado. Meu nome é [nome]"
   → Bob usa gerar_certificado
   ```
3. **Para ver as ferramentas disponíveis:** Pergunte "Que ferramentas você tem sobre DIO?"

### Dicas para a API HTTP

1. **Guarde o token:** Tokens expiram em 8h por padrão (configure `JWT_EXPIRES_IN`)
2. **Use `/auth/refresh` antes de expirar** para renovar sem novo login
3. **Desative auth em dev:** `ENABLE_AUTH=false` no `.env` para desenvolvimento local
4. **Monitore sessões SSE:** `GET /mcp/sessions` mostra sessões ativas
5. **Sessões SSE têm TTL de 30 min** de inatividade — envie pings periódicos

### Dicas para HTTPS/TLS

1. **Em desenvolvimento:** Use certificado self-signed (veja `mcp/certs/README.md`)
2. **Em produção:** Prefira um proxy reverso (Caddy, Nginx) com Let's Encrypt — mais simples e sem expor chaves privadas ao Node.js
3. **Caddy é a opção mais fácil:** Um arquivo `Caddyfile` de 3 linhas resolve tudo

### Dicas de segurança

1. **Troque o `JWT_SECRET`** antes de qualquer deploy — use no mínimo 64 chars aleatórios:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. **Nunca versione o `.env`** — adicione ao `.gitignore`
3. **Revise o `CORS_ORIGINS`** — não use `*` em produção

---

## 12. Insights para Futuros Profissionais

### O que este projeto ensina

#### 1. Arquitetura em camadas progressivas
O projeto demonstra como evoluir um sistema de forma incremental:
- Começar simples (funções TypeScript puras)
- Adicionar uma camada de protocolo (MCP stdio)
- Adicionar uma camada de rede (HTTP/HTTPS)
- Adicionar autenticação (JWT + OAuth2)

Cada camada é independente e pode ser usada sem as outras.

#### 2. Desenvolvimento assistido por IA (AI-Assisted Development)
O IBM Bob não apenas escreveu código — ele tomou **decisões de engenharia**:
- Leu e entendeu o projeto antes de escrever qualquer linha
- Identificou e corrigiu uma vulnerabilidade de segurança no SDK (0.5.0 → 1.0.0)
- Escolheu receber dependências por parâmetro em vez de importar diretamente, evitando dependências circulares
- Separou responsabilidades em arquivos distintos com propósito único

#### 3. O protocolo MCP é o futuro das integrações de IA
Assim como REST padronizou APIs web, MCP está padronizando como agentes de IA se conectam a sistemas externos. Aprender MCP hoje é equivalente a aprender REST em 2010.

#### 4. Segurança não é opcional
O projeto implementa segurança desde o início:
- Validação de entrada com Zod (dados não confiáveis nunca chegam ao negócio)
- Hashing de senhas com bcrypt (nunca armazenar senhas em texto)
- JWT para autenticação stateless (escalável)
- Helmet para headers HTTP seguros
- CORS configurável por ambiente

#### 5. TypeScript salva vidas (e horas de debug)
Todas as interfaces estão em `types.ts`. Quando você muda uma interface, o TypeScript aponta todos os lugares que precisam ser atualizados. Em JavaScript puro, esse bug apareceria em produção.

### Conceitos demonstrados no projeto

| Conceito | Onde está no código |
|----------|-------------------|
| Design Pattern: Router | `commands/index.ts` — `processarComando()` |
| Validação com schema | `mcp/src/tools.ts` — `buscarTrilhaSchema` (Zod) |
| Middleware pattern | `mcp/src/auth.ts` — `jwtMiddleware` |
| Dependency Injection | `mcp/src/http-server.ts` — recebe routers por parâmetro |
| Stateless auth (JWT) | `mcp/src/auth.ts` — `signToken()` / `verifyToken()` |
| OAuth2 Authorization Code Flow | `mcp/src/auth.ts` — SSO Google/GitHub |
| Server-Sent Events (SSE) | `mcp/src/streamable-transport.ts` |
| JSON-RPC 2.0 | `mcp/src/routes.ts` — `POST /api/mcp` |
| Graceful shutdown | `mcp/src/http-server.ts` — `SIGINT/SIGTERM` handlers |
| Session management | `mcp/src/streamable-transport.ts` — `Map<string, SseSession>` |

### O que estudar para ir além

1. **Aprofundar MCP:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
2. **Docker:** Containerizar o servidor HTTP para deploy fácil
3. **OpenAPI/Swagger:** Documentar a REST API com schema interativo
4. **Rate Limiting:** Proteger a API contra abuso (biblioteca `express-rate-limit` já instalada!)
5. **Banco de dados real:** Substituir o JSON estático por PostgreSQL ou MongoDB
6. **WebSockets:** Alternativa ao SSE para comunicação bidirecional
7. **CI/CD:** Automatizar testes e deploy com GitHub Actions
8. **Monitoramento:** Adicionar métricas com Prometheus + Grafana

### Perguntas para reflexão

- Como você escalaria este sistema para 10.000 usuários simultâneos?
- O que mudaria se os dados de trilhas viessem de uma API externa em vez de JSON local?
- Como você implementaria autorização por roles (admin vs. usuário)?
- Como você faria rollback de uma versão com bug em produção?

---

## 13. Roadmap Futuro

### Curto prazo
- [ ] Testes automatizados para o MCP Server HTTP (Jest + Supertest)
- [ ] Rate limiting nas rotas da API
- [ ] Documentação OpenAPI/Swagger gerada automaticamente
- [ ] Docker container (`Dockerfile` + `docker-compose.yml`)

### Médio prazo
- [ ] Banco de dados real (PostgreSQL) substituindo `trilhas_dio.json`
- [ ] Dashboard web para visualizar trilhas e progresso
- [ ] Webhooks para notificações em eventos (certificado emitido, desafio concluído)
- [ ] Cache Redis para respostas frequentes

### Longo prazo
- [ ] SSO Microsoft/LinkedIn (expandir provedores OAuth2)
- [ ] Integração real com a API da plataforma DIO
- [ ] Sistema de progresso e gamificação persistente
- [ ] Marketplace de extensões/plugins

---

<div align="center">

**Desenvolvido com ❤️ para a comunidade DIO**

*"O melhor código é aquele que outras pessoas conseguem entender e evoluir."*

🚀 **Continue aprendendo e construindo!** 🚀

</div>

---

*Made with IBM Bob — Formação IBM com Bob · DIO · 2026*
