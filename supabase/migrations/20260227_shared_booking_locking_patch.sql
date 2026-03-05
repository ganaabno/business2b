begin;

-- Serialize booking writes per (tour, departureDate) to avoid oversell races.
create or replace function public.book_trip_shared(
  p_user_id text,
  p_tour_id text,
  p_tour_title text,
  p_departure_date text,
  p_payment_method text,
  p_order_status text,
  p_order_source text,
  p_source_order_id text,
  p_passengers jsonb
)
returns table(
  order_id text,
  total_price numeric,
  remaining_seats integer
)
language plpgsql
as $$
declare
  v_requested integer;
  v_capacity integer;
  v_booked integer;
  v_remaining integer;
  v_total numeric;
  v_order_id text;
begin
  if p_tour_id is null or p_tour_id = '' then
    raise exception 'tour_id is required';
  end if;

  if p_departure_date is null or p_departure_date = '' then
    raise exception 'departure_date is required';
  end if;

  if p_passengers is null or jsonb_typeof(p_passengers) <> 'array' or jsonb_array_length(p_passengers) = 0 then
    raise exception 'passengers array is required';
  end if;

  if p_source_order_id is not null and p_source_order_id <> '' then
    select o.id::text
    into v_order_id
    from public.orders o
    where o.source = coalesce(nullif(p_order_source, ''), 'b2b')
      and o.source_order_id = p_source_order_id
    limit 1;

    if v_order_id is not null then
      select coalesce(sum(greatest(coalesce((elem->>'price')::numeric, 0), 0)), 0)
      into v_total
      from jsonb_array_elements(p_passengers) elem;

      select s.remaining into v_remaining
      from public.get_departure_seats(p_tour_id, p_departure_date) s;

      return query select v_order_id, v_total, coalesce(v_remaining, 0);
      return;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('book_trip_shared:' || coalesce(p_tour_id, '') || ':' || coalesce(p_departure_date, ''))
  );

  select coalesce(sum(greatest(coalesce((elem->>'seat_count')::integer, 1), 1)), 0)
  into v_requested
  from jsonb_array_elements(p_passengers) elem;

  if v_requested <= 0 then
    raise exception 'requested seats must be greater than zero';
  end if;

  select s.capacity, s.booked, s.remaining
  into v_capacity, v_booked, v_remaining
  from public.get_departure_seats(p_tour_id, p_departure_date) s;

  if coalesce(v_remaining, 0) < v_requested then
    raise exception 'Not enough seats: requested %, remaining %', v_requested, coalesce(v_remaining, 0);
  end if;

  select coalesce(sum(greatest(coalesce((elem->>'price')::numeric, 0), 0)), 0)
  into v_total
  from jsonb_array_elements(p_passengers) elem;

  insert into public.orders (
    user_id,
    tour_id,
    "departureDate",
    total_price,
    status,
    payment_method,
    travel_choice,
    source,
    source_order_id,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_tour_id,
    p_departure_date,
    v_total,
    coalesce(nullif(p_order_status, ''), 'pending'),
    nullif(p_payment_method, ''),
    coalesce(nullif(p_tour_title, ''), 'Regular'),
    coalesce(nullif(p_order_source, ''), 'b2b'),
    nullif(p_source_order_id, ''),
    now(),
    now()
  )
  returning id::text into v_order_id;

  insert into public.passengers (
    order_id,
    user_id,
    tour_id,
    tour_title,
    departure_date,
    name,
    room_allocation,
    serial_no,
    passenger_number,
    last_name,
    first_name,
    date_of_birth,
    age,
    gender,
    passport_number,
    passport_expire,
    nationality,
    "roomType",
    hotel,
    additional_services,
    price,
    email,
    phone,
    passport_upload,
    allergy,
    emergency_phone,
    status,
    is_blacklisted,
    notes,
    seat_count,
    main_passenger_id,
    sub_passenger_count,
    has_sub_passengers,
    itinerary_status,
    pax_type,
    group_color,
    source_passenger_id,
    created_at,
    updated_at
  )
  select
    v_order_id,
    p_user_id,
    p_tour_id,
    coalesce(nullif(rec.tour_title, ''), p_tour_title),
    p_departure_date,
    coalesce(nullif(rec.name, ''), trim(coalesce(rec.first_name, '') || ' ' || coalesce(rec.last_name, ''))),
    coalesce(rec.room_allocation, ''),
    rec.serial_no,
    coalesce(nullif(rec.passenger_number, ''), 'PAX-' || floor(extract(epoch from now()) * 1000)::text),
    coalesce(rec.last_name, ''),
    coalesce(rec.first_name, ''),
    nullif(rec.date_of_birth, ''),
    rec.age,
    rec.gender,
    nullif(rec.passport_number, ''),
    nullif(rec.passport_expire, ''),
    coalesce(nullif(rec.nationality, ''), 'Mongolia'),
    rec.room_type,
    rec.hotel,
    coalesce(rec.additional_services, '[]'::jsonb),
    coalesce(rec.price, 0),
    rec.email,
    rec.phone,
    rec.passport_upload,
    rec.allergy,
    rec.emergency_phone,
    coalesce(nullif(rec.status, ''), 'active'),
    false,
    rec.notes,
    greatest(coalesce(rec.seat_count, 1), 1),
    nullif(rec.main_passenger_id, ''),
    coalesce(rec.sub_passenger_count, 0),
    coalesce(rec.has_sub_passengers, false),
    coalesce(nullif(rec.itinerary_status, ''), 'No itinerary'),
    coalesce(nullif(rec.pax_type, ''), 'Adult'),
    rec.group_color,
    nullif(rec.source_passenger_id, ''),
    now(),
    now()
  from jsonb_to_recordset(p_passengers) as rec(
    tour_title text,
    name text,
    room_allocation text,
    serial_no text,
    passenger_number text,
    last_name text,
    first_name text,
    date_of_birth text,
    age integer,
    gender text,
    passport_number text,
    passport_expire text,
    nationality text,
    room_type text,
    hotel text,
    additional_services jsonb,
    price numeric,
    email text,
    phone text,
    passport_upload text,
    allergy text,
    emergency_phone text,
    status text,
    notes text,
    seat_count integer,
    main_passenger_id text,
    sub_passenger_count integer,
    has_sub_passengers boolean,
    itinerary_status text,
    pax_type text,
    group_color text,
    source_passenger_id text
  );

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tours' and column_name = 'available_seats'
  ) then
    select s.booked, s.remaining into v_booked, v_remaining
    from public.get_departure_seats(p_tour_id, p_departure_date) s;

    update public.tours
    set available_seats = greatest(coalesce(seats, 0) - coalesce(v_booked, 0), 0),
        updated_at = now()
    where id = p_tour_id;
  end if;

  return query
    select v_order_id, v_total, coalesce(v_remaining, 0);
end
$$;

grant execute on function public.book_trip_shared(text, text, text, text, text, text, text, text, jsonb)
to authenticated, service_role;

commit;
