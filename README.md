# 🚀 Baileys API

API REST em Node.js que automatiza o envio de mensagens de texto e documentos PDF via WhatsApp usando [Baileys](https://github.com/WhiskeySockets/Baileys), sem depender da WhatsApp Business API oficial. Pensada para notificações de baixo volume com custo mínimo de infraestrutura.

![Node.js version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-MVP-yellow)

## 📋 Índice

- [Sobre](#sobre)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Como Executar](#-como-executar)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Limitações Conhecidas](#-limitações-conhecidas)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

## 📖 Sobre

Integrações oficiais do WhatsApp (WhatsApp Business API / BSPs) custam a partir de ~R$1.250/mês, levam dias para aprovar e exigem verificação formal de número comercial — inviável para um volume baixo de notificações (boletos, avisos, comprovantes). Este projeto resolve isso expondo o [Baileys](https://github.com/WhiskeySockets/Baileys) (biblioteca que fala o protocolo do WhatsApp Web) como uma API REST simples, para ser consumida por qualquer sistema (ex: um back-end em C#) via HTTP.

**Principais funcionalidades:**
- CRUD de números de WhatsApp, cada um com sua própria sessão
- Autenticação por QR code (escaneado uma vez por número)
- Reconexão automática com backoff exponencial
- Envio de mensagens de texto
- Envio de documentos PDF via upload direto (`multipart/form-data`), sem precisar existir no servidor
- Documentação OpenAPI/Swagger automática

**Trade-off aceito:** Baileys não é oficial — existe risco de ban por detecção de automação, sem suporte formal da Meta. Veja [Limitações Conhecidas](#-limitações-conhecidas) e `escopo_projeto.md` para a análise completa.

## 🛠️ Tecnologias

- **[Node.js](https://nodejs.org/)** (20+) — runtime
- **[Express](https://expressjs.com/)** — framework HTTP
- **[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)** — protocolo do WhatsApp Web
- **[Pino](https://getpino.io/)** — logging estruturado
- **[Multer](https://github.com/expressjs/multer)** — upload de arquivos (memória, sem gravar em disco)
- **[QRCode](https://github.com/soldair/node-qrcode)** — geração de QR code em base64
- **[Swagger (OpenAPI 3)](https://swagger.io/)** — documentação interativa da API
- **Docker / Podman** — containerização

## Pré-requisitos

- Node.js 20 ou superior
- npm
- Docker ou Podman (opcional, para rodar em container)

## 📦 Instalação

```bash
git clone <url-do-repositorio>
cd baileys-api
npm install
cp .env.example .env
```

## ⚙️ Configuração

Variáveis de ambiente (arquivo `.env`, veja `.env.example`):

| Variável                  | Padrão      | Descrição                                          |
|----------------------------|-------------|-----------------------------------------------------|
| `PORT`                     | `3000`      | Porta HTTP do servidor                              |
| `NODE_ENV`                 | `development` | Ambiente de execução                              |
| `LOG_LEVEL`                | `info`      | Nível de log do Pino                                |
| `DATA_DIR`                 | `./data`    | Diretório do banco de dados JSON                    |
| `AUTH_DIR`                 | `./auth_info` | Diretório das credenciais Baileys por sessão      |
| `MAX_RECONNECT_ATTEMPTS`   | `5`         | Tentativas de reconexão antes de exigir novo QR code|
| `RECONNECT_BASE_DELAY_MS`  | `3000`      | Atraso base (ms) entre tentativas de reconexão      |

## ▶️ Como Executar

**Localmente:**

```bash
npm start        # producao
npm run dev       # com reload automatico (--watch)
```

Servidor disponível em `http://localhost:3000`.
Documentação Swagger em `http://localhost:3000/api-docs`.

**Com Docker/Podman:**

```bash
docker compose up -d --build
# ou
podman compose up -d --build
```

## 💡 Uso

Fluxo básico, do cadastro do número ao envio de mensagens:

1. **Criar número**

   ```bash
   curl -X POST http://localhost:3000/api/phones \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "5511999999999", "displayName": "Principal"}'
   ```

2. **Obter QR code** (aguarde alguns segundos após criar o número)

   ```bash
   curl http://localhost:3000/api/phones/{id}/qrcode
   ```

   Copie o valor de `data.qrCode` (data URI em base64) e abra em um navegador para renderizar a imagem, ou decodifique para um arquivo `.png`. Escaneie com o WhatsApp do celular (Aparelhos conectados → Conectar um aparelho) **rapidamente** — o QR code expira em segundos e é renovado automaticamente enquanto não conectar.

3. **Verificar status**

   ```bash
   curl http://localhost:3000/api/phones/{id}/status
   ```

4. **Enviar mensagem de texto**

   ```bash
   curl -X POST http://localhost:3000/api/messages/send \
     -H "Content-Type: application/json" \
     -d '{
       "phoneId": "{id}",
       "recipientPhone": "5511888888888",
       "message": "Ola! Seu boleto esta pronto."
     }'
   ```

5. **Enviar PDF** (upload direto, `multipart/form-data` — nenhum arquivo precisa existir no servidor)

   ```bash
   curl -X POST http://localhost:3000/api/messages/send-pdf \
     -F "phoneId={id}" \
     -F "recipientPhone=5511888888888" \
     -F "caption=Boleto para pagamento" \
     -F "file=@/caminho/local/boleto.pdf;type=application/pdf"
   ```

   O campo `file` contém o PDF em si (binário), enviado direto para o WhatsApp em memória. Limite de 100MB (limite do próprio WhatsApp).

## 🔌 API Endpoints

| Método | Rota                        | Descrição                            |
|--------|-----------------------------|----------------------------------------|
| POST   | `/api/phones`               | Cria número e inicia sessão            |
| GET    | `/api/phones`               | Lista números                          |
| GET    | `/api/phones/:id`           | Detalhes de um número                  |
| PUT    | `/api/phones/:id`           | Atualiza `displayName`                 |
| DELETE | `/api/phones/:id`           | Remove número e encerra sessão         |
| GET    | `/api/phones/:id/qrcode`    | Retorna QR code em base64              |
| GET    | `/api/phones/:id/status`    | Status de conexão                      |
| POST   | `/api/messages/send`        | Envia mensagem de texto                |
| POST   | `/api/messages/send-pdf`    | Envia documento PDF (upload direto)    |
| GET    | `/health`                   | Health check                           |
| GET    | `/api/status`               | Status geral (todos os números)        |
| GET    | `/api-docs`                 | Interface Swagger UI                   |
| GET    | `/api-docs.json`            | Especificação OpenAPI em JSON          |

Documentação interativa completa (schemas, exemplos de request/response) disponível em `/api-docs` com o servidor rodando.

## 📂 Estrutura do Projeto

```
baileys-api/
├── src/
│   ├── config/        # logger (pino) e swagger
│   ├── controllers/   # PhoneController, MessageController
│   ├── services/      # PhoneService, MessageService, SessionManager
│   ├── routes/        # systemRoutes, phoneRoutes, messageRoutes
│   └── index.js       # servidor Express
├── data/               # phones.json (banco de dados)
├── auth_info/          # credenciais Baileys por sessao
├── logs/
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## ⚠️ Limitações Conhecidas

- Sem autenticação (adicionar JWT antes de produção).
- Sem rate limiting.
- Banco de dados em JSON (adequado apenas para poucos números).
- Baileys não é oficial: risco de ban por detecção de automação.
- Suporta apenas texto e documentos PDF (sem imagem, áudio, vídeo, grupos).

Consulte `escopo_projeto.md` para o detalhamento completo do escopo, arquitetura e roadmap.

## 🤝 Contribuindo

1. Crie um branch a partir de `main`: `git checkout -b feature/minha-feature`
2. Faça as alterações e garanta que o servidor sobe sem erros (`npm start`)
3. Commit seguindo mensagens descritivas
4. Abra um Pull Request descrevendo o que mudou e por quê

## 📄 Licença

Distribuído sob a licença MIT. Veja o campo `license` em `package.json`.
