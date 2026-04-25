import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { AuthUser } from "../../shared/types/auth.js";
import { ApiError } from "../../shared/http/errors.js";
import {
  __resetPushGlobalTourServiceDepsForTests,
  __resetSearchToursServiceDepsForTests,
  __setPushGlobalTourServiceDepsForTests,
  __setSearchToursServiceDepsForTests,
  pushGlobalTourService,
  searchToursService,
} from "./tours.service.js";
import { env } from "../../config/env.js";

const ACCESS_REQUEST_ID = "2f9d2ee4-908d-49f9-a7d6-2e84c2debbd8";

afterEach(() => {
  env.globalToursWriteEnabled = false;
  __resetPushGlobalTourServiceDepsForTests();
  __resetSearchToursServiceDepsForTests();
});

const adminUser: AuthUser = {
  id: "admin-1",
  role: "admin",
  organizationId: null,
};

test("strict subcontractor search does not relax destination fallback", async () => {
  const calls: Array<{
    from: string;
    to: string;
    destination?: string;
    minSeats?: number;
  }> = [];

  __setSearchToursServiceDepsForTests({
    searchToursRepo: async (filters) => {
      calls.push(filters);
      return [];
    },
    getSeatAccessRequestByIdRepo: async () => {
      return {
        id: ACCESS_REQUEST_ID,
        requester_user_id: "user-1",
        organization_id: "org-1",
        requester_role: "subcontractor",
        from_date: "2026-03-01",
        to_date: "2026-03-31",
        destination: "Tokyo",
        planned_seats: 4,
        status: "approved",
        expires_at: null,
        seat_request_id: null,
      } as Awaited<
        ReturnType<
          NonNullable<
            Parameters<typeof __setSearchToursServiceDepsForTests>[0]["getSeatAccessRequestByIdRepo"]
          >
        >
      >;
    },
  });

  const user: AuthUser = {
    id: "user-1",
    role: "subcontractor",
    organizationId: "org-1",
  };

  const rows = await searchToursService(user, {
    from: "2026-03-10",
    to: "2026-03-20",
    destination: "Paris",
    accessRequestId: ACCESS_REQUEST_ID,
  });

  assert.deepEqual(rows, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].destination, "Tokyo");
});

test("admin search still uses destination relaxation fallback", async () => {
  const calls: Array<{
    from: string;
    to: string;
    destination?: string;
    minSeats?: number;
  }> = [];

  __setSearchToursServiceDepsForTests({
    searchToursRepo: async (filters) => {
      calls.push(filters);

      if (calls.length === 1) {
        return [];
      }

      return [
        {
          id: "tour-1",
          title: "Mars Escape",
          destination: "Mars",
          departure_date: "2026-04-10",
          base_price: 1500000,
          capacity: 20,
          available_seats: 12,
        },
      ];
    },
  });

  const user: AuthUser = {
    id: "admin-1",
    role: "admin",
    organizationId: null,
  };

  const rows = await searchToursService(user, {
    from: "2026-04-01",
    to: "2026-04-30",
    destination: "Tokyo",
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].destination, "Tokyo");
  assert.equal(calls[1].destination, undefined);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "tour-1");
});

test("pushGlobalTourService delete treats remote 404 as deleted", async () => {
  env.globalToursWriteEnabled = true;

  __setPushGlobalTourServiceDepsForTests({
    deleteGlobalTour: async () => {
      throw new Error("Global API DELETE /api/tours/id failed (404): not found");
    },
  });

  const result = await pushGlobalTourService(adminUser, {
    action: "delete",
    localTourId: "local-1",
    remoteTourId: "remote-1",
    tour: null,
  });

  assert.equal(result.remoteAction, "deleted");
  assert.equal(result.remoteTourId, "remote-1");
  assert.equal(Boolean(result.warning), true);
});

test("pushGlobalTourService returns warning when price-row sync fails", async () => {
  env.globalToursWriteEnabled = true;

  let linkCalled = false;

  __setPushGlobalTourServiceDepsForTests({
    createGlobalTour: async () => ({ id: "remote-created" }),
    extractGlobalTourId: () => "remote-created",
    linkLocalTourToGlobalSource: async () => {
      linkCalled = true;
    },
    findRawGlobalTourByRemoteId: async () => null,
    syncGlobalPriceRowForPush: async () => {
      throw new Error("price row endpoint unavailable");
    },
  });

  const result = await pushGlobalTourService(adminUser, {
    action: "create",
    localTourId: "local-2",
    remoteTourId: null,
    tour: {
      title: "Test Tour",
      departure_date: "2026-05-10",
      seats: 8,
      base_price: 1200,
    },
  });

  assert.equal(result.remoteAction, "created");
  assert.equal(result.remoteTourId, "remote-created");
  assert.equal(linkCalled, true);
  assert.equal(
    result.warning?.includes("Global price row sync failed: price row endpoint unavailable"),
    true,
  );
});

test("pushGlobalTourService update falls back to create when remote is missing", async () => {
  env.globalToursWriteEnabled = true;

  let updateCalled = 0;
  let createCalled = 0;
  let linkedRemoteId: string | null = null;

  __setPushGlobalTourServiceDepsForTests({
    updateGlobalTour: async () => {
      updateCalled += 1;
      throw new Error("Global API PUT /api/tours/id failed (404): tour not found");
    },
    createGlobalTour: async () => {
      createCalled += 1;
      return { data: { id: "remote-fallback" } };
    },
    extractGlobalTourId: (payload) => {
      if (!payload || typeof payload !== "object") return null;
      const nested = (payload as { data?: { id?: string } }).data;
      return nested?.id || null;
    },
    linkLocalTourToGlobalSource: async (_localTourId, remoteTourId) => {
      linkedRemoteId = remoteTourId;
    },
    findRawGlobalTourByRemoteId: async () => null,
    syncGlobalPriceRowForPush: async () => ({
      warning: "Global price row sync skipped in fallback test.",
      tableName: null,
      rowId: null,
      seats: null,
    }),
  });

  const result = await pushGlobalTourService(adminUser, {
    action: "update",
    localTourId: "local-3",
    remoteTourId: "remote-old",
    tour: {
      title: "Fallback Tour",
      departure_date: "2026-06-01",
      seats: 10,
      base_price: 1100,
    },
  });

  assert.equal(updateCalled, 1);
  assert.equal(createCalled, 1);
  assert.equal(result.remoteAction, "created");
  assert.equal(result.remoteTourId, "remote-fallback");
  assert.equal(linkedRemoteId, "remote-fallback");
  assert.equal(
    result.warning?.includes("Global price row sync skipped in fallback test."),
    true,
  );
});

test("pushGlobalTourService delete skips when remote id is missing", async () => {
  env.globalToursWriteEnabled = true;

  let deleteCalled = false;
  __setPushGlobalTourServiceDepsForTests({
    deleteGlobalTour: async () => {
      deleteCalled = true;
    },
  });

  const result = await pushGlobalTourService(adminUser, {
    action: "delete",
    localTourId: "local-4",
    remoteTourId: null,
    tour: null,
  });

  assert.equal(deleteCalled, false);
  assert.equal(result.remoteAction, "skipped");
  assert.equal(result.remoteTourId, null);
  assert.equal(
    result.warning?.includes("Missing remote tour id. Local row deleted, remote delete skipped."),
    true,
  );
});

test("pushGlobalTourService warns when remote id is absent in create response", async () => {
  env.globalToursWriteEnabled = true;

  let linkCalled = false;
  let rowSyncCalled = false;

  __setPushGlobalTourServiceDepsForTests({
    createGlobalTour: async () => ({}),
    extractGlobalTourId: () => null,
    linkLocalTourToGlobalSource: async () => {
      linkCalled = true;
    },
    syncGlobalPriceRowForPush: async () => {
      rowSyncCalled = true;
      return {
        warning: "Unexpected row sync call",
        tableName: null,
        rowId: null,
        seats: null,
      };
    },
  });

  const result = await pushGlobalTourService(adminUser, {
    action: "create",
    localTourId: "local-5",
    remoteTourId: null,
    tour: {
      title: "No ID Tour",
      departure_date: "2026-07-01",
      seats: 9,
      base_price: 1300,
    },
  });

  assert.equal(result.remoteAction, "created");
  assert.equal(result.remoteTourId, null);
  assert.equal(linkCalled, false);
  assert.equal(rowSyncCalled, false);
  assert.equal(
    result.warning?.includes("Global API response did not include remote tour id."),
    true,
  );
});

test("pushGlobalTourService rejects non-admin and non-manager roles", async () => {
  env.globalToursWriteEnabled = true;

  const user: AuthUser = {
    id: "sub-1",
    role: "subcontractor",
    organizationId: "org-1",
  };

  await assert.rejects(
    () =>
      pushGlobalTourService(user, {
        action: "create",
        localTourId: "local-6",
        remoteTourId: null,
        tour: {
          title: "No Access Tour",
          departure_date: "2026-08-01",
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test("pushGlobalTourService honors write disable kill switch", async () => {
  env.globalToursWriteEnabled = false;

  await assert.rejects(
    () =>
      pushGlobalTourService(adminUser, {
        action: "create",
        localTourId: "local-7",
        remoteTourId: null,
        tour: {
          title: "Flag Off Tour",
          departure_date: "2026-09-01",
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});
