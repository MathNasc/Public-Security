import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from './schema.js';
import dotenv from "dotenv";

dotenv.config();

let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString || connectionString.startsWith("file:")) { 
  connectionString = "postgres://postgres:postgres@localhost:5432/postgres"; 
}

if (!connectionString) { 
  console.warn("No DATABASE_URL found"); 
}

// Auto-fix URL encoding issues for passwords with special chars
if (connectionString && connectionString.startsWith("postgres")) {
  const parts = connectionString.split('@');
  if (parts.length > 1) {
    const lastAt = connectionString.lastIndexOf('@');
    const credentials = connectionString.substring(0, lastAt); 
    const hostPart = connectionString.substring(lastAt); 
    
    const protoEnd = credentials.indexOf('://');
    if (protoEnd !== -1) { 
       const proto = credentials.substring(0, protoEnd + 3);
       const auth = credentials.substring(protoEnd + 3); 
       const colonIndex = auth.indexOf(':');
       if (colonIndex !== -1) {
          const user = auth.substring(0, colonIndex);
          let pass = auth.substring(colonIndex + 1);
          
          if (pass.includes('#') || pass.includes('@')) {
             try { pass = decodeURIComponent(pass); } catch(e) {}
             pass = encodeURIComponent(pass);
             connectionString = proto + user + ':' + pass + hostPart;
          }
       }
    }
  }
}

export const queryClient = postgres(connectionString, { max: 10, idle_timeout: 10, connect_timeout: 10 });
export const db = drizzle(queryClient, { schema });
