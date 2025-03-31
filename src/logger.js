const winston = require('winston');
const config = require('./config-manager');

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: config.get('logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // File transport for errors
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error' 
        }),
        
        // File transport for combined logs
        new winston.transports.File({ 
          filename: 'logs/combined.log' 
        })
      ]
    });
  }

  // Enhanced logging methods
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, error = {}) {
    this.logger.error(message, { 
      stack: error.stack, 
      ...(error instanceof Error ? { message: error.message } : error)
    });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Performance tracking decorator
  track(label) {
    const start = process.hrtime();
    return {
      end: () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1e6;
        this.debug(`${label} took ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  }
}

module.exports = new Logger();