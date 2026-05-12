const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (...args: any[]) => { if (isDev) console.log(...args); },
  warn: (...args: any[]) => { console.warn(...args); },
  error: (...args: any[]) => { console.error(...args); },
};
