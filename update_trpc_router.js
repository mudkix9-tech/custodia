const fs = require('fs');
let trpcContent = fs.readFileSync('apps/api/src/trpc.ts', 'utf8');

// Update Context interface to include db and primaryDb
const contextReplace = `export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  user?: {`;
const contextNew = `export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  db: any;
  primaryDb: any;
  user?: {`;
trpcContent = trpcContent.replace(contextReplace, contextNew);

// Import dbRouter
const importRouter = `import { getDbForOrg, getPrimaryDb } from './lib/dbRouter.js';\n`;
const importDb = `import { db } from './db.js';`;
trpcContent = trpcContent.replace(importDb, importDb + '\n' + importRouter);


// In `isAuthed`, inject db
const isAuthedReplace = `  return next({
    ctx: {
      ...ctx,
      user: {
        id: decoded.sub,`;
const isAuthedNew = `  const orgId = decoded.org as string;
  const userDb = orgId ? await getDbForOrg(orgId) : db;

  return next({
    ctx: {
      ...ctx,
      db: userDb,
      primaryDb: getPrimaryDb(),
      user: {
        id: decoded.sub,`;

trpcContent = trpcContent.replace(isAuthedReplace, isAuthedNew);

fs.writeFileSync('apps/api/src/trpc.ts', trpcContent);
console.log('TRPC updated for db router');
