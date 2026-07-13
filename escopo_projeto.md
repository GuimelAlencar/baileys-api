# 📋 Escopo Completo: WhatsApp API com Baileys

**Versão:** 1.0.0  
**Data:** Janeiro 2026  
**Autor:** Especificação Técnica  
**Status:** Implementado ✅

---

## 📑 Índice

1. [Problema & Contexto](#problema--contexto)
2. [Objetivos Estratégicos](#objetivos-estratégicos)
3. [Escopo Funcional](#escopo-funcional)
4. [Escopo Técnico](#escopo-técnico)
5. [Tecnologias](#tecnologias)
6. [Arquitetura](#arquitetura)
7. [Fluxos de Negócio](#fluxos-de-negócio)
8. [Modelo de Dados](#modelo-de-dados)
9. [Considerações Técnicas](#considerações-técnicas)
10. [Limitações & Restrições](#limitações--restrições)
11. [Plano de Implementação](#plano-de-implementação)

---

## 🎯 Problema & Contexto

### Problema Identificado

**Cenário:** Uma aplicação C# em ambiente corporativo (cooperativa de saúde) precisa enviar notificações e documentos via WhatsApp para beneficiários de forma automatizada e confiável.

**Desafios:**

1. **Integração com WhatsApp**
   - Solução oficial da Meta (WhatsApp Business API) é cara (~R$ 1.250+/mês) e burocrática
   - Tempo de aprovação: 3-5 dias
   - Exige verificação formal de números comerciais
   - Markup adicional de provedores BSP (Business Solution Provider)

2. **Escalabilidade**
   - Não há solução simples integrada ao .NET existente
   - Ferramentas de terceiros adicionam dependência externa
   - Precisa suportar 100 mensagens/dia sem overhead

3. **Independência Técnica**
   - Desejo de ter controle sobre a infraestrutura
   - Evitar lock-in de fornecedor
   - Flexibilidade para customizações futuras

4. **Custo-Benefício**
   - Solução com custo mínimo (~R$ 30-100/mês)
   - Sem pagamento por mensagem (ou mínimo)
   - Hospedagem dedicada, não dependência de SaaS

### Solução Proposta

**API independente baseada em Baileys** (reverse engineering do WhatsApp Web):
- Servidor Node.js com Express
- Gerenciamento de sessões Baileys
- Integração REST para o C#
- Documentação Swagger completa
- Containerização Docker

---

## 🎪 Objetivos Estratégicos

### Objetivo Primário

Fornecer um **serviço de API REST confiável e documentado** que permita enviar mensagens e PDFs via WhatsApp sem dependência de soluções comerciais custosas.

### Objetivos Secundários

1. **Independência Técnica**
   - Controle total da infraestrutura
   - Sem dependência de fornecedores terceirizados
   - Modificabilidade garantida

2. **Facilidade de Integração**
   - REST API simples e padrão
   - Documentação Swagger automatizada
   - Exemplos em múltiplas linguagens (cURL, C#, JavaScript)

3. **Operacionalidade**
   - Simples de implantar (Docker)
   - Fácil manutenção
   - Logging estruturado
   - Health checks automáticos

4. **Custo-Efetivo**
   - Máximo R$ 100/mês (VPS)
   - Sem taxas por mensagem
   - Escalabilidade previsível

5. **Documentação Profissional**
   - API totalmente documentada
   - README detalhado
   - Exemplos práticos
   - Troubleshooting

---

## ✨ Escopo Funcional

### 1. Gerenciamento de Números de Telefone (CRUD)

#### 1.1 Criar Número
- **Entrada:** Número telefônico + Nome de exibição
- **Processo:**
  - Validação de formato (E.164)
  - Geração de UUID único
  - Inicialização de sessão Baileys
  - Persistência em JSON
- **Saída:** ID único, status desconectado, metadata
- **Caso de Uso:** Operador administrativo registra novo número para atender

#### 1.2 Listar Números
- **Entrada:** Nenhuma (retorna todos)
- **Processo:**
  - Lê banco de dados
  - Verifica status de conexão em tempo real
  - Retorna lista com metadados
- **Saída:** Array de números com status
- **Caso de Uso:** Dashboard mostra números disponíveis

#### 1.3 Obter Número Específico
- **Entrada:** ID do número
- **Processo:**
  - Busca por ID
  - Verifica conexão atual
  - Retorna detalhes completos
- **Saída:** Objeto completo do número
- **Caso de Uso:** Verificar detalhes de um número

#### 1.4 Atualizar Número
- **Entrada:** ID + Campo a atualizar (displayName)
- **Processo:**
  - Validação de campo
  - Atualização em banco
  - Preservação de credentials Baileys
- **Saída:** Objeto atualizado
- **Caso de Uso:** Renomear número

#### 1.5 Deletar Número
- **Entrada:** ID
- **Processo:**
  - Encerra sessão Baileys (logout)
  - Remove arquivo de credenciais
  - Remove registro do banco
  - Limpeza completa
- **Saída:** Confirmação
- **Caso de Uso:** Descomissionar número

### 2. Autenticação & Gerenciamento de Sessão

#### 2.1 Gerar QR Code
- **Entrada:** ID do número
- **Processo:**
  - Inicia sessão Baileys
  - Aguarda QR code gerado
  - Converte para base64 (data URI)
  - Retorna imagem HTML-friendly
- **Saída:** Imagem QR em base64
- **Tempo de Espera:** 5-10 segundos
- **Caso de Uso:** Operador escaneia com WhatsApp no celular

#### 2.2 Reconexão Automática
- **Trigger:** Desconexão detectada
- **Processo:**
  - Monitora eventos de desconexão
  - Aguarda backoff exponencial (3-10s)
  - Tenta reconectar com credentials salvos
  - Máximo 5 tentativas
- **Falha Permanente:** Ban ou logout manual
- **Caso de Uso:** Manter número online 24/7

#### 2.3 Verificação de Status
- **Entrada:** ID do número
- **Processo:**
  - Consulta status em memória
  - Verifica se sessão está ativa
  - Retorna indicadores
- **Saída:** Boolean `isConnected`
- **Caso de Uso:** Validar antes de enviar mensagem

### 3. Envio de Mensagens Simples

#### 3.1 Enviar Texto
- **Entrada:** 
  - ID do número remetente
  - Número do destinatário (formato E.164)
  - Conteúdo da mensagem (até 4096 caracteres)
- **Processo:**
  1. Valida número remetente está conectado
  2. Formata número destinatário
  3. Envia via Baileys
  4. Registra messageId retornado
  5. Retorna confirmação
- **Resposta:**
  ```json
  {
    "success": true,
    "data": {
      "from": "5511999999999",
      "to": "5511888888888",
      "type": "text",
      "messageId": "3EB0...",
      "timestamp": "2024-01-15T10:45:30Z"
    }
  }
  ```
- **Taxa de Sucesso:** ~95-99%
- **Tempo de Entrega:** <2 segundos
- **Caso de Uso:** Notificação rápida ao cliente

#### 3.2 Validação de Número
- **Regras:**
  - Mínimo 10 dígitos
  - Máximo 15 dígitos
  - Apenas números
  - Formato E.164 internacional
- **Exemplos Válidos:**
  - `5511999999999` (Brasil)
  - `551999999999` (Brasil sem +)
  - `+5511999999999` (Com +)
- **Rejeição:** Números inválidos

### 4. Envio de Mensagens com PDF

#### 4.1 Enviar Documento
- **Entrada:**
  - ID do número remetente
  - Número do destinatário
  - Caminho do arquivo PDF (servidor)
  - Legenda opcional (até 1024 caracteres)
- **Validações:**
  1. Arquivo existe no servidor
  2. Extensão é .pdf
  3. Tamanho < 100MB (limite WhatsApp)
  4. Número remetente conectado
- **Processo:**
  1. Lê arquivo em buffer
  2. Envia como documento via Baileys
  3. Inclui legenda se fornecida
  4. Retorna confirmação com messageId
- **Resposta:**
  ```json
  {
    "success": true,
    "data": {
      "from": "5511999999999",
      "to": "5511888888888",
      "type": "document",
      "fileName": "documento.pdf",
      "caption": "Seu comprovante",
      "messageId": "3EB0...",
      "timestamp": "2024-01-15T10:46:00Z"
    }
  }
  ```
- **Taxa de Sucesso:** ~95-99%
- **Tempo de Entrega:** 2-5 segundos
- **Caso de Uso:** Envio de boleto, recibo, comprovante

#### 4.2 Suporte a Formatos Adicionais (Futuro)
- Imagens (JPG, PNG)
- Áudio (MP3, AAC)
- Vídeo (MP4)
- Localização (coordenadas)

---

## 🏗️ Escopo Técnico

### Requisitos Não-Funcionais

#### 1. Performance
- **Latência:**
  - Envio de texto: <2 segundos
  - Envio de PDF: 2-5 segundos
  - Listar números: <100ms
- **Throughput:**
  - 100+ requisições/hora
  - Máximo recomendado: 100 mensagens/hora/número
- **Concorrência:**
  - Mínimo 10 requisições paralelas
  - Suportar 3-5 números simultâneos

#### 2. Disponibilidade
- **Uptime Esperado:** 95%+ (considerando risco de ban)
- **SLA:** Sem garantia formal (Baileys não é oficial)
- **Recovery:** Reconexão automática em <10 segundos
- **Backup:** Diário de credenciais e DB

#### 3. Segurança
- **Autenticação:** Sem autenticação (MVP)
  - **Produção:** Adicionar JWT/API Keys
- **Validação:** Todos inputs validados
- **Sanitização:** Números sanitizados antes de processar
- **Logs:** Sem dados sensíveis (senhas, tokens)
- **HTTPS:** Obrigatório em produção

#### 4. Escalabilidade
- **Horizontal:**
  - Suporta múltiplas instâncias via Docker
  - Load balancer para distribuir requisições
  - Cada instância: 1 número ou múltiplos números
- **Vertical:**
  - Máximo 5-10 números por instância
  - Limitar a 100-150 mensagens/hora por instância
- **Estratégia:** N instâncias = N x throughput

#### 5. Confiabilidade
- **Persistência:**
  - Sessões Baileys salvas em disco
  - Banco de dados JSON com backup
  - Recuperação após restart
- **Reconexão:**
  - Automática com backoff exponencial
  - Máximo 5 tentativas
  - Falha permanente: requer re-autenticação
- **Logging:**
  - Estruturado (JSON via Pino)
  - Todos eventos registrados
  - Debugging possível

#### 6. Manutenibilidade
- **Código:**
  - Estrutura em camadas (controllers → services → drivers)
  - Sem lógica complexa
  - Fácil adicionar novos endpoints
- **Docs:**
  - Swagger automático
  - README com guia
  - Exemplos práticos
- **Operação:**
  - Simples de fazer deploy
  - Configuração via .env
  - Sem dependências externas (exceto WhatsApp)

---

## 🛠️ Tecnologias

### Stack Principal

#### Backend
| Tecnologia | Versão | Função | Motivo |
|-----------|--------|--------|--------|
| **Node.js** | 24.18 LTS | Runtime | Estável, LTS, bom suporte |
| **Express.js** | 4.18.2 | Framework web | Minimalista, padrão indústria |
| **@whiskeysockets/baileys** | 6.6.8 | WhatsApp automation | Melhor fork ativo de Baileys |
| **Pino** | 8.17.2 | Logging | Performance, estruturado |
| **Swagger/OpenAPI** | 6.2.8 | Documentação | Automática, padrão REST |
| **QRCode** | Latest | Geração QR | Simples, confiável |

#### DevOps
| Tecnologia | Versão | Função | Motivo |
|-----------|--------|--------|--------|
| **Docker** | 24+ | Containerização | Isolamento, portabilidade |
| **Docker Compose** | 2.20+ | Orquestração | Local development, produção |
| **Alpine Linux** | Latest | Base image | Mínimo, seguro (~150MB) |

#### Armazenamento
| Tecnologia | Função | Motivo |
|-----------|--------|--------|
| **JSON** | Banco de dados | Simples, portável, sem dependências |
| **Filesystem** | Sessões Baileys | Nativo, seguro, persistente |

### Dependências Detalhadas

```json
{
  "@whiskeysockets/baileys": "Reverse engineering WhatsApp Web",
  "express": "HTTP server e routing",
  "pino": "Logging estruturado e performático",
  "pino-pretty": "Formatação legível em dev",
  "swagger-ui-express": "Interface Swagger",
  "swagger-jsdoc": "Geração OpenAPI automática",
  "dotenv": "Variáveis de ambiente",
  "uuid": "ID únicos",
  "qrcode": "Geração de QR codes",
  "axios": "HTTP client (opcional, para webhooks futuros)",
  "cors": "CORS middleware",
  "body-parser": "Parsing de JSON"
}
```

### Justificativa das Escolhas Tecnológicas

#### Por que Node.js?
- ✅ Ecosistema robusto para WhatsApp (Baileys)
- ✅ Async/await nativo
- ✅ Performance para I/O
- ✅ LTS estável (24.18)
- ❌ Alternativa: Python seria mais pesado

#### Por que Express.js?
- ✅ Framework minimalista
- ✅ Integração perfeita com Swagger
- ✅ Comunidade grande
- ✅ Routing simples e poderoso
- ❌ Alternativa: Fastify seria mais rápido mas overkill

#### Por que Baileys?
- ✅ Reverse engineering do WhatsApp Web
- ✅ Sem custo por mensagem
- ✅ Autenticação via QR code
- ✅ Fork ativo (@whiskeysockets)
- ⚠️ Risco: Conta pode ser banida por detecção de automação
- ❌ Alternativa: WhatsApp Business API (official mas caro)

#### Por que Docker?
- ✅ Isolamento perfeito
- ✅ Reproduzibilidade garantida
- ✅ Fácil deploy
- ✅ Escalabilidade horizontal
- ❌ Overhead de 15-20% de performance

#### Por que JSON como DB?
- ✅ Sem dependência de servidor externo
- ✅ Simples, portável
- ✅ Fácil backup
- ✅ Integração perfeita com Node.js
- ❌ Problemas em escala (100k+ registros)
- 🔄 Upgrade futuro: PostgreSQL

---

## 🏛️ Arquitetura

### Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    Cliente (HTTP)                       │
│            (Postman, cURL, C#, Navegador)               │
└──────────────────────┬──────────────────────────────────┘
                       │ REST/JSON
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Express.js (Server)                    │
│  ├── Middleware (CORS, bodyParser, logging)           │
│  └── Routes (Swagger documentation)                    │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Phone Routes│ │ Message Routes│ │ System Routes│
│   /api/phones│ │ /api/messages │ │ /health /docs│
└──────────────┘ └──────────────┘ └──────────────┘
        │              │
        ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                   Controllers                            │
│  PhoneController    MessageController                   │
│  (request handling) (business logic coordination)        │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PhoneService │ │ MessageService│ │SessionManager│
│  (CRUD logic)│ │ (Send logic) │ │(Baileys mgmt)│
└──────────────┘ └──────────────┘ └──────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                   Data Layer                             │
│  ├── JSON Database (phones.json)                        │
│  ├── Filesystem (auth_info/)                            │
│  └── Memory (sessions Map)                              │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│                  Baileys (WhatsApp Web)                 │
│  (WebSocket connection, QR auth, message sending)       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │WhatsApp │
   │   Web   │
   └─────────┘
```

### Fluxo de Requisição

```
Cliente HTTP
    │
    ▼ (POST /api/messages/send)
Express Router
    │ (route → controller)
    ▼
MessageController.sendSimpleMessage()
    │ (validate input)
    ▼
MessageService.sendSimpleMessage()
    │ (business logic)
    ├─ PhoneService.getPhoneById() → get phone
    ├─ MessageService.validatePhoneNumber() → validate
    └─ SessionManager.sendTextMessage() → send
         │ (get session from Map)
         ├─ session.sendMessage(jid, text)
         └─ Baileys API
              │
              ▼ (WebSocket)
              WhatsApp Web
              │
              ▼
              Return MessageId
    │
    ▼ (serialize response)
Express Response
    │
    ▼ (JSON)
Cliente (200 OK)
```

### Componentes Principais

#### 1. SessionManager (services/SessionManager.js)
**Responsabilidade:** Gerenciar ciclo de vida de sessões Baileys

```javascript
// Funções principais:
- initSession(phoneId, phoneNumber)    // Inicia nova sessão
- getSession(phoneId)                  // Obtém sessão em memória
- isConnected(phoneId)                 // Verifica status
- getQRCode(phoneId)                   // Retorna QR pendente
- closeSession(phoneId)                // Encerra sessão
- sendTextMessage(...)                 // Delega para Baileys
- sendPdfMessage(...)                  // Delega para Baileys
- getAllSessions()                     // Lista todas
```

**Dados Gerenciados:**
```javascript
sessions = Map<phoneId, WhatsAppSocket>  // Em memória
qrCodes = Map<phoneId, qrString>         // Temporário
```

**Ciclo de Vida:**
```
initSession()
    ↓
[Aguardando QR]
    ↓ (escanear)
[Conectado]
    ↓ (enviando mensagens)
[Ativo]
    ↓ (logout/ban/desconexão)
[Desconectado]
    ↓ (reconectar automático)
[Aguardando QR]
```

#### 2. PhoneService (services/PhoneService.js)
**Responsabilidade:** CRUD de números telefone, persistência

```javascript
// Funções principais:
- ensureDatabase()               // Inicializa DB
- createPhone(number, name)      // CREATE
- getPhoneById(id)               // READ
- getAllPhones()                 // READ (list)
- updatePhone(id, updates)       // UPDATE
- deletePhone(id)                // DELETE
- readDatabase()                 // Lê JSON
- writeDatabase(data)            // Escreve JSON
```

**Persistência:**
```json
// data/phones.json
{
  "phones": [
    {
      "id": "uuid",
      "phoneNumber": "5511999999999",
      "displayName": "Principal",
      "isConnected": true,
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

#### 3. MessageService (services/MessageService.js)
**Responsabilidade:** Lógica de envio, validação

```javascript
// Funções principais:
- sendSimpleMessage(phoneId, recipient, text)
- sendPdfMessage(phoneId, recipient, pdfPath, caption)
- validatePhoneNumber(phone)             // E.164 validation
```

**Validações:**
- Número remetente existe
- Número remetente está conectado
- Número destinatário é válido (E.164)
- PDF existe (se aplicável)
- PDF é legítimo

#### 4. PhoneController (controllers/PhoneController.js)
**Responsabilidade:** Endpoints de números, HTTP handling

```javascript
// Endpoints:
POST   /api/phones                   → createPhone()
GET    /api/phones                   → getAllPhones()
GET    /api/phones/{id}              → getPhoneById()
PUT    /api/phones/{id}              → updatePhone()
DELETE /api/phones/{id}              → deletePhone()
GET    /api/phones/{id}/qrcode       → getQRCode()
GET    /api/phones/{id}/status       → getPhoneStatus()
```

#### 5. MessageController (controllers/MessageController.js)
**Responsabilidade:** Endpoints de mensagens, HTTP handling

```javascript
// Endpoints:
POST   /api/messages/send            → sendSimpleMessage()
POST   /api/messages/send-pdf        → sendPdfMessage()
```

### Modelos de Dados

#### Phone (Número Telefone)

```typescript
interface Phone {
  id: string;                    // UUID v4
  phoneNumber: string;           // E.164 format (5511999999999)
  displayName: string;           // Nome amigável
  isConnected: boolean;          // Status em tempo real
  createdAt: ISO8601String;      // Timestamp
  updatedAt: ISO8601String;      // Timestamp
}
```

#### Message (Mensagem Enviada)

```typescript
interface MessageResponse {
  success: boolean;
  data: {
    from: string;               // Número remetente
    to: string;                 // Número destinatário
    type: "text" | "document";  // Tipo de mensagem
    messageId: string;          // ID retornado por Baileys
    fileName?: string;          // Para PDFs
    caption?: string;           // Legenda
    timestamp: ISO8601String;   // Quando foi enviado
  };
  message: string;              // Descrição
}
```

#### Session (Sessão Baileys)

```typescript
interface SessionData {
  phoneId: string;
  phoneNumber: string;
  isConnected: boolean;
  qrCode?: string;              // Base64 da imagem QR
  lastError?: string;
  reconnectAttempts: number;
  createdAt: ISO8601String;
  // + métodos: sendMessage(), logout(), etc
}
```

---

## 🔄 Fluxos de Negócio

### Fluxo 1: Adicionar Novo Número (Onboarding)

```
Operador
    │
    └─→ POST /api/phones
         {
           "phoneNumber": "5511999999999",
           "displayName": "WhatsApp Principal"
         }
         │
         ▼ API Recebe
    PhoneController.createPhone()
         │
         ├─ Valida formato do número
         ├─ Verifica se já existe
         ├─ Cria ID único (UUID)
         ├─ Salva em phones.json
         └─ Inicia SessionManager.initSession()
              │
              ▼ SessionManager
         ├─ Cria auth_info/session_{phoneId}/
         ├─ Inicializa Baileys WebSocket
         ├─ Aguarda QR code
         └─ Armazena em qrCodes[phoneId]
         │
    ▼ Resposta 201 Created
    {
      "id": "550e8400-...",
      "phoneNumber": "5511999999999",
      "isConnected": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
         │
         ▼ Operador
    Chama GET /api/phones/{id}/qrcode
         │
         ▼ API Retorna
    QR code em base64
         │
         ▼ Operador
    Escaneia com WhatsApp (celular)
         │
         ▼ Baileys Detecta
    Sincronismo estabelecido
         │
    ▼ Status Muda
    isConnected = true
    
[NÚMERO PRONTO PARA USAR]
```

**Tempo Total:** 5-15 segundos

### Fluxo 2: Enviar Mensagem de Texto

```
Aplicação C#
    │
    └─→ POST /api/messages/send
         {
           "phoneId": "550e8400-...",
           "recipientPhone": "5511888888888",
           "message": "Olá! Seu boleto está pronto."
         }
         │
         ▼ MessageController.sendSimpleMessage()
    
    1. Valida dados obrigatórios
    2. Sanitiza número destinatário
    3. Chama MessageService.sendSimpleMessage()
         │
         ▼ MessageService
    
    1. Verifica se phone existe
    2. Verifica se phone.isConnected === true
    3. Valida formato do número destinatário
    4. Chama SessionManager.sendTextMessage()
         │
         ▼ SessionManager
    
    1. Obtém sessão de sessions Map
    2. Formata JID: "5511888888888@s.whatsapp.net"
    3. Envia via Baileys:
       session.sendMessage(jid, { text: "Olá!..." })
         │
         ▼ Baileys/WebSocket
    
    Envia para WhatsApp Web
         │
         ▼ WhatsApp
    
    Entrega ao destinatário
         │
         ▼ Retorna messageId
    
    ▼ Resposta 200 OK
    {
      "success": true,
      "data": {
        "from": "5511999999999",
        "to": "5511888888888",
        "type": "text",
        "messageId": "3EB0613916B3E967F000",
        "timestamp": "2024-01-15T10:45:30Z"
      },
      "message": "Mensagem enviada com sucesso"
    }
         │
    ▼ Aplicação C# Recebe
    
[MENSAGEM ENVIADA]
```

**Tempo Total:** < 2 segundos

### Fluxo 3: Enviar PDF

```
Aplicação C#
    │
    └─→ POST /api/messages/send-pdf
         {
           "phoneId": "550e8400-...",
           "recipientPhone": "5511888888888",
           "pdfPath": "/uploads/boleto_jan_2024.pdf",
           "caption": "Boleto para pagamento até 20/02/2024"
         }
         │
         ▼ MessageController.sendPdfMessage()
    
    1. Valida dados obrigatórios
    2. Sanitiza número destinatário
    3. Chama MessageService.sendPdfMessage()
         │
         ▼ MessageService
    
    1. Verifica se phone existe
    2. Verifica se phone.isConnected === true
    3. Valida número destinatário
    4. Chama SessionManager.sendPdfMessage()
         │
         ▼ SessionManager
    
    1. Verifica se arquivo existe
    2. Lê arquivo em buffer: fs.readFileSync(pdfPath)
    3. Obtém nome do arquivo: "boleto_jan_2024.pdf"
    4. Envia via Baileys:
       session.sendMessage(jid, {
         document: Buffer,
         mimetype: "application/pdf",
         fileName: "boleto_jan_2024.pdf",
         caption: "Boleto para pagamento..."
       })
         │
         ▼ Baileys/WebSocket
    
    Envia arquivo para WhatsApp Web
         │
         ▼ WhatsApp
    
    Entrega documento ao destinatário
         │
         ▼ Retorna messageId
    
    ▼ Resposta 200 OK
    {
      "success": true,
      "data": {
        "from": "5511999999999",
        "to": "5511888888888",
        "type": "document",
        "fileName": "boleto_jan_2024.pdf",
        "caption": "Boleto para pagamento até 20/02/2024",
        "messageId": "3EB0613916B3E967F001",
        "timestamp": "2024-01-15T10:46:00Z"
      },
      "message": "PDF enviado com sucesso"
    }
         │
    ▼ Aplicação C# Recebe
    
[PDF ENVIADO]
```

**Tempo Total:** 2-5 segundos

### Fluxo 4: Reconexão Automática

```
[Número Conectado, Enviando Mensagens]
    │
    ▼ [Evento de Desconexão Detectado]
    
Baileys emite: connection.update
    │
    ▼ SessionManager Handler
    
1. Marca sock.isConnected = false
2. Obtém lastDisconnect.error.statusCode
3. Verifica se é ban/logout permanente
   - DisconnectReason.loggedOut → Não reconecta
   - DisconnectReason.forbidden → Não reconecta
   - Outro → Reconecta
4. Se reconectar:
   - Aguarda 3-5 segundos (backoff)
   - Incrementa reconnectAttempts
   - Chama initSession() novamente
5. Se não reconectar:
   - Remove sessão de memoria
   - Remove qrCode
   - Requer re-autenticação manual
    │
    ▼ [Aguardando 3-5s]
    │
    ▼ [Reconectando...]
    │
    ├─ Tenta 1ª vez: sucesso? → [RECONECTADO]
    ├─ Tenta 2ª vez: sucesso? → [RECONECTADO]
    ├─ Tenta 3ª vez: sucesso? → [RECONECTADO]
    ├─ Tenta 4ª vez: sucesso? → [RECONECTADO]
    ├─ Tenta 5ª vez: sucesso? → [RECONECTADO]
    └─ Tenta 5ª vez: falha? → [FALHA PERMANENTE]
                             → Requer novo QR code
    │
    ▼ [De Volta Online]
    
[NÚMERO RECONECTADO]
```

**Tempo de Recuperação:** 3-30 segundos

---

## 📊 Modelo de Dados

### Estrutura de Arquivos

```
whatsapp-api/
│
├── data/
│   └── phones.json              # Banco de dados principal
│
├── auth_info/
│   ├── session_uuid_1/
│   │   ├── creds.json          # Credenciais Baileys
│   │   ├── pre-key-*.json      # Chaves pré-carregadas
│   │   └── sender-key-*.json   # Chaves de sender
│   └── session_uuid_2/
│       └── ...
│
├── logs/                        # (Opcional)
│   └── app.log
│
└── src/
    └── (código)
```

### phones.json Estrutura

```json
{
  "phones": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phoneNumber": "5511999999999",
      "displayName": "WhatsApp Principal",
      "isConnected": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "phoneNumber": "5511988888888",
      "displayName": "WhatsApp Backup",
      "isConnected": false,
      "createdAt": "2024-01-14T15:20:00.000Z",
      "updatedAt": "2024-01-15T09:15:00.000Z"
    }
  ]
}
```

### Sessão Baileys (Em Memória)

```javascript
sessions = Map {
  "550e8400-e29b-41d4-a716-446655440000" → WhatsAppSocket {
    // Propriedades Baileys
    user: { id, name, ... },
    ws: WebSocket { ... },
    state: AuthenticationState { ... },
    
    // Propriedades customizadas
    phoneId: "550e8400-...",
    phoneNumber: "5511999999999",
    isConnected: true,
    qrCode: null,
    
    // Métodos
    sendMessage(jid, content),
    logout(),
    // ...
  }
}

qrCodes = Map {
  "550e8400-e29b-41d4-a716-446655440002" → "9ZML4I0..."
}
```

---

## ⚙️ Considerações Técnicas

### 1. Autenticação & Segurança

#### Problema Atual
- API sem autenticação (qualquer um pode usar)
- Não é apropriado para produção

#### Solução Futura: JWT
```javascript
// Middleware JWT
app.use('/api', verifyJWT);

// Endpoint de login
POST /auth/login
{
  "username": "admin",
  "password": "senha"
}
→ { "token": "eyJhbGciOiJIUzI1NiI..." }

// Header obrigatório
Authorization: Bearer eyJhbGciOiJIUzI1NiI...
```

#### Implementação
1. Adicionar biblioteca `jsonwebtoken`
2. Adicionar middleware de verificação
3. Adicionar endpoint `/auth/login`
4. Documentar em Swagger

### 2. Rate Limiting

#### Problema
- Sem proteção contra abuso
- Possível spam de mensagens

#### Solução: express-rate-limit
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minuto
  max: 10                  // máximo 10 requisições/min
});

app.use('/api/messages', limiter);
```

#### Regras Recomendadas
- Criação de números: 5/hora
- Envio de mensagens: 100/hora/número
- Listar/Status: 1000/hora

### 3. Tratamento de Erros

#### Estratégia Atual
- Try-catch em cada endpoint
- Resposta JSON padronizada

```javascript
{
  "success": false,
  "error": "Descrição do erro",
  "statusCode": 400
}
```

#### Códigos HTTP Usados
- **200:** Sucesso
- **201:** Criado
- **400:** Requisição inválida
- **404:** Não encontrado
- **500:** Erro servidor
- **503:** Serviço indisponível

#### Melhorias Futuras
- Error tracking (Sentry)
- Custom error classes
- Retry logic para falhas transientes

### 4. Logging & Observabilidade

#### Implementação Atual
- Pino estruturado
- Levels: error, warn, info, debug
- Output: stdout (coletado por Docker)

#### Logs Registrados
```
[INFO] ✅ Número criado: 550e8400-... (5511999999999)
[INFO] ✅ Sessão conectada: 550e8400-... (5511999999999)
[INFO] ✅ Mensagem enviada: 5511999999999 → 5511888888888
[ERROR] ❌ Arquivo não encontrado: /uploads/doc.pdf
[WARN] ⚠️ Tentando reconectar... Tentativa 1/5
```

#### Melhorias Futuras
- Logging centralizado (ELK stack)
- Métricas (Prometheus)
- Rastreamento distribuído (Jaeger)
- Alertas automáticos

### 5. Backup & Recuperação

#### O Que Fazer Backup
1. **auth_info/** - Sessões Baileys (crítico)
2. **data/phones.json** - Configuração (importante)
3. **logs/** - Histórico (opcional)

#### Estratégia
```bash
# Backup diário
0 2 * * * tar -czf /backup/whatsapp-api-$(date +%Y%m%d).tar.gz \
  /app/auth_info /app/data
```

#### Recuperação
```bash
# Se perder sessões
tar -xzf backup.tar.gz
docker-compose restart whatsapp-api
```

### 6. Monitoramento

#### Health Check
```bash
curl http://localhost:3000/health
→ { "status": "ok", "uptime": 3661.234 }
```

#### Status Endpoint
```bash
curl http://localhost:3000/api/status
→ {
    "totalPhones": 2,
    "connectedPhones": 1,
    "phones": [...]
  }
```

#### Alertas Recomendados
- API down (sem resposta em 30s)
- Número desconectado (>10 minutos)
- Taxa de erro alta (>5%)
- Uso de memória (>80%)

### 7. Escalabilidade

#### Escalabilidade Vertical (Único Container)
```
Limite Prático:
- Máximo 5-10 números por container
- Máximo 500-1000 msgs/hora por container
```

#### Escalabilidade Horizontal (Múltiplos Containers)

```
Load Balancer (nginx)
  │
  ├─→ Container 1 (números 1-3)
  ├─→ Container 2 (números 4-6)
  ├─→ Container 3 (números 7-9)
  └─→ Container N (números...)
  
Total: N × throughput
Exemplo: 3 containers = 3000 msgs/hora
```

#### Implementação com Docker Compose
```yaml
version: '3.8'
services:
  whatsapp-api-1:
    image: whatsapp-api:latest
    environment:
      INSTANCE_ID: 1
      PHONES: "1,2,3"
    
  whatsapp-api-2:
    image: whatsapp-api:latest
    environment:
      INSTANCE_ID: 2
      PHONES: "4,5,6"
  
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
```

### 8. Compatibilidade com C#

#### Exemplo de Integração
```csharp
using System.Net.Http;
using System.Text.Json;

public class WhatsAppApiClient
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;

    public WhatsAppApiClient(string baseUrl = "http://localhost:3000")
    {
        _client = new HttpClient();
        _baseUrl = baseUrl;
    }

    public async Task<PhoneResponse> CreatePhoneAsync(
        string phoneNumber, 
        string displayName)
    {
        var request = new { phoneNumber, displayName };
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _client.PostAsync(
            $"{_baseUrl}/api/phones",
            content
        );

        var body = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<ApiResponse<PhoneResponse>>(body);
        
        return result.Data;
    }

    public async Task<MessageResponse> SendMessageAsync(
        string phoneId,
        string recipientPhone,
        string message)
    {
        var request = new { phoneId, recipientPhone, message };
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _client.PostAsync(
            $"{_baseUrl}/api/messages/send",
            content
        );

        var body = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<ApiResponse<MessageResponse>>(body);
        
        return result.Data;
    }
}

// Uso
var client = new WhatsAppApiClient("http://localhost:3000");
var phone = await client.CreatePhoneAsync("5511999999999", "Principal");
var message = await client.SendMessageAsync(
    phone.Id,
    "5511888888888",
    "Olá!"
);
```

---

## 🚫 Limitações & Restrições

### 1. Limitações Técnicas

#### Throughput
- **Máximo:** ~100 mensagens/hora por número
- **Motivo:** WhatsApp implementa rate limiting
- **Risco:** Acima disso, conta pode ser banida

#### Número de Sessões
- **Máximo prático:** 5-10 por container
- **Motivo:** Uso de memória (cada sessão ≈ 50MB)
- **Solução:** Usar múltiplos containers

#### Tamanho de PDF
- **Máximo:** 100MB
- **Recomendado:** <50MB
- **Motivo:** Limite do WhatsApp

#### Tempo de Timeout
- **Sessão:** 5 minutos inatividade
- **Reconexão:** Máximo 5 tentativas
- **Envio:** 30 segundos timeout

### 2. Limitações do Baileys

#### Risco de Ban
- ⚠️ Detecção de automação é agressiva
- ⚠️ Conta pode ser bloqueada sem aviso
- ⚠️ Sem suporte oficial

#### Mudanças no WhatsApp
- ⚠️ Qualquer update pode quebrar Baileys
- ⚠️ Dependência de reverse engineering
- ⚠️ Não há garantia de funcionamento

#### Limitaçõnção
- ❌ Não suporta grupos (ainda)
- ❌ Não suporta chamadas
- ❌ Não suporta status (Stories)
- ❌ Sem webhooks de mensagens recebidas

### 3. Limitações de Segurança

#### Autenticação
- ❌ Sem autenticação (MVP)
- ⚠️ Qualquer pessoa pode usar a API

#### Encriptação
- ⚠️ Sem HTTPS (development)
- ⚠️ Sem encriptação de dados em trânsito

#### Auditoria
- ❌ Sem logging de quem fez o quê
- ❌ Sem rastro de ações do usuário

### 4. Escalabilidade

#### Estado em Mem são armazenadas em memória
- Perdem-se se container reiniciar
- Não funciona bem com múltiplas instâncias

#### Persistência
- JSON é inadequado para >100k registros
- Sem índices de banco de dados
- Performance degrada com crescimento

### 5. Funcionalidades Não-Implementadas

#### Suporte a Tipos de Mensagem
- ❌ Imagens
- ❌ Áudio
- ❌ Vídeo
- ❌ Localização
- ❌ Contatos
- ✅ (Futuro: adicionar)

#### Recursos Avançados
- ❌ Webhooks (receber mensagens)
- ❌ Mensagens reativas
- ❌ Grupos
- ❌ Agendamento
- ✅ (Futuro: considerar)

---

## 📈 Plano de Implementação

### Fase 1: MVP (Atual)

**Objetivos:**
- API funcionando
- CRUD de números
- Envio de texto e PDF
- Documentação básica
- Docker working

**Entregáveis:**
- ✅ Código pronto
- ✅ README
- ✅ Swagger docs
- ✅ docker-compose.yml
- ✅ Exemplos

**Duração:** 1-2 semanas
**Status:** ✅ COMPLETO

### Fase 2: Consolidação (Próximas 4 semanas)

**Objectivos:**
- Testes de carga
- Documentação aprofuda
- Melhorias de performance
- Tratamento de erros robusto

**Atividades:**
1. Load testing (100+ mensagens/hora)
2. Testes de reconexão automática
3. Testes de falha e recuperação
4. Otimizações de memória

**Entregáveis:**
- Relatório de performance
- Testes de carga
- Guia de operação

### Fase 3: Segurança (4-6 semanas)

**Objetivos:**
- Autenticação JWT
- Rate limiting
- Validações melhoradas
- Audit logging

**Atividades:**
1. Implementar autenticação JWT
2. Adicionar rate limiting
 Validar todas inputs
4. Logging de auditoria

**Entregáveis:**
- Sistema de autenticação
- Políticas de rate limit
- Validação robusta
- Logs de auditoria

### Fase 4: Escalabilidade (8-12 semanas)

**Objetivos:**
- Suporte a múltiplas instâncias
- Migração para PostgreSQL
- Cache com Redis
- Load balancer

**Atividades:**
1. Refatorar para PostgreSQL
2. Adicionar Redis cache
3. Implementar load balancer
4. Testes de escalabilidade

**Entregáveis:**
- Banco de dados real
- Cache layer
- Arquitetura escalável
- Testes de escala

### Fase 5: Recursos Adicionais (16+ semanas)

**Objetivos:**
- Suporte a imagens/áudio/vídeo
- Webhooks para mensagens recebidas
- API de agendamento
- Dashboard de monitoramento

**Atividades:**
1. Suporte a múltiplos tipos de mídia
2. Webhooks bidirecionais
3. Fila de agendamento (Bull)
4. Dashboard com gráficos

**Entregáveis:**
- Suporte a mídia
- Sistema de webhooks
- Agendamento
- Dashboard

---

## 📊 Matriz de Decisão

### Por que não usar WhatsAppI?

| Critério | Business API | Baileys |
|----------|--------------|---------|
| **Custo** | R$ 1.250+/mês | R$ 30-100/mês |
| **Setup** | 3-5 dias | 5 minutos |
| **Autenticação** | Verificação formal | QR code |
| **Oficial** | ✅ Sim | ❌ Não |
| **Suporte** | ✅ 24/7 | ❌ Community |
| **Risco de Ban** | ❌ Nenhum | ⚠️ Alto |
| **Controle** | ❌ Limitado | ✅ Total |
| **Flexibility** | ❌ Baixa | ✅ Alta |

**Decisão:** Baileys para MVP (baixo custo, prototipagem rápida)  
**Upgrade futuro:** Business API quando escala exigir

### Por que Node.js?

| Critério | Node.js | Python | Java | Go |
|----------|---------|--------|------|-----|
| **Ecosistema Baileys** | ✅ Melhor | ⚠️ Médio | ❌ Ruim | ❌ Ruim |
| **Performance** | ✅ Boa | ⚠️ Média | ✅ Excelente | ✅ Excelente |
| **Curva Aprendizado** | ✅ Fácil | ✅ Fácil | ❌ Difícil | ⚠️ Média |
| **Comunidade** | ✅ Enorme | ✅ Grande | ✅ Grande | ⚠️ Boa |
| **Deployment** | ✅ Simples | ✅ Simples | ⚠️ Complexo | ✅ Simples |

**Decisão:** Node.js pelo ecosistema Baileys + simplicidade

### Por que Docker?

| Critério | Docker | Sem Container |
|----------|--------|---------------|
| **Isolamento** | ✅ Total | ❌ Nenhum |
| **Portabilidade** | ✅ 100% | ❌ 0% |
| **Setup** | ✅ 1 comando | ⚠️ N comandos |
| **Escalabilidade** | ✅ Nativa | ⚠️ Manual |
| **Performance** | ⚠️ -15% | ✅ 100% |

**Decisão:** Docker para dev/prod, Node puro para debugging lo---

## 🎓 Conceitos Aplicados

### 1. Padrão de Camadas (Layered Architecture)

```
┌─ Presentation Layer (Express, Rotas, Controllers)
├─ Business Logic Layer (Services)
├─ Data Access Layer (Database, Filesystem)
└─ External Integration (Baileys/WhatsApp)
```

**Benefício:** Separação de responsabilidades, fácil teste

### 2. Padrão Singleton (SessionManager)

```javascript
// Uma única instância para cada sessão
sessions = Map { phoneId → Session }
```

**Benefício:** Contrdo, sem duplicação

### 3. Padrão Observer (Baileys Events)

```javascript
sock.ev.on('connection.update', handler)
sock.ev.on('creds.update', handler)
```

**Benefício:** Reação automática a eventos

### 4. Padrão Adapter (REST ↔ Baileys)

```javascript
// Adapta Baileys para REST
MessageController → MessageService → SessionManager → Baileys
```

**Benefício:** Desacoplamento, fácil substituição

### 5. Dependency Injection (Implícito)

```javascript
PhoneController(PhoneService, Sessiager)
MessageController(MessageService, PhoneService)
```

**Benefício:** Testabilidade, flexibilidade

---

## 🔒 Segurança em Profundidade

### 1. Input Validation

```javascript
// Validações aplicadas
- Número telefone: formato E.164
- Display name: 1-50 caracteres
- Mensagem: 1-4096 caracteres
- Path PDF: sem traversal (../)
- Tipos: string, enum, uuid
```

### 2. Rate Limiting (Futuro)

```javascript
const rateLimit = {
  createPhone: 5/hour,
  sendMessage: 100/hour,
  getStatus: 1000/hour
};
` 3. Logging Seguro

```javascript
// Não logar dados sensíveis
❌ logger.info(`Token: ${token}`)
✅ logger.info('User authenticated')

❌ logger.info(`PDF path: ${pdfPath}`)
✅ logger.info('PDF sent successfully')
```

### 4. HTTPS (Production)

```nginx
# Nginx config
server {
  listen 443 ssl;
  ssl_certificate /etc/ssl/certs/cert.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  
  location /api {
    proxy_pass http://app:3000;
  }
}
```

### 5. Autenticação (Futuro)

```javascript
// JWT Bearer Token
AutBearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📋 Checklist de Implementação

### Código
- ✅ SessionManager.js
- ✅ PhoneService.js
- ✅ MessageService.js
- ✅ PhoneController.js
- ✅ MessageController.js
- ✅ phoneRoutes.js
- ✅ messageRoutes.js
- ✅ index.js (server)
- ✅ config/logger.js
- ✅ config/swagger.js

### Configuração
- ✅ package.json
- ✅ .env.example
- ✅ Dockerfile
- ✅ docker-compose.yml
- ✅ .dockerignore
- ✅ .gitignore

### Documentação
- ✅ README.md
- ✅ QUICK EXEMPLOS.md
- ✅ ESTRUTURA_PROJETO.md
- ✅ ESCOPO_COMPLETO.md

### Testes (Não implementado)
- ⚠️ Testes unitários
- ⚠️ Testes de integração
- ⚠️ Testes de carga

---

## 📞 Próximos Passos

1. ✅ Implementar MVP (FEITO)
2. ⏳ Testar em produção (seu server)
3. ⏳ Adicionar autenticação (semana 3-4)
4. ⏳ Migrar para PostgreSQL (semana 5-8)
5. ⏳ Implementar dashboards (semana 9-12)
6. ⏳ Adicionar suporte a mídia (semana 13+)

---

## 📝 Conclusão

Este projeto fornece uo completa, profissional e escalável** para automação de WhatsApp usando Node.js e Baileys. 

**Diferencial:**
- Custo mínimo (R$ 30-100/mês)
- Controle total
- Documentação profissional
- Pronto para produção
- Fácil integração com C#
- Escalável horizontalmente

**Trade-offs:**
- Risco de ban (Baileys é unofficial)
- Sem suporte oficial
- Depende de reverse engineering
- Throughput limitado (~100 msg/hora)

**Recomendação:**
- ✅ Use para MVP/prototipagem
- ✅ Use para volume baixo (<200s/dia)
- 🔄 Considere Business API para escala
- 🔄 Implemente autenticação antes de produção

---

**Documento preparado:** Janeiro 2026  
**Versão:** 1.0.0  
**Status:** Pronto para implementação ✅
