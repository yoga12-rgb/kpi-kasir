create index if not exists mentoring_session_outlet_date_idx
on public.mentoring_session (outlet_id, visited_date desc, id desc);

create index if not exists mentoring_session_visited_date_id_idx
on public.mentoring_session (visited_date desc, id desc);
