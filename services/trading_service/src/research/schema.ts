import { MigrationInterface,QueryRunner } from 'typeorm';
export class Research1790461000000 implements MigrationInterface {
  async up(q:QueryRunner){await q.query(`
    CREATE TABLE research_templates(id uuid PRIMARY KEY REFERENCES assets(id),version integer NOT NULL DEFAULT 1,sector text NOT NULL,subsector text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE research_experiments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES users(id),title text NOT NULL,hypothesis text NOT NULL,manifest jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX research_owner ON research_experiments(owner_id,created_at DESC);
    CREATE TABLE research_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),experiment_id uuid NOT NULL REFERENCES research_experiments(id),owner_id uuid NOT NULL REFERENCES users(id),request_key text NOT NULL,manifest jsonb NOT NULL,status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')),cancel_requested boolean NOT NULL DEFAULT false,lease_token text,lease_until timestamptz,progress jsonb NOT NULL DEFAULT '{}',result jsonb,error text,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,UNIQUE(owner_id,request_key));
    CREATE INDEX research_queue ON research_runs(created_at) WHERE status='QUEUED';
    CREATE INDEX research_runs_owner ON research_runs(owner_id,created_at DESC);
  `);}
  async down(){throw new Error('Restore a verified backup.');}
}
