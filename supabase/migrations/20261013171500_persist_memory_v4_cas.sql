-- P1: optimistic memory writes in POST bodies, not oversized PostgREST URLs.
-- Invoker permissions and existing sessions RLS remain authoritative.
create or replace function public.persist_conversation_memory_v4(
  p_session_id uuid,
  p_expected_memory jsonb,
  p_next_memory jsonb,
  p_expected_last_turn integer default null,
  p_next_last_turn integer default null,
  p_post_turn_log jsonb default null
) returns table(conversation_memory jsonb, memory_last_turn integer)
language sql
security invoker
set search_path = public
as $$
  update public.sessions as s
  set conversation_memory = p_next_memory,
      memory_last_turn = coalesce(p_next_last_turn, s.memory_last_turn),
      gm_post_turn_log = coalesce(p_post_turn_log, s.gm_post_turn_log)
  where s.id = p_session_id
    and s.conversation_memory is not distinct from p_expected_memory
    and (p_expected_last_turn is null or s.memory_last_turn = p_expected_last_turn)
    and (p_next_last_turn is null or p_next_last_turn >= s.memory_last_turn)
  returning s.conversation_memory, s.memory_last_turn;
$$;
revoke all on function public.persist_conversation_memory_v4(uuid,jsonb,jsonb,integer,integer,jsonb) from public, anon;
grant execute on function public.persist_conversation_memory_v4(uuid,jsonb,jsonb,integer,integer,jsonb) to authenticated;
