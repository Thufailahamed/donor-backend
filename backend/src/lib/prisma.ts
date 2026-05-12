import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let dbUrl = process.env.DATABASE_URL || '';

// Robust Azure SQL URL parameter appending
const params = 'connection_limit=100;pool_timeout=60;loginTimeout=60;';

if (dbUrl.includes(';')) {
  // Semi-colon format (typical for Azure SQL in Prisma)
  if (!dbUrl.endsWith(';')) dbUrl += ';';
  dbUrl += params;
} else {
  // Query parameter format
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl += `${separator}${params.replace(/;/g, '&').replace(/&+$/, '')}`;
}

const client = new PrismaClient({
  datasourceUrl: dbUrl,
  log: ['error', 'warn'],
});

export const prisma = client.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let retries = 5; // Increased retries for Azure SQL
        let lastError;
        
        while (retries > 0) {
          try {
            return await query(args);
          } catch (error: any) {
            lastError = error;
            
            // Comprehensive transient error detection
            const errorMessage = error.message || '';
            const isTransient = 
              errorMessage.includes('40613') || // Database unavailable
              errorMessage.includes('40197') || // Service busy
              errorMessage.includes('40501') || // Service busy
              errorMessage.includes('10928') || // Resource limit reached
              errorMessage.includes('10929') || // Resource limit reached
              errorMessage.includes('Database is not currently available') ||
              errorMessage.includes('Connection timeout');
            
            if (isTransient && retries > 1) {
              retries--;
              const attempt = 6 - retries;
              const delay = attempt * 2000; // Progressive backoff: 2s, 4s, 6s...
              
              console.warn(`[Prisma] Database Transient Error (Attempt ${attempt}/5). Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
        throw lastError;
      },
    },
  },
});
