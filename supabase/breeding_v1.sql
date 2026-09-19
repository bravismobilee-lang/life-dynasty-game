-- Life Dynasty breeding backend v1
create extension if not exists pgcrypto;

create table if not exists public.breed_offers (
  token uuid primary key default gen_random_uuid(),
  owner_id bigint not null,
  owner_card_index integer not null,
  partner_id bigint,
  partner_card_index integer,
  card_level integer not null check (card_level between 2 and 4),
  rarity text not null,
  status text not null default 'OPEN' check (status in ('OPEN','BREEDING','DONE')),
  created_at timestamptz not null default now(),
  completes_at timestamptz
);

create table if not exists public.breed_rewards (
  token uuid not null references public.breed_offers(token) on delete cascade,
  player_id bigint not null,
  kitten_no integer not null,
  rarity text not null,
  claimed_at timestamptz not null default now(),
  primary key(token,player_id)
);

alter table public.breed_offers enable row level security;
alter table public.breed_rewards enable row level security;

create or replace function public.create_breed_offer(p_owner_id bigint,p_card_index integer,p_card_level integer,p_rarity text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_token uuid;
begin
  if p_card_level < 2 or p_card_level > 4 then raise exception 'Card level must be 2-4'; end if;
  insert into breed_offers(owner_id,owner_card_index,card_level,rarity)
  values(p_owner_id,p_card_index,p_card_level,upper(p_rarity))
  returning token into v_token;
  return v_token;
end $$;

create or replace function public.accept_breed_offer(p_token uuid,p_player_id bigint,p_card_index integer,p_card_level integer,p_rarity text)
returns table(completes_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v breed_offers%rowtype; v_end timestamptz;
begin
  select * into v from breed_offers where token=p_token for update;
  if not found then raise exception 'Offer not found'; end if;
  if v.status <> 'OPEN' then raise exception 'Offer is not open'; end if;
  if v.owner_id=p_player_id then raise exception 'Cannot pair with yourself'; end if;
  if v.card_level<>p_card_level or v.rarity<>upper(p_rarity) then raise exception 'Level and rarity must match'; end if;
  v_end:=now()+interval '24 hours';
  update breed_offers set partner_id=p_player_id,partner_card_index=p_card_index,status='BREEDING',completes_at=v_end where token=p_token;
  return query select v_end;
end $$;

create or replace function public.get_breed_status(p_token uuid,p_player_id bigint)
returns table(offer_status text,completes_at timestamptz) language sql security definer set search_path=public as $$
  select status,breed_offers.completes_at from breed_offers
  where token=p_token and p_player_id in(owner_id,partner_id)
$$;

create or replace function public.claim_breeding_reward_by_token(p_token uuid,p_player_id bigint)
returns table(kitten_no integer,rarity text) language plpgsql security definer set search_path=public as $$
declare v breed_offers%rowtype; k integer; r text;
begin
  select * into v from breed_offers where token=p_token for update;
  if not found or p_player_id not in(v.owner_id,v.partner_id) then raise exception 'Not a participant'; end if;
  if v.status<>'BREEDING' or v.completes_at>now() then raise exception 'Not ready'; end if;
  select br.kitten_no,br.rarity into k,r from breed_rewards br where br.token=p_token and br.player_id=p_player_id;
  if k is null then
    k:=1+floor(random()*25)::integer;
    r:=case when random()<0.03 then 'LEGENDARY' when random()<0.12 then 'EPIC' when random()<0.30 then 'RARE' when random()<0.58 then 'UNCOMMON' else 'COMMON' end;
    insert into breed_rewards(token,player_id,kitten_no,rarity) values(p_token,p_player_id,k,r);
  end if;
  if exists(select 1 from breed_rewards where token=p_token and player_id=v.owner_id)
     and exists(select 1 from breed_rewards where token=p_token and player_id=v.partner_id) then
    update breed_offers set status='DONE' where token=p_token;
  end if;
  return query select k,r;
end $$;

grant execute on function public.create_breed_offer(bigint,integer,integer,text) to anon,authenticated;
grant execute on function public.accept_breed_offer(uuid,bigint,integer,integer,text) to anon,authenticated;
grant execute on function public.get_breed_status(uuid,bigint) to anon,authenticated;
grant execute on function public.claim_breeding_reward_by_token(uuid,bigint) to anon,authenticated;
