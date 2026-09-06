import { publicRouter } from './src/api/public.js';
console.log(publicRouter.stack.map(l => l.route ? l.route.path : l.name));
