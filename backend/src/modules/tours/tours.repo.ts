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

let hasGlobalProfileColumnsCache: boolean | null = null;

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

export async function searchToursRepo(filters: {
  from: string;
  to: string;
  destination?: string;
  minSeats?: number;
  minPrice?: number;
  maxPrice?: number;
}) {
  const params: unknown[] = [filters.from, filters.to];
  const conditions: string[] = [
    `d.departure_date >= $1::date`,
    `d.departure_date <= $2::date`,
  ];

  if (filters.destination) {
    params.push(filters.destination);
    conditions.push(`coalesce(t.title, '') ilike ('%' || $${params.length} || '%')`);
  }
  if (typeof filters.minPrice === "number") {
    params.push(filters.minPrice);
    conditions.push(`coalesce(t.base_price, 0) >= $${params.length}`);
  }
  if (typeof filters.maxPrice === "number") {
    params.push(filters.maxPrice);
    conditions.push(`coalesce(t.base_price, 0) <= $${params.length}`);
  }

  const rows = await q<TourSearchRow>(
    `
    with departure_dates as (
      select
        t.id::text as tour_id,
        unnest(
          case
            when pg_typeof(t.dates)::text = 'text[]' then t.dates
            else array[]::text[]
          end
        )::date as departure_date
      from public.tours t
    )
    select
      t.id::text,
      t.title,
      t.title as destination,
      d.departure_date,
      coalesce(t.base_price, 0) as base_price,
      coalesce(t.seats, 0) as capacity,
      stats.remaining as available_seats
    from public.tours t
    join departure_dates d on d.tour_id = t.id::text
    left join lateral public.get_departure_seats(t.id::text, d.departure_date::text) stats on true
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

async function findTourUpsertTargetRepo(
  params: {
    sourceSystem: string;
    sourceTourId: string;
    title: string;
    departureDate: string | null;
  },
  client?: PoolClient,
): Promise<TourUpsertTarget> {
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
        and coalesce(btrim(t.source_tour_id), '') = ''
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
      and coalesce(btrim(t.source_tour_id), '') = ''
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
  const supportsGlobalProfileColumns = await hasGlobalProfileColumns(client);

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
    const updated = supportsGlobalProfileColumns
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
          where id = $26::uuid
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
          where id = $16::uuid
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

    return {
      id: updated.rows[0]?.id || existingId,
      action,
    };
  };

  if (!target) {
    try {
      const inserted = supportsGlobalProfileColumns
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

      return {
        id: inserted.rows[0]?.id || "",
        action: "inserted" as const,
      };
    } catch (error: any) {
      if (error?.code !== "23505") {
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
