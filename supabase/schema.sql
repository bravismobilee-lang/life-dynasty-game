create extension if not exists pgcrypto;

create table if not exists public.breed_offers (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  owner_id bigint not null,
  owner_card integer not null check (owner_card between 0 and 14),
  owner_level integer not null check (owner_level between 2 and 5),
  owner_rarity text not null check (owner_rarity in ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY')),
  partner_id bigint,
  partner_card integer check (partner_card between 0 and 14),
  partner_level integer,
  partner_rarity text,
  status text not null default 'OPEN' check (status in ('OPEN','BREEDING','DONE','CANCELLED')),
  started_at timestamptz,
  completes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.breeding_rewards (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.breed_offers(id) on delete cascade,
  player_id bigint not null,
  kitten_no integer not null check (kitten_no between 1 and 15),
  rarity text not null check (rarity in ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY')),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offer_id, player_id)
);

alter table public.breed_offers enable row level security;
alter table public.breeding_rewards enable row level security;

revoke all on public.breed_offers from anon, authenticated;
revoke all on public.breeding_rewards from anon, authenticated;

create or replace function public.create_breed_offer(
  p_owner_id bigint,
  p_card_index integer,
  p_card_level integer,
  p_rarity text
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_token uuid;
begin
  if p_card_level < 2 or p_card_level > 5 then raise exception 'CARD_LEVEL_NOT_READY'; end if;
  if p_rarity not in ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY') then raise exception 'BAD_RARITY'; end if;
  update breed_offers set status='CANCELLED'
    where owner_id=p_owner_id and owner_card=p_card_index and status='OPEN';
  insert into breed_offers(owner_id,owner_card,owner_level,owner_rarity)
    values(p_owner_id,p_card_index,p_card_level,p_rarity)
    returning token into v_token;
  return v_token;
end $$;

create or replace function public.accept_breed_offer(
  p_token uuid,
  p_player_id bigint,
  p_card_index integer,
  p_card_level integer,
  p_rarity text
) returns table(offer_id uuid, completes_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare v breed_offers%rowtype; v_complete timestamptz; v_roll numeric; v_reward text;
begin
  select * into v from breed_offers where token=p_token for update;
  if not found or v.status<>'OPEN' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if v.owner_id=p_player_id then raise exception 'CANNOT_BREED_WITH_SELF'; end if;
  if v.owner_level<>p_card_level or v.owner_rarity<>p_rarity then raise exception 'CARD_MUST_MATCH_LEVEL_AND_RARITY'; end if;
  if exists(select 1 from breed_offers where status='BREEDING' and completes_at>now()
    and ((owner_id=p_player_id and owner_card=p_card_index) or (partner_id=p_player_id and partner_card=p_card_index))) then
    raise exception 'CARD_ALREADY_BREEDING';
  end if;
  v_complete=now()+interval '24 hours';
  update breed_offers set partner_id=p_player_id,partner_card=p_card_index,
    partner_level=p_card_level,partner_rarity=p_rarity,status='BREEDING',
    started_at=now(),completes_at=v_complete where id=v.id;
  for i in 1..2 loop
    v_roll=random();
    v_reward=case
      when v.owner_rarity='LEGENDARY' and v_roll<0.12 then 'LEGENDARY'
      when v.owner_rarity in ('EPIC','LEGENDARY') and v_roll<0.32 then 'EPIC'
      when v.owner_rarity in ('RARE','EPIC','LEGENDARY') and v_roll<0.55 then 'RARE'
      when v_roll<0.82 then 'UNCOMMON' else 'COMMON' end;
    insert into breeding_rewards(offer_id,player_id,kitten_no,rarity)
      values(v.id,case when i=1 then v.owner_id else p_player_id end,1+floor(random()*15)::integer,v_reward);
  end loop;
  return query select v.id,v_complete;
end $$;

create or replace function public.claim_breeding_reward(
  p_offer_id uuid,
  p_player_id bigint
) returns table(kitten_no integer, rarity text)
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from breed_offers where id=p_offer_id and status='BREEDING' and completes_at<=now()) then
    raise exception 'BREEDING_NOT_FINISHED';
  end if;
  update breeding_rewards set claimed_at=coalesce(claimed_at,now())
    where offer_id=p_offer_id and player_id=p_player_id;
  update breed_offers set status='DONE' where id=p_offer_id
    and not exists(select 1 from breeding_rewards where offer_id=p_offer_id and claimed_at is null);
  return query select r.kitten_no,r.rarity from breeding_rewards r
    where r.offer_id=p_offer_id and r.player_id=p_player_id;
end $$;

grant execute on function public.create_breed_offer(bigint,integer,integer,text) to anon, authenticated;
grant execute on function public.accept_breed_offer(uuid,bigint,integer,integer,text) to anon, authenticated;
grant execute on function public.claim_breeding_reward(uuid,bigint) to anon, authenticated;
