import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { q } from "../../db/transaction.js";

type TourSearchRow = {
  id: string;
  title: string;
  destination: string;
  departure_date: string;
  base_price: number | string;
  capacity: number | string;
  available_seats: number | string | null;
};

export type GlobalToursSyncStatusRow = {
  source_system: string;
  enabled: boolean;
  interval_ms: number;
  last_started_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_finished_at: string | null;
  last_error: string | null;
  failure_streak: number;
  last_duration_ms: number | null;
  last_fetched: number | null;
  last_normalized: number | null;
  last_inserted: number | null;
  last_updated: number | null;
  last_linked: number | null;
  last_skipped: number | null;
  last_dry_run: boolean | null;
  updated_at: string;
};

export type TourSyncAction = "inserted" | "updated" | "linked";

export type TourSyncRowInput = {
  sourceSystem: string;
  sourceTourId: string;
  title: string;
  name: string;
  description: string | null;
  dates: string[];
  departureDate: string | null;
  seats: number;
  basePrice: number;
  hotels: string[];
  services: Array<{ name: string; price: number }>;
  status: "active" | "inactive" | "full" | "hidden" | "pending" | "completed";
  imageKey: string | null;
  showInProvider: boolean;
  showToUser: boolean;
  createdBy: string | null;
  sourceUpdatedAt: string | null;
  coverPhoto?: string | null;
  country?: string | null;
  hotel?: string | null;
  countryTemperature?: string | null;
  durationDay?: string | null;
  durationNight?: string | null;
  groupSize?: string | null;
  isFeatured?: boolean;
  genre?: string | null;
  airlines?: string[];
};

type TourUpsertTarget =
  | {
      id: string;
      action: Extract<TourSyncAction, "updated" | "linked">;
    }
  | null;

const GLOBAL_PROFILE_COLUMNS = [
  "cover_photo",
  "country",
  "hotel",
  "country_temperature",
  "duration_day",
  "duration_night",
  "group_size",
  "is_featured",
  "genre",
  "airlines",
] as const;

const SOURCE_IDENTITY_COLUMNS = ["source_system", "source_tour_id"] as const;

let hasGlobalProfileColumnsCache: boolean | null = null;
let hasSourceIdentityColumnsCache: boolean | null = null;
let hasCanonicalBookingTablesCache: boolean | null = null;
let legacyPriceTablesCache: Map<string, string> | null = null;

const LEGACY_PRICE_TABLE_BY_ROUTE = {
  bali: "bali_price_table",
  beijing_janjieje: "beijing_janjieje_price_table",
  dalyan: "dalyan_price_table",
  hainan: "hainan_price_table",
  halong_bay: "halong_bay_price_table",
  ho_chi_minh_phu_quoc: "ho_chi_minh_phu_quoc_price_table",
  janjieje: "janjieje_price_table",
  japan: "japan_price_table",
  nha_trang: "nha_trang_price_table",
  phu_quoc: "phu_quoc_price_table",
  phuket: "phuket_price_table",
  shanghai: "shanghai_price_table",
  singapore: "singapore_price_table",
  thailand_banggok: "thailand_banggok_price_table",
  turkey: "turkey_price_table",
} as const;

async function runQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(sql, params);
  }
  return q<T>(sql, params);
}

function isSyncStatusSchemaError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703";
}

export async function getGlobalToursSyncStatusRepo() {
  try {
    const rows = await q<GlobalToursSyncStatusRow>(
      `
      select
        source_system,
        enabled,
        interval_ms,
        last_started_at,
        last_success_at,
        last_failure_at,
        last_finished_at,
        last_error,
        failure_streak,
        last_duration_ms,
        last_fetched,
        last_normalized,
        last_inserted,
        last_updated,
        last_linked,
        last_skipped,
        last_dry_run,
        updated_at
      from public.global_tours_sync_status
      where id = 1
      limit 1
      `,
      [],
    );

    return rows.rows[0] || null;
  } catch (error) {
    if (isSyncStatusSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

async function hasGlobalProfileColumns(client?: PoolClient) {
  if (hasGlobalProfileColumnsCache !== null) {
    return hasGlobalProfileColumnsCache;
  }

  const result = await runQuery<{ column_name: string }>(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tours'
      and column_name = any($1::text[])
    `,
    [GLOBAL_PROFILE_COLUMNS],
    client,
  );

  const existing = new Set(
    result.rows
      .map((row) => row.column_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );

  hasGlobalProfileColumnsCache = GLOBAL_PROFILE_COLUMNS.every((column) => existing.has(column));
  return hasGlobalProfileColumnsCache;
}

async function hasSourceIdentityColumns(client?: PoolClient) {
  if (hasSourceIdentityColumnsCache !== null) {
    return hasSourceIdentityColumnsCache;
  }

  const result = await runQuery<{ column_name: string }>(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tours'
      and column_name = any($1::text[])
    `,
    [SOURCE_IDENTITY_COLUMNS],
    client,
  );

  const existing = new Set(
    result.rows
      .map((row) => row.column_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );

  hasSourceIdentityColumnsCache = SOURCE_IDENTITY_COLUMNS.every((column) => existing.has(column));
  return hasSourceIdentityColumnsCache;
}

async function hasCanonicalBookingTables() {
  if (hasCanonicalBookingTablesCache !== null) {
    return hasCanonicalBookingTablesCache;
  }

  const result = await q<{ table_name: string }>(
    `
    select lower(table_name) as table_name
    from information_schema.tables
    where table_schema = 'public'
      and lower(table_name) in ('orders', 'passengers')
    `,
    [],
  );

  const existing = new Set(
    result.rows
      .map((row) => row.table_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );

  hasCanonicalBookingTablesCache = existing.has("orders") && existing.has("passengers");
  return hasCanonicalBookingTablesCache;
}

function isSchemaCompatibilityError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703" || code === "42883";
}

async function listTourDestinationsFallbackRepo(filters: {
  from?: string;
  to?: string;
  minSeats?: number;
}) {
  const minSeats =
    typeof filters.minSeats === "number" &&
    Number.isInteger(filters.minSeats) &&
    filters.minSeats > 0
      ? filters.minSeats
      : 1;

  const rows = await q<{ destination: string }>(
    `
    with departure_dates as (
      select
        t.id::text as tour_id,
        raw_date.value::date as departure_date
      from public.tours t
      cross join lateral unnest(
          case
            when coalesce(cardinality(t.dates), 0) > 0 then t.dates
            when t.departuredate is not null then array[t.departuredate::text]
            else array[]::text[]
          end
      ) as raw_date(value)
      where lower(coalesce(t.status, 'active')) = 'active'
        and raw_date.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ),
    candidate_tours as (
      select
        coalesce(d.departure_date, t.departuredate)::date as departure_date,
        nullif(btrim(t.country), '') as country,
        coalesce(t.cities, array[]::text[]) as cities,
        nullif(btrim(coalesce(t.name, t.title)), '') as title_fallback,
        greatest(coalesce(t.available_seats, t.seats, 0), 0) as available_seats
      from public.tours t
      left join departure_dates d on d.tour_id = t.id::text
      where lower(coalesce(t.status, 'active')) = 'active'
        and (
          $2::date is null
          or (
            coalesce(d.departure_date, t.departuredate)::date is not null
            and coalesce(d.departure_date, t.departuredate)::date >= $2::date
            and coalesce(d.departure_date, t.departuredate)::date <= $3::date
          )
        )
    ),
    filtered_tours as (
      select *
      from candidate_tours ct
      where ct.available_seats >= $1::int
        and (
          $2::date is null
          or (
            ct.departure_date is not null
            and ct.departure_date >= $2::date
            and ct.departure_date <= $3::date
          )
        )
    ),
    raw_values as (
      select title_fallback as destination, 3::int as specificity
      from filtered_tours
      where title_fallback is not null

      union all

      select nullif(btrim(city_name), '') as destination, 2::int as specificity
      from filtered_tours ft
      cross join lateral unnest(ft.cities) as city_name

      union all

      select country as destination, 1::int as specificity
      from filtered_tours
      where country is not null
    ),
    deduped as (
      select
        lower(destination) as key,
        min(destination) as destination,
        max(specificity) as specificity
      from raw_values
      where destination is not null
      group by lower(destination)
    )
    select destination
    from deduped
    order by specificity desc, destination asc
    limit 300
    `,
    [minSeats, filters.from || null, filters.to || null],
  );

  return rows.rows.map((row) => row.destination);
}

export async function listTourDestinationsRepo(filters?: {
  from?: string;
  to?: string;
  minSeats?: number;
}) {
  const hasBookingTables = await hasCanonicalBookingTables();
  if (!hasBookingTables) {
    return listTourDestinationsFallbackRepo(filters || {});
  }

  const minSeats =
    typeof filters?.minSeats === "number" &&
    Number.isInteger(filters.minSeats) &&
    filters.minSeats > 0
      ? filters.minSeats
      : 1;

  try {
    const rows = await q<{ destination: string }>(
      `
    with departure_dates as (
      select
        t.id::text as tour_id,
        raw_date.value::date as departure_date
      from public.tours t
      cross join lateral unnest(
          case
            when pg_typeof(t.dates)::text = 'text[]' and cardinality(t.dates) > 0 then t.dates
            when t.departuredate is not null then array[t.departuredate::text]
            else array[]::text[]
          end
      ) as raw_date(value)
      where lower(coalesce(t.status, 'active')) = 'active'
        and raw_date.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ),
    normalized_orders as (
      select
        o.id,
        o.tour_id::text as tour_id,
        case
          when o."departureDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then o."departureDate"::date
          else null
        end as departure_date,
        lower(coalesce(o.status, 'pending')) as normalized_status
      from public.orders o
    ),
    booked_by_departure as (
      select
        no.tour_id,
        no.departure_date,
        coalesce(sum(greatest(coalesce(p.seat_count, 1), 1)), 0)::int as booked
      from normalized_orders no
      join public.passengers p on p.order_id = no.id
      where no.departure_date is not null
        and no.normalized_status not in ('cancelled', 'declined')
        and (
          $2::date is null
          or no.departure_date between $2::date and $3::date
        )
      group by no.tour_id, no.departure_date
    ),
    candidate_tours as (
      select
        coalesce(d.departure_date, t.departuredate)::date as departure_date,
        nullif(btrim(t.country), '') as country,
        coalesce(t.cities, array[]::text[]) as cities,
        nullif(btrim(coalesce(t.name, t.title)), '') as title_fallback,
        greatest(
          case
            when coalesce(t.seats, 0) > 0
                 and coalesce(d.departure_date, t.departuredate)::date is not null
              then coalesce(t.seats, 0) - coalesce(b.booked, 0)
            when coalesce(t.available_seats, 0) > 0
              then coalesce(t.available_seats, 0)
            else coalesce(t.seats, 0)
          end,
          0
        ) as available_seats
      from public.tours t
      left join departure_dates d on d.tour_id = t.id::text
      left join booked_by_departure b
        on b.tour_id = t.id::text
       and b.departure_date = coalesce(d.departure_date, t.departuredate)::date
      where lower(coalesce(t.status, 'active')) = 'active'
        and (
          $2::date is null
          or (
            coalesce(d.departure_date, t.departuredate)::date is not null
            and coalesce(d.departure_date, t.departuredate)::date >= $2::date
            and coalesce(d.departure_date, t.departuredate)::date <= $3::date
          )
        )
    ),
    filtered_tours as (
      select *
      from candidate_tours ct
      where ct.available_seats >= $1::int
        and (
          $2::date is null
          or (
            ct.departure_date is not null
            and ct.departure_date >= $2::date
            and ct.departure_date <= $3::date
          )
        )
    ),
    raw_values as (
      select title_fallback as destination, 3::int as specificity
      from filtered_tours
      where title_fallback is not null

      union all

      select nullif(btrim(city_name), '') as destination, 2::int as specificity
      from filtered_tours ft
      cross join lateral unnest(ft.cities) as city_name

      union all

      select country as destination, 1::int as specificity
      from filtered_tours
      where country is not null
    ),
    deduped as (
      select
        lower(destination) as key,
        min(destination) as destination,
        max(specificity) as specificity
      from raw_values
      where destination is not null
      group by lower(destination)
    )
    select destination
    from deduped
    order by specificity desc, destination asc
    limit 300
      `,
      [minSeats, filters?.from || null, filters?.to || null],
    );

    return rows.rows.map((row) => row.destination);
  } catch (error) {
    if (isSchemaCompatibilityError(error)) {
      hasCanonicalBookingTablesCache = false;
      return listTourDestinationsFallbackRepo(filters || {});
    }
    throw error;
  }
}

export async function searchToursRepo(filters: {
  from: string;
  to: string;
  destination?: string;
  minSeats?: number;
}) {
  const params: unknown[] = [filters.from, filters.to];
  const conditions: string[] = [
    `(d.departure_date is null or (d.departure_date >= $1::date and d.departure_date <= $2::date))`,
  ];

  if (filters.destination) {
    params.push(filters.destination);
    conditions.push(`(
      coalesce(t.title, '') ilike ('%' || $${params.length} || '%')
      or coalesce(t.country, '') ilike ('%' || $${params.length} || '%')
      or exists (
        select 1
        from unnest(coalesce(t.cities, array[]::text[])) as city_name
        where city_name ilike ('%' || $${params.length} || '%')
      )
    )`);
  }
  const rows = await q<TourSearchRow>(
    `
    with departure_dates as (
      select
        t.id::text as tour_id,
        unnest(
          case
            when pg_typeof(t.dates)::text = 'text[]' and cardinality(t.dates) > 0 then t.dates
            when t.departuredate is not null then array[t.departuredate::text]
            else array[]::text[]
          end
        )::date as departure_date
      from public.tours t
    )
    select
      t.id::text,
      t.title,
      t.title as destination,
      coalesce(d.departure_date, t.departuredate, $1::date)::text as departure_date,
      coalesce(t.base_price, 0) as base_price,
      coalesce(t.seats, 0) as capacity,
      (
        case
          when coalesce(stats.remaining, 0) > 0 then coalesce(stats.remaining, 0)
          when coalesce(t.available_seats, 0) > 0 then coalesce(t.available_seats, 0)
          when d.departure_date is null
               and t.departuredate is null
               and cardinality(coalesce(t.dates, array[]::text[])) = 0
            then coalesce(t.seats, 0)
          else coalesce(stats.remaining, t.available_seats, 0)
        end
      ) as available_seats
    from public.tours t
    left join departure_dates d on d.tour_id = t.id::text
    left join lateral public.get_departure_seats(
      t.id::text,
      coalesce(d.departure_date::text, $1::text)
    ) stats on true
    where ${conditions.join(" and ")}
    order by d.departure_date asc, t.title asc
    `,
    params,
  );

  const filtered = rows.rows.filter((r) => {
    if (typeof filters.minSeats === "number") {
      return Number(r.available_seats || 0) >= filters.minSeats;
    }
    return true;
  });

  return filtered;
}

async function getAvailableLegacyPriceTables() {
  if (legacyPriceTablesCache) {
    return legacyPriceTablesCache;
  }

  const tableNames = Array.from(new Set(Object.values(LEGACY_PRICE_TABLE_BY_ROUTE)));
  const result = await q<{ table_name: string }>(
    `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any($1::text[])
    `,
    [tableNames],
  );

  const existing = new Set(
    result.rows
      .map((row) => row.table_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );

  const byRoute = new Map<string, string>();
  Object.entries(LEGACY_PRICE_TABLE_BY_ROUTE).forEach(([route, tableName]) => {
    if (existing.has(tableName)) {
      byRoute.set(route, tableName);
    }
  });

  legacyPriceTablesCache = byRoute;
  return byRoute;
}

export async function getLegacyRouteBasePricesRepo(filters: {
  from: string;
  to: string;
  routes: string[];
}) {
  const normalizedRoutes = Array.from(
    new Set(filters.routes.map((route) => route.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalizedRoutes.length === 0) {
    return new Map<string, number>();
  }

  const available = await getAvailableLegacyPriceTables();
  const selectParts: string[] = [];

  normalizedRoutes.forEach((route) => {
    const tableName = available.get(route);
    if (!tableName) return;

    selectParts.push(`
      select
        '${route}'::text as route,
        min(
          case
            when regexp_replace(coalesce(adult_price, ''), '[^0-9.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$'
              then regexp_replace(coalesce(adult_price, ''), '[^0-9.]', '', 'g')::numeric
            else null
          end
        ) filter (
          where departure_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
            and departure_date::date between $1::date and $2::date
        ) as in_range_price,
        min(
          case
            when regexp_replace(coalesce(adult_price, ''), '[^0-9.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$'
              then regexp_replace(coalesce(adult_price, ''), '[^0-9.]', '', 'g')::numeric
            else null
          end
        ) as fallback_price
      from public.${tableName}
    `);
  });

  if (selectParts.length === 0) {
    return new Map<string, number>();
  }

  const result = await q<{ route: string; effective_price: string | number }>(
    `
    with route_prices as (
      ${selectParts.join(" union all ")}
    )
    select route, coalesce(in_range_price, fallback_price) as effective_price
    from route_prices
    where coalesce(in_range_price, fallback_price) is not null
    `,
    [filters.from, filters.to],
  );

  const byRoute = new Map<string, number>();
  result.rows.forEach((row) => {
    const route = String(row.route || "").trim().toLowerCase();
    const price = Number(row.effective_price);
    if (!route || !Number.isFinite(price) || price <= 0) return;
    byRoute.set(route, price);
  });

  return byRoute;
}

async function findTourUpsertTargetRepo(
  params: {
    sourceSystem: string;
    sourceTourId: string;
    title: string;
    departureDate: string | null;
  },
  client?: PoolClient,
): Promise<TourUpsertTarget> {
  const supportsSourceIdentityColumns = await hasSourceIdentityColumns(client);

  if (supportsSourceIdentityColumns) {
    const sourceLookup = await runQuery<{ id: string }>(
      `
      select t.id::text
      from public.tours t
      where lower(coalesce(t.source_system, '')) = lower($1)
        and t.source_tour_id = $2
      limit 1
      `,
      [params.sourceSystem, params.sourceTourId],
      client,
    );

    if (sourceLookup.rows[0]?.id) {
      return { id: sourceLookup.rows[0].id, action: "updated" };
    }
  }

  const normalizedTitle = params.title.trim();
  if (!normalizedTitle) {
    return null;
  }

  if (params.departureDate) {
    const titleDateLookup = await runQuery<{ id: string }>(
      `
      select t.id::text
      from public.tours t
      where lower(trim(coalesce(t.title, ''))) = lower(trim($1))
        ${supportsSourceIdentityColumns ? "and coalesce(btrim(t.source_tour_id), '') = ''" : ""}
        and (
          coalesce(t.departuredate::text, '') = $2
          or (
            pg_typeof(t.dates)::text = 'text[]'
            and $2 = any(
              case
                when pg_typeof(t.dates)::text = 'text[]' then t.dates
                else array[]::text[]
              end
            )
          )
        )
      order by t.updated_at desc nulls last, t.created_at desc nulls last
      limit 1
      `,
      [normalizedTitle, params.departureDate],
      client,
    );

    if (titleDateLookup.rows[0]?.id) {
      return { id: titleDateLookup.rows[0].id, action: "linked" };
    }
  }

  const titleLookup = await runQuery<{ id: string }>(
    `
    select t.id::text
    from public.tours t
    where lower(trim(coalesce(t.title, ''))) = lower(trim($1))
      ${supportsSourceIdentityColumns ? "and coalesce(btrim(t.source_tour_id), '') = ''" : ""}
    order by t.updated_at desc nulls last, t.created_at desc nulls last
    limit 1
    `,
    [normalizedTitle],
    client,
  );

  if (titleLookup.rows[0]?.id) {
    return { id: titleLookup.rows[0].id, action: "linked" };
  }

  return null;
}

export async function classifyTourSyncActionRepo(
  params: {
    sourceSystem: string;
    sourceTourId: string;
    title: string;
    departureDate: string | null;
  },
) {
  const target = await findTourUpsertTargetRepo(params);
  if (!target) return "inserted" as const;
  return target.action;
}

export async function upsertTourFromSourceRepo(client: PoolClient, input: TourSyncRowInput) {
  const supportsSourceIdentityColumns = await hasSourceIdentityColumns(client);
  const supportsGlobalProfileColumns = await hasGlobalProfileColumns(client);

  const resolveTarget = () =>
    findTourUpsertTargetRepo(
      {
        sourceSystem: input.sourceSystem,
        sourceTourId: input.sourceTourId,
        title: input.title,
        departureDate: input.departureDate,
      },
      client,
    );

  const target = await resolveTarget();

  const safeSeats = Math.max(0, Math.floor(input.seats || 0));
  const safeBasePrice = Number.isFinite(input.basePrice)
    ? Math.max(0, Number(input.basePrice || 0))
    : 0;
  const normalizedDates = input.dates.filter((date) => typeof date === "string" && date.trim());
  const normalizedHotels = input.hotels.filter((hotel) => typeof hotel === "string" && hotel.trim());
  const normalizedCoverPhoto =
    typeof input.coverPhoto === "string" && input.coverPhoto.trim().length > 0
      ? input.coverPhoto.trim()
      : null;
  const normalizedCountry =
    typeof input.country === "string" && input.country.trim().length > 0
      ? input.country.trim()
      : null;
  const normalizedHotel =
    typeof input.hotel === "string" && input.hotel.trim().length > 0
      ? input.hotel.trim()
      : null;
  const normalizedCountryTemperature =
    typeof input.countryTemperature === "string" && input.countryTemperature.trim().length > 0
      ? input.countryTemperature.trim()
      : null;
  const normalizedDurationDay =
    typeof input.durationDay === "string" && input.durationDay.trim().length > 0
      ? input.durationDay.trim()
      : null;
  const normalizedDurationNight =
    typeof input.durationNight === "string" && input.durationNight.trim().length > 0
      ? input.durationNight.trim()
      : null;
  const normalizedGroupSize =
    typeof input.groupSize === "string" && input.groupSize.trim().length > 0
      ? input.groupSize.trim()
      : null;
  const normalizedIsFeatured = Boolean(input.isFeatured);
  const normalizedGenre =
    typeof input.genre === "string" && input.genre.trim().length > 0
      ? input.genre.trim()
      : null;
  const normalizedAirlines = (input.airlines || [])
    .map((airline) => String(airline || "").trim())
    .filter((airline) => airline.length > 0);

  const serializedServices = JSON.stringify(
    (input.services || []).map((service) => ({
      name: String(service.name || "").trim(),
      price: Number.isFinite(service.price) ? Number(service.price) : 0,
    })),
  );

  const updateExisting = async (
    existingId: string,
    action: Extract<TourSyncAction, "updated" | "linked">,
  ) => {
    let updated: QueryResult<{ id: string }>;

    if (supportsSourceIdentityColumns) {
      updated = supportsGlobalProfileColumns
        ? await client.query<{ id: string }>(
            `
            update public.tours
            set
              source_system = lower($1),
              source_tour_id = $2,
              title = $3,
              name = $4,
              description = $5,
              dates = $6::text[],
              departuredate = $7,
              seats = $8,
              available_seats =
                case
                  when available_seats is null then greatest($8, 0)
                  when available_seats > $8 then greatest($8, 0)
                  else available_seats
                end,
              hotels = $9::text[],
              services = $10::jsonb,
              base_price = $11,
              status = $12,
              show_in_provider = coalesce(show_in_provider, $13),
              show_to_user = coalesce(show_to_user, $14),
              image_key = $15,
              cover_photo = coalesce($16, cover_photo, image_key),
              country = $17,
              hotel = $18,
              country_temperature = $19,
              duration_day = $20,
              duration_night = $21,
              group_size = $22,
              is_featured = $23,
              genre = $24,
              airlines = $25::text[],
              updated_at = now()
            where id::text = $26::text
            returning id::text
            `,
            [
              input.sourceSystem,
              input.sourceTourId,
              input.title,
              input.name,
              input.description,
              normalizedDates,
              input.departureDate,
              safeSeats,
              normalizedHotels,
              serializedServices,
              safeBasePrice,
              input.status,
              input.showInProvider,
              input.showToUser,
              input.imageKey,
              normalizedCoverPhoto,
              normalizedCountry,
              normalizedHotel,
              normalizedCountryTemperature,
              normalizedDurationDay,
              normalizedDurationNight,
              normalizedGroupSize,
              normalizedIsFeatured,
              normalizedGenre,
              normalizedAirlines,
              existingId,
            ],
          )
        : await client.query<{ id: string }>(
            `
            update public.tours
            set
              source_system = lower($1),
              source_tour_id = $2,
              title = $3,
              name = $4,
              description = $5,
              dates = $6::text[],
              departuredate = $7,
              seats = $8,
              available_seats =
                case
                  when available_seats is null then greatest($8, 0)
                  when available_seats > $8 then greatest($8, 0)
                  else available_seats
                end,
              hotels = $9::text[],
              services = $10::jsonb,
              base_price = $11,
              status = $12,
              show_in_provider = coalesce(show_in_provider, $13),
              show_to_user = coalesce(show_to_user, $14),
              image_key = $15,
              updated_at = now()
            where id::text = $16::text
            returning id::text
            `,
            [
              input.sourceSystem,
              input.sourceTourId,
              input.title,
              input.name,
              input.description,
              normalizedDates,
              input.departureDate,
              safeSeats,
              normalizedHotels,
              serializedServices,
              safeBasePrice,
              input.status,
              input.showInProvider,
              input.showToUser,
              input.imageKey,
              existingId,
            ],
          );
    } else {
      updated = supportsGlobalProfileColumns
        ? await client.query<{ id: string }>(
            `
            update public.tours
            set
              title = $1,
              name = $2,
              description = $3,
              dates = $4::text[],
              departuredate = $5,
              seats = $6,
              available_seats =
                case
                  when available_seats is null then greatest($6, 0)
                  when available_seats > $6 then greatest($6, 0)
                  else available_seats
                end,
              hotels = $7::text[],
              services = $8::jsonb,
              base_price = $9,
              status = $10,
              show_in_provider = coalesce(show_in_provider, $11),
              show_to_user = coalesce(show_to_user, $12),
              image_key = $13,
              cover_photo = coalesce($14, cover_photo, image_key),
              country = $15,
              hotel = $16,
              country_temperature = $17,
              duration_day = $18,
              duration_night = $19,
              group_size = $20,
              is_featured = $21,
              genre = $22,
              airlines = $23::text[],
              updated_at = now()
            where id::text = $24::text
            returning id::text
            `,
            [
              input.title,
              input.name,
              input.description,
              normalizedDates,
              input.departureDate,
              safeSeats,
              normalizedHotels,
              serializedServices,
              safeBasePrice,
              input.status,
              input.showInProvider,
              input.showToUser,
              input.imageKey,
              normalizedCoverPhoto,
              normalizedCountry,
              normalizedHotel,
              normalizedCountryTemperature,
              normalizedDurationDay,
              normalizedDurationNight,
              normalizedGroupSize,
              normalizedIsFeatured,
              normalizedGenre,
              normalizedAirlines,
              existingId,
            ],
          )
        : await client.query<{ id: string }>(
            `
            update public.tours
            set
              title = $1,
              name = $2,
              description = $3,
              dates = $4::text[],
              departuredate = $5,
              seats = $6,
              available_seats =
                case
                  when available_seats is null then greatest($6, 0)
                  when available_seats > $6 then greatest($6, 0)
                  else available_seats
                end,
              hotels = $7::text[],
              services = $8::jsonb,
              base_price = $9,
              status = $10,
              show_in_provider = coalesce(show_in_provider, $11),
              show_to_user = coalesce(show_to_user, $12),
              image_key = $13,
              updated_at = now()
            where id::text = $14::text
            returning id::text
            `,
            [
              input.title,
              input.name,
              input.description,
              normalizedDates,
              input.departureDate,
              safeSeats,
              normalizedHotels,
              serializedServices,
              safeBasePrice,
              input.status,
              input.showInProvider,
              input.showToUser,
              input.imageKey,
              existingId,
            ],
          );
    }

    return {
      id: updated.rows[0]?.id || existingId,
      action,
    };
  };

  if (!target) {
    try {
      let inserted: QueryResult<{ id: string }>;

      if (supportsSourceIdentityColumns) {
        inserted = supportsGlobalProfileColumns
          ? await client.query<{ id: string }>(
              `
              insert into public.tours (
                source_system,
                source_tour_id,
                title,
                name,
                description,
                dates,
                departuredate,
                seats,
                available_seats,
                hotels,
                services,
                base_price,
                status,
                show_in_provider,
                show_to_user,
                image_key,
                cover_photo,
                country,
                hotel,
                country_temperature,
                duration_day,
                duration_night,
                group_size,
                is_featured,
                genre,
                airlines,
                creator_name,
                created_by,
                created_at,
                updated_at
              )
              values (
                lower($1),
                $2,
                $3,
                $4,
                $5,
                $6::text[],
                $7,
                $8,
                $8,
                $9::text[],
                $10::jsonb,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18,
                $19,
                $20,
                $21,
                $22,
                $23,
                $24,
                $25::text[],
                'Global API',
                $26::uuid,
                coalesce($27::timestamptz, now()),
                now()
              )
              returning id::text
              `,
              [
                input.sourceSystem,
                input.sourceTourId,
                input.title,
                input.name,
                input.description,
                normalizedDates,
                input.departureDate,
                safeSeats,
                normalizedHotels,
                serializedServices,
                safeBasePrice,
                input.status,
                input.showInProvider,
                input.showToUser,
                input.imageKey,
                normalizedCoverPhoto,
                normalizedCountry,
                normalizedHotel,
                normalizedCountryTemperature,
                normalizedDurationDay,
                normalizedDurationNight,
                normalizedGroupSize,
                normalizedIsFeatured,
                normalizedGenre,
                normalizedAirlines,
                input.createdBy,
                input.sourceUpdatedAt,
              ],
            )
          : await client.query<{ id: string }>(
              `
              insert into public.tours (
                source_system,
                source_tour_id,
                title,
                name,
                description,
                dates,
                departuredate,
                seats,
                available_seats,
                hotels,
                services,
                base_price,
                status,
                show_in_provider,
                show_to_user,
                image_key,
                creator_name,
                created_by,
                created_at,
                updated_at
              )
              values (
                lower($1),
                $2,
                $3,
                $4,
                $5,
                $6::text[],
                $7,
                $8,
                $8,
                $9::text[],
                $10::jsonb,
                $11,
                $12,
                $13,
                $14,
                $15,
                'Global API',
                $16::uuid,
                coalesce($17::timestamptz, now()),
                now()
              )
              returning id::text
              `,
              [
                input.sourceSystem,
                input.sourceTourId,
                input.title,
                input.name,
                input.description,
                normalizedDates,
                input.departureDate,
                safeSeats,
                normalizedHotels,
                serializedServices,
                safeBasePrice,
                input.status,
                input.showInProvider,
                input.showToUser,
                input.imageKey,
                input.createdBy,
                input.sourceUpdatedAt,
              ],
            );
      } else {
        inserted = supportsGlobalProfileColumns
          ? await client.query<{ id: string }>(
              `
              insert into public.tours (
                title,
                name,
                description,
                dates,
                departuredate,
                seats,
                available_seats,
                hotels,
                services,
                base_price,
                status,
                show_in_provider,
                show_to_user,
                image_key,
                cover_photo,
                country,
                hotel,
                country_temperature,
                duration_day,
                duration_night,
                group_size,
                is_featured,
                genre,
                airlines,
                creator_name,
                created_by,
                created_at,
                updated_at
              )
              values (
                $1,
                $2,
                $3,
                $4::text[],
                $5,
                $6,
                $6,
                $7::text[],
                $8::jsonb,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18,
                $19,
                $20,
                $21,
                $22,
                $23::text[],
                'Global API',
                $24::uuid,
                coalesce($25::timestamptz, now()),
                now()
              )
              returning id::text
              `,
              [
                input.title,
                input.name,
                input.description,
                normalizedDates,
                input.departureDate,
                safeSeats,
                normalizedHotels,
                serializedServices,
                safeBasePrice,
                input.status,
                input.showInProvider,
                input.showToUser,
                input.imageKey,
                normalizedCoverPhoto,
                normalizedCountry,
                normalizedHotel,
                normalizedCountryTemperature,
                normalizedDurationDay,
                normalizedDurationNight,
                normalizedGroupSize,
                normalizedIsFeatured,
                normalizedGenre,
                normalizedAirlines,
                input.createdBy,
                input.sourceUpdatedAt,
              ],
            )
          : await client.query<{ id: string }>(
              `
              insert into public.tours (
                title,
                name,
                description,
                dates,
                departuredate,
                seats,
                available_seats,
                hotels,
                services,
                base_price,
                status,
                show_in_provider,
                show_to_user,
                image_key,
                creator_name,
                created_by,
                created_at,
                updated_at
              )
              values (
                $1,
                $2,
                $3,
                $4::text[],
                $5,
                $6,
                $6,
                $7::text[],
                $8::jsonb,
                $9,
                $10,
                $11,
                $12,
                $13,
                'Global API',
                $14::uuid,
                coalesce($15::timestamptz, now()),
                now()
              )
              returning id::text
              `,
              [
                input.title,
                input.name,
                input.description,
                normalizedDates,
                input.departureDate,
                safeSeats,
                normalizedHotels,
                serializedServices,
                safeBasePrice,
                input.status,
                input.showInProvider,
                input.showToUser,
                input.imageKey,
                input.createdBy,
                input.sourceUpdatedAt,
              ],
            );
      }

      return {
        id: inserted.rows[0]?.id || "",
        action: "inserted" as const,
      };
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "23505") {
        throw error;
      }

      const retryTarget = await resolveTarget();
      if (!retryTarget) {
        throw error;
      }

      return updateExisting(retryTarget.id, retryTarget.action);
    }
  }

  return updateExisting(target.id, target.action);
}

type TourColumnRow = {
  column_name: string;
};

async function getTourColumnSet(client: PoolClient) {
  const result = await client.query<TourColumnRow>(
    `
    select lower(column_name) as column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tours'
    `,
  );

  return new Set(
    result.rows
      .map((row) => row.column_name)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
}

export async function upsertTourFromSourceLegacyCompatRepo(
  client: PoolClient,
  input: TourSyncRowInput,
) {
  const columnSet = await getTourColumnSet(client);

  const safeSeats = Math.max(0, Math.floor(Number(input.seats || 0) || 0));
  const safeBasePrice = Number.isFinite(input.basePrice)
    ? Math.max(0, Number(input.basePrice || 0))
    : 0;
  const normalizedDates = input.dates
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);
  const normalizedCoverPhoto =
    typeof input.coverPhoto === "string" && input.coverPhoto.trim().length > 0
      ? input.coverPhoto.trim()
      : null;
  const normalizedCountry =
    typeof input.country === "string" && input.country.trim().length > 0
      ? input.country.trim()
      : null;
  const normalizedHotel =
    typeof input.hotel === "string" && input.hotel.trim().length > 0
      ? input.hotel.trim()
      : null;
  const normalizedCountryTemperature =
    typeof input.countryTemperature === "string" && input.countryTemperature.trim().length > 0
      ? input.countryTemperature.trim()
      : null;
  const normalizedDurationDay =
    typeof input.durationDay === "string" && input.durationDay.trim().length > 0
      ? input.durationDay.trim()
      : null;
  const normalizedDurationNight =
    typeof input.durationNight === "string" && input.durationNight.trim().length > 0
      ? input.durationNight.trim()
      : null;
  const normalizedGroupSize =
    typeof input.groupSize === "string" && input.groupSize.trim().length > 0
      ? input.groupSize.trim()
      : null;
  const normalizedGenre =
    typeof input.genre === "string" && input.genre.trim().length > 0
      ? input.genre.trim()
      : null;
  const normalizedAirlines = (input.airlines || [])
    .map((airline) => String(airline || "").trim())
    .filter((airline) => airline.length > 0);
  const normalizedHotels = (input.hotels || [])
    .map((hotel) => String(hotel || "").trim())
    .filter((hotel) => hotel.length > 0);
  const serializedServices = JSON.stringify(
    (input.services || []).map((service) => ({
      name: String(service.name || "").trim(),
      price: Number.isFinite(service.price) ? Number(service.price) : 0,
    })),
  );

  const bySourceId = await client.query<{ id: string }>(
    `
    select id::text as id
    from public.tours
    where id::text = $1::text
    limit 1
    `,
    [input.sourceTourId],
  );

  let targetId = bySourceId.rows[0]?.id || null;
  let action: TourSyncAction = targetId ? "updated" : "inserted";

  if (!targetId) {
    const byTitle = await client.query<{ id: string }>(
      `
      select id::text as id
      from public.tours
      where lower(trim(coalesce(title, ''))) = lower(trim($1))
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
      `,
      [input.title],
    );

    if (byTitle.rows[0]?.id) {
      targetId = byTitle.rows[0].id;
      action = "linked";
    }
  }

  const addAssignment = (
    assignments: string[],
    values: unknown[],
    column: string,
    value: unknown,
    cast = "",
  ) => {
    if (!columnSet.has(column)) {
      return;
    }

    values.push(value);
    assignments.push(`${column} = $${values.length}${cast}`);
  };

  const addInsert = (
    columns: string[],
    placeholders: string[],
    values: unknown[],
    column: string,
    value: unknown,
    cast = "",
  ) => {
    if (!columnSet.has(column)) {
      return;
    }

    values.push(value);
    columns.push(column);
    placeholders.push(`$${values.length}${cast}`);
  };

  if (targetId) {
    const assignments: string[] = [];
    const values: unknown[] = [];

    addAssignment(assignments, values, "source_system", input.sourceSystem.toLowerCase());
    addAssignment(assignments, values, "source_tour_id", input.sourceTourId);
    addAssignment(assignments, values, "title", input.title);
    addAssignment(assignments, values, "name", input.name);
    addAssignment(assignments, values, "description", input.description);
    addAssignment(assignments, values, "dates", normalizedDates, "::text[]");
    addAssignment(assignments, values, "departuredate", input.departureDate, "::date");
    addAssignment(assignments, values, "seats", safeSeats);
    addAssignment(assignments, values, "available_seats", safeSeats);
    addAssignment(assignments, values, "base_price", safeBasePrice);
    addAssignment(assignments, values, "hotels", normalizedHotels, "::text[]");
    addAssignment(assignments, values, "services", serializedServices, "::jsonb");
    addAssignment(assignments, values, "image_key", input.imageKey);
    addAssignment(assignments, values, "cover_photo", normalizedCoverPhoto);
    addAssignment(assignments, values, "country", normalizedCountry);
    addAssignment(assignments, values, "hotel", normalizedHotel);
    addAssignment(assignments, values, "country_temperature", normalizedCountryTemperature);
    addAssignment(assignments, values, "duration_day", normalizedDurationDay);
    addAssignment(assignments, values, "duration_night", normalizedDurationNight);
    addAssignment(assignments, values, "group_size", normalizedGroupSize);
    addAssignment(assignments, values, "is_featured", Boolean(input.isFeatured));
    addAssignment(assignments, values, "genre", normalizedGenre);
    addAssignment(assignments, values, "airlines", normalizedAirlines, "::text[]");
    addAssignment(assignments, values, "show_in_provider", input.showInProvider);
    addAssignment(assignments, values, "show_to_user", input.showToUser);

    if (columnSet.has("updated_at")) {
      assignments.push("updated_at = now()");
    }

    if (assignments.length > 0) {
      values.push(targetId);
      await client.query(
        `
        update public.tours
        set ${assignments.join(",\n            ")}
        where id::text = $${values.length}::text
        `,
        values,
      );
    }

    return {
      id: targetId,
      action,
    } satisfies { id: string; action: TourSyncAction };
  }

  const insertColumns: string[] = [];
  const insertPlaceholders: string[] = [];
  const insertValues: unknown[] = [];

  addInsert(insertColumns, insertPlaceholders, insertValues, "id", input.sourceTourId);
  addInsert(insertColumns, insertPlaceholders, insertValues, "source_system", input.sourceSystem.toLowerCase());
  addInsert(insertColumns, insertPlaceholders, insertValues, "source_tour_id", input.sourceTourId);
  addInsert(insertColumns, insertPlaceholders, insertValues, "title", input.title);
  addInsert(insertColumns, insertPlaceholders, insertValues, "name", input.name);
  addInsert(insertColumns, insertPlaceholders, insertValues, "description", input.description);
  addInsert(insertColumns, insertPlaceholders, insertValues, "dates", normalizedDates, "::text[]");
  addInsert(insertColumns, insertPlaceholders, insertValues, "departuredate", input.departureDate, "::date");
  addInsert(insertColumns, insertPlaceholders, insertValues, "seats", safeSeats);
  addInsert(insertColumns, insertPlaceholders, insertValues, "available_seats", safeSeats);
  addInsert(insertColumns, insertPlaceholders, insertValues, "base_price", safeBasePrice);
  addInsert(insertColumns, insertPlaceholders, insertValues, "hotels", normalizedHotels, "::text[]");
  addInsert(insertColumns, insertPlaceholders, insertValues, "services", serializedServices, "::jsonb");
  addInsert(insertColumns, insertPlaceholders, insertValues, "image_key", input.imageKey);
  addInsert(insertColumns, insertPlaceholders, insertValues, "cover_photo", normalizedCoverPhoto);
  addInsert(insertColumns, insertPlaceholders, insertValues, "country", normalizedCountry);
  addInsert(insertColumns, insertPlaceholders, insertValues, "hotel", normalizedHotel);
  addInsert(insertColumns, insertPlaceholders, insertValues, "country_temperature", normalizedCountryTemperature);
  addInsert(insertColumns, insertPlaceholders, insertValues, "duration_day", normalizedDurationDay);
  addInsert(insertColumns, insertPlaceholders, insertValues, "duration_night", normalizedDurationNight);
  addInsert(insertColumns, insertPlaceholders, insertValues, "group_size", normalizedGroupSize);
  addInsert(insertColumns, insertPlaceholders, insertValues, "is_featured", Boolean(input.isFeatured));
  addInsert(insertColumns, insertPlaceholders, insertValues, "genre", normalizedGenre);
  addInsert(insertColumns, insertPlaceholders, insertValues, "airlines", normalizedAirlines, "::text[]");
  addInsert(insertColumns, insertPlaceholders, insertValues, "show_in_provider", input.showInProvider);
  addInsert(insertColumns, insertPlaceholders, insertValues, "show_to_user", input.showToUser);

  if (columnSet.has("creator_name")) {
    insertColumns.push("creator_name");
    insertPlaceholders.push("'Global API'");
  }
  if (columnSet.has("created_by")) {
    insertValues.push(input.createdBy);
    insertColumns.push("created_by");
    insertPlaceholders.push(`$${insertValues.length}`);
  }
  if (columnSet.has("created_at")) {
    insertColumns.push("created_at");
    insertPlaceholders.push("now()");
  }
  if (columnSet.has("updated_at")) {
    insertColumns.push("updated_at");
    insertPlaceholders.push("now()");
  }

  if (insertColumns.length === 0) {
    throw new Error("Cannot upsert tour: no compatible columns found in public.tours");
  }

  const inserted = await client.query<{ id: string }>(
    `
    insert into public.tours (${insertColumns.join(", ")})
    values (${insertPlaceholders.join(", ")})
    returning id::text
    `,
    insertValues,
  );

  return {
    id: inserted.rows[0]?.id || input.sourceTourId,
    action: "inserted" as const,
  };
}
