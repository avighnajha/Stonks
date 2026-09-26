/** Private JSON-lines bridge for the Python scheduler. No HTTP server or Redis publisher. */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { createInterface } from 'readline';
import { ExchangeService } from '../exchange/exchange.service';
import { AtomicExchange1790101000000 } from '../exchange/schema';
import { ExchangeClock1790460000000 } from '../exchange/clock-schema';
import { validateManifest } from './manifest';
export function stableId(key:string){const s=createHash('sha256').update(key).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-8${s.slice(17,20)}-${s.slice(20,32)}`;}
async function main(){
  const url=process.env.RUN_DATABASE_URL;if(!url)throw new Error('RUN_DATABASE_URL required');
  const db=new DataSource({type:'postgres',url,extra:{max:2,options:'-c timezone=UTC'},migrations:[AtomicExchange1790101000000,ExchangeClock1790460000000]});await db.initialize();
  // Never migrate an arbitrary live database through this adapter.
  const [{current_database:name}]=await db.query('SELECT current_database()');if(!/^stonks_run_[0-9a-f]{32}$/.test(name))throw new Error('Expected isolated run database');
  await db.runMigrations();let tick=0,counter=0,initialized=false;const assetIds=new Map<string,string>(),agentIds=new Map<string,string>();
  const engine=new ExchangeService(db.manager,{now:()=>new Date(Date.UTC(2000,0,1)+tick),id:()=>stableId(`command:${++counter}`)});
  const user=(a:string)=>{const id=agentIds.get(a);if(!id)throw new Error('Unknown agent');return id;};
  const asset=(a:string)=>{const id=assetIds.get(a);if(!id)throw new Error('Unknown asset');return id;};
  for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
    try{if(line.length>2000000)throw new Error('Request too large');const q=JSON.parse(line);if(!Number.isSafeInteger(q.tick)||q.tick<tick||q.tick>86400000)throw new Error('Invalid or backwards logical time');tick=q.tick;let result:any;
      if(q.op==='init'){
        if(initialized)throw new Error('Already initialised');const m=validateManifest(q.manifest);const [{n}]=await db.query('SELECT count(*)::int n FROM users');if(n)throw new Error('Run database is not empty');
        await db.transaction(async em=>{await em.query("SELECT set_config('stonks.logical_time',$1,true)",[new Date(Date.UTC(2000,0,1)).toISOString()]);
          const admin=stableId('admin');await em.query("INSERT INTO users(id,email,username,password_hash,role) VALUES($1,'operator@run','operator','disabled','admin')",[admin]);
          for(const a of m.assets){const id=stableId('asset:'+a.id);assetIds.set(a.id,id);await em.query("INSERT INTO assets(id,name,description,initial_price,total_supply,status,submitted_by_user_id) VALUES($1,$2,'Run snapshot',$3,0,'approved',$4)",[id,a.name,a.price,admin]);}
          for(const g of m.groups)for(let i=0;i<g.count;i++){const label=`${g.id}:${i}`,id=stableId('agent:'+label);agentIds.set(label,id);await em.query("INSERT INTO users(id,email,username,password_hash) VALUES($1,$2,$2,'disabled')",[id,label]);await em.query('INSERT INTO wallets(user_id,balance) VALUES($1,$2)',[id,g.cash]);await em.query("INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta) VALUES($1,'endowment',$2,0)",[id,g.cash]);for(const a of m.assets){await em.query('INSERT INTO holding(user_id,asset_id,quantity,average_buy_price) VALUES($1,$2,$3,$4)',[id,asset(a.id),g.inventory,a.price]);await em.query("INSERT INTO exchange_ledger(user_id,asset_id,reason,available_delta,reserved_delta) VALUES($1,$2,'issuance',$3,0)",[id,asset(a.id),g.inventory]);await em.query('UPDATE assets SET total_supply=total_supply+$2 WHERE id=$1',[asset(a.id),g.inventory]);}}
        });initialized=true;result={agents:Object.fromEntries(agentIds),assets:Object.fromEntries(assetIds)};
      }else{if(!initialized)throw new Error('Initialise first');
        if(q.op==='place'){result=await engine.place(user(q.agent),q.key,{assetId:asset(q.asset),side:q.side,type:q.type,price:q.price,quantity:q.quantity});}
        else if(q.op==='cancel')result=await engine.cancel(user(q.agent),q.key,q.orderId);
        else if(q.op==='state'){const account=await engine.account(user(q.agent));const orders=await engine.orders(user(q.agent));const books={};for(const [label,id] of assetIds)books[label]=(await engine.snapshot(id)).book;result={account,orders,books};}
        else if(q.op==='news')result=await engine.news(stableId('admin'),q.key,{assetId:asset(q.asset),headline:q.headline,sentiment:Math.round((q.signal+1)*50)});
        else if(q.op==='events')result=await engine.events(q.after||'0');
        else if(q.op==='fills')result=await engine.fills(user(q.agent),q.after||'0');
        else if(q.op==='report'){
          const trades=await db.query('SELECT sequence::text,asset_id,price::text,quantity::text,timestamp,buyer_id,seller_id FROM trades ORDER BY sequence');
          const accounts={};for(const [label,id]of agentIds)accounts[label]=await engine.account(id);
          const books={};for(const [label,id]of assetIds)books[label]=(await engine.snapshot(id)).book;
          const [cash]=await db.query('SELECT COALESCE(sum(balance+frozen_balance),0)::text total FROM wallets');
          const supplies=await db.query('SELECT a.id,a.total_supply::text expected,COALESCE(sum(h.quantity+h.frozen_quantity),0)::text actual FROM assets a LEFT JOIN holding h ON h.asset_id=a.id GROUP BY a.id');
          result={trades,accounts,books,cash:cash.total,supplies};
        }else throw new Error('Unknown operation');
      }
      process.stdout.write(JSON.stringify({ok:true,result})+'\n');
    }catch(e){process.stdout.write(JSON.stringify({ok:false,error:e.message})+'\n');}
  }
  await db.destroy();
}
if(require.main===module)main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
