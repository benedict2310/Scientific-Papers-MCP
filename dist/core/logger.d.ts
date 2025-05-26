import winston from 'winston';
export declare const logger: winston.Logger;
export declare const logInfo: (message: string, meta?: any) => void;
export declare const logWarn: (message: string, meta?: any) => void;
export declare const logError: (message: string, meta?: any) => void;
