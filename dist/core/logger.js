import winston from 'winston';
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    defaultMeta: { service: 'latest-science-mcp' },
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});
// Usage patterns as documented in architecture
export const logInfo = (message, meta) => {
    logger.info(message, meta);
};
export const logWarn = (message, meta) => {
    logger.warn(message, meta);
};
export const logError = (message, meta) => {
    logger.error(message, meta);
};
//# sourceMappingURL=logger.js.map