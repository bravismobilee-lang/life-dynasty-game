create or replace function public.get_breed_status(
  p_token uuid,
  p_player_id bigint
) returns table(
  offer_id uuid,
  offer_status text,
  completes_at timestamptz,
  reward_kitten integer,
  reward_rarity text,
  claimed_at timestamptz
)
language plpgsql security definer set search_path=public
as $$
begin
  return query
  select o.id,o.status,o.completes_at,r.kitten_no,r.rarity,r.claimed_at
  from breed_offers o
  left join breeding_rewards r on r.offer_id=o.id and r.player_id=p_player_id
  where o.token=p_token and p_player_id in (o.owner_id,o.partner_id);
end $$;

create or replace function public.claim_breeding_reward_by_token(
  p_token uuid,
  p_player_id bigint
) returns table(kitten_no integer, rarity text)
language plpgsql security definer set search_path=public
as $$
declare v_offer uuid;
begin
  select id into v_offer from breed_offers
    where token=p_token and p_player_id in (owner_id,partner_id);
  if v_offer is null then raise exception 'BREEDING_NOT_FOUND'; end if;
  return query select * from public.claim_breeding_reward(v_offer,p_player_id);
end $$;

grant execute on function public.get_breed_status(uuid,bigint) to anon, authenticated;
grant execute on function public.claim_breeding_reward_by_token(uuid,bigint) to anon, authenticated;
