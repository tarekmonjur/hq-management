import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_SESSION_ABSOLUTE_EXPIRES_IN: Joi.string().default('30d'),
  JWT_ISSUER: Joi.string().default('hq-management-api'),
  JWT_AUDIENCE: Joi.string().default('hq-management-clients'),
  THROTTLER_TTL: Joi.number().default(60000),
  THROTTLER_LIMIT: Joi.number().default(60),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
});
