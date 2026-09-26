import { BadRequestException } from '@nestjs/common';
import { units } from '../exchange/decimal';

export interface Manifest {
  version: 1; durationMs: number; stepMs: number; seed: number;
  assets: {id:string;name:string;sector:string;subsector:string;price:string;marketWeight:number;sectorWeight:number;subsectorWeight:number;idiosyncraticWeight:number;templateId?:string;templateVersion?:number}[];
  groups: {id:string;strategy:string;count:number;cash:string;inventory:string;wakeMs:number;delayMs:number;signalNoise:number;parameters:Record<string,unknown>}[];
  events: {atMs:number;assetId:string;shock:number;releaseDelayMs:number;headline:string;signal:number}[];
}
const fail=(s:string):never=>{throw new BadRequestException(s);};
function object(v:any,keys:string[]) {if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('Invalid manifest fields');}
function number(v:any,min:number,max:number,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))fail('Numeric parameter out of range');}
function text(v:any,max=80){if(typeof v!=='string'||!v.trim()||v.length>max)fail('Invalid text parameter');}
export function strategies():string[]{return ['idle','scripted',...(process.env.RESEARCH_STRATEGIES||'').split(',').filter(x=>/^[a-z][a-z0-9_]{0,40}$/.test(x))];}
export function validateManifest(input:unknown):Manifest {
  const v=input as Manifest;object(v,['version','durationMs','stepMs','seed','assets','groups','events']);
  if(v.version!==1)fail('Unsupported manifest version');
  number(v.durationMs,1000,86400000,true);number(v.stepMs,100,3600000,true);number(v.seed,0,2147483647,true);
  if(!Array.isArray(v.assets)||v.assets.length<1||v.assets.length>10||!Array.isArray(v.groups)||v.groups.length<1||v.groups.length>10||!Array.isArray(v.events)||v.events.length>100)fail('Invalid population or asset count');
  const unique=(a:{id:string}[])=>{if(new Set(a.map(x=>x.id)).size!==a.length)fail('Duplicate IDs');};
  for(const a of v.assets){object(a,['id','name','sector','subsector','price','marketWeight','sectorWeight','subsectorWeight','idiosyncraticWeight','templateId','templateVersion']);if(!/^[a-zA-Z0-9_-]{1,40}$/.test(a.id))fail('Invalid asset ID');text(a.name);text(a.sector);text(a.subsector);units(a.price,2);for(const k of ['marketWeight','sectorWeight','subsectorWeight','idiosyncraticWeight'])number(a[k],0,0.5);if(a.templateId!==undefined){if(!/^[0-9a-f-]{36}$/i.test(a.templateId))fail('Invalid template ID');number(a.templateVersion,1,100000,true);}}
  let agents=0,budget=Math.ceil(v.durationMs/v.stepMs)*v.assets.length;
  for(const g of v.groups){object(g,['id','strategy','count','cash','inventory','wakeMs','delayMs','signalNoise','parameters']);if(!/^[a-zA-Z0-9_-]{1,40}$/.test(g.id)||!strategies().includes(g.strategy))fail('Unknown group or strategy');number(g.count,1,100,true);number(g.wakeMs,100,v.durationMs,true);number(g.delayMs,0,v.durationMs,true);number(g.signalNoise,0,1);units(g.cash,6,false);units(g.inventory,4,false);if(!g.parameters||typeof g.parameters!=='object'||Array.isArray(g.parameters)||JSON.stringify(g.parameters).length>8000)fail('Invalid strategy parameters');agents+=g.count;budget+=g.count*Math.ceil(v.durationMs/g.wakeMs);}
  if(agents>100||budget>20000)fail('Run exceeds 100 agents or 20,000 scheduled steps; reduce duration or activity');
  unique(v.assets);unique(v.groups);
  for(const e of v.events){object(e,['atMs','assetId','shock','releaseDelayMs','headline','signal']);number(e.atMs,0,v.durationMs,true);number(e.releaseDelayMs,0,v.durationMs-e.atMs,true);number(e.shock,-0.9,1);number(e.signal,-1,1);text(e.headline,500);if(!v.assets.some(a=>a.id===e.assetId))fail('Unknown event asset');}
  return JSON.parse(JSON.stringify(v));
}
