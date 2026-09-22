# Certificados TLS para o DIO Explorer MCP Server

Esta pasta é o local sugerido para armazenar certificados TLS usados no modo HTTPS.
Os arquivos `.crt` e `.key` **não devem ser versionados** — adicione ao `.gitignore`.

---

## Opção 1 — Certificado self-signed (desenvolvimento local)

Requer OpenSSL instalado (disponível no macOS, Linux e Windows com Git Bash / WSL).

```bash
# Gera chave RSA 2048-bit e certificado auto-assinado válido por 365 dias
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -subj "/C=BR/ST=SP/L=Sao Paulo/O=DIO Explorer/CN=localhost"
```

Configure o `.env`:

```env
NODE_TLS_CERT=./certs/server.crt
NODE_TLS_KEY=./certs/server.key
```

> **Atenção:** Browsers e clientes HTTP irão exibir aviso de certificado não confiável.
> Para desenvolvimento isso é aceitável; para produção use Let's Encrypt (veja abaixo).

---

## Opção 2 — Certificado Let's Encrypt (produção)

### Com Certbot (Linux)

```bash
# Instale o certbot
sudo apt install certbot   # Ubuntu/Debian
sudo dnf install certbot   # Fedora/RHEL

# Gere o certificado para o seu domínio
sudo certbot certonly --standalone -d seudominio.com

# Os arquivos ficam em:
#   /etc/letsencrypt/live/seudominio.com/fullchain.pem  (cert)
#   /etc/letsencrypt/live/seudominio.com/privkey.pem    (key)
```

Configure o `.env`:

```env
NODE_TLS_CERT=/etc/letsencrypt/live/seudominio.com/fullchain.pem
NODE_TLS_KEY=/etc/letsencrypt/live/seudominio.com/privkey.pem
```

### Renovação automática

```bash
sudo certbot renew --pre-hook "npm run stop:http" --post-hook "npm run start:http"
```

---

## Opção 3 — Proxy reverso (recomendado para produção)

A forma mais simples em produção é **não usar TLS diretamente no Node.js**  
e delegar o HTTPS a um proxy reverso como **Nginx**, **Caddy** ou **Traefik**.

Neste caso, o servidor MCP roda em HTTP comum (sem NODE_TLS_CERT/KEY) e o proxy  
gerencia os certificados e a terminação TLS.

### Exemplo Caddy (mais simples)

```Caddyfile
seudominio.com {
    reverse_proxy localhost:3000
}
```

O Caddy obtém e renova certificados Let's Encrypt automaticamente.

### Exemplo Nginx

```nginx
server {
    listen 443 ssl;
    server_name seudominio.com;

    ssl_certificate     /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;

        # Necessário para SSE (Server-Sent Events)
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
```

---

## .gitignore

Adicione ao `.gitignore` do repositório para não expor chaves privadas:

```gitignore
mcp/certs/*.crt
mcp/certs/*.key
mcp/certs/*.pem
mcp/.env
```
