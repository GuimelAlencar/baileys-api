const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp API (Baileys)',
      version: '1.0.0',
      description:
        'API REST para gerenciar numeros de WhatsApp e enviar mensagens de texto e PDFs usando Baileys.',
    },
    servers: [{ url: '/', description: 'Servidor atual' }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
