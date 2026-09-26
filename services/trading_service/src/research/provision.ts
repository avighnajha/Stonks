/** Operator-only provisioner. Requires a dedicated research PostgreSQL server. */
import { Client } from 'pg';
import { randomBytes } from 'crypto';
async function main(){const [op,id]=process.argv.slice(2);if(!['create','drop'].includes(op)||!/^stonks_run_[0-9a-f]{32}$/.test(id||''))throw new Error('Expected create/drop and generated run database name');const url=process.env.RESEARCH_DATABASE_ADMIN_URL;if(!url)throw new Error('RESEARCH_DATABASE_ADMIN_URL required');const c=new Client({connectionString:url});await c.connect();const role=id+'_role';try{
  if(op==='create'){const password=randomBytes(32).toString('hex');await c.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);try{await c.query(`CREATE DATABASE "${id}" OWNER "${role}"`);await c.query(`REVOKE CONNECT ON DATABASE "${id}" FROM PUBLIC`);}catch(e){await c.query(`DROP ROLE "${role}"`);throw e;}const u=new URL(url);u.username=role;u.password=password;u.pathname='/'+id;u.search='';process.stdout.write(JSON.stringify({url:u.toString()})+'\n');}
  else{await c.query(`DROP DATABASE IF EXISTS "${id}" WITH (FORCE)`);await c.query(`DROP ROLE IF EXISTS "${role}"`);process.stdout.write('{}\n');}
}finally{await c.end();}}
main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
