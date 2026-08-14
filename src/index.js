require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');
require('./config/database'); // initialize pool on startup
const swaggerSpec = require('./config/swagger');
const authenticate = require('./middleware/authenticate');
const systemRoutes = require('./routes/systemRoutes');
const phoneRoutes = require('./routes/phoneRoutes');
const messageRoutes = require('./routes/messageRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const PhoneService = require('./services/PhoneService');
const SessionManager = require('./services/SessionManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(bodyParser.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api-docs.json', (req, res) => {
  res.status(200).json(swaggerSpec);
});

app.use(systemRoutes);

app.use(authenticate);

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/api/phones', phoneRoutes);
app.use('/api/messages', messageRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota nao encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err }, 'Erro nao tratado');
  res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

async function start() {
  PhoneService.ensureDatabase();

  const phones = PhoneService.getAllPhones();
  for (const phone of phones) {
    SessionManager.initSession(phone.id, phone.phoneNumber).catch((err) => {
      logger.error({ err, phoneId: phone.id }, 'Falha ao restaurar sessao');
    });
  }

  app.listen(PORT, () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
    logger.info(`Documentacao Swagger disponivel em http://localhost:${PORT}/api-docs`);
    logger.info(`Especificacao OpenAPI (JSON) disponivel em http://localhost:${PORT}/api-docs.json`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
