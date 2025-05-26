import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'latest-science-mcp' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage patterns as documented in architecture
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logError = (message: string, meta?: any) => {
  logger.error(message, meta);
}; 