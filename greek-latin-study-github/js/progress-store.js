import { supabase, getUser } from './supabase.js';
let currentUser = null;
export async function initStore(){ currentUser = await getUser(); return currentUser; }
export function activeUser(){ return currentUser; }
export function setActiveUser(u){ currentUser = u; }
function guestKey(deckId){ return `greek-latin-study:guest:${deckId}:v1`; }
export async function loadProgress(deckId, freshFactory){
  if(!currentUser){
    try{ const raw=localStorage.getItem(guestKey(deckId)); return raw ? JSON.parse(raw) : freshFactory(); }catch(_){ return freshFactory(); }
  }
  const { data, error } = await supabase.from('user_progress').select('state').eq('deck_id',deckId).maybeSingle();
  if(error) throw error;
  if(data?.state) return data.state;
  let seed=freshFactory();
  try{ const raw=localStorage.getItem(guestKey(deckId)); if(raw) seed=JSON.parse(raw); }catch(_){}
  await saveProgress(deckId,seed);
  return seed;
}
export async function saveProgress(deckId,state){
  if(!currentUser){ try{ localStorage.setItem(guestKey(deckId),JSON.stringify(state)); }catch(_){} return; }
  const payload={user_id:currentUser.id,deck_id:deckId,state,updated_at:new Date().toISOString()};
  const { error } = await supabase.from('user_progress').upsert(payload,{onConflict:'user_id,deck_id'});
  if(error) throw error;
}
