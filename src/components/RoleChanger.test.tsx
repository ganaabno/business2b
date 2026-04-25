import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "../types/type";
import RoleChanger from "./RoleChanger";

const changeUserRoleAdminMock = vi.fn();
const listUsersAdminMock = vi.fn();
const listPendingUsersAdminMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock("../api/admin", () => ({
  changeUserRoleAdmin: (...args: unknown[]) => changeUserRoleAdminMock(...args),
  deleteUserAdmin: vi.fn(),
  listUsersAdmin: (...args: unknown[]) => listUsersAdminMock(...args),
  listPendingUsersAdmin: (...args: unknown[]) => listPendingUsersAdminMock(...args),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}));

function createUser(overrides: Partial<User> = {}): User {
  return {
    userId: "user-1",
    id: "user-1",
    first_name: "Admin",
    last_name: "User",
    username: "admin",
    role: "admin",
    phone: "",
    email: "admin@example.com",
    password: "",
    blacklist: false,
    company: "",
    access: "active",
    status: "approved",
    birth_date: "",
    id_card_number: "",
    travel_history: [],
    passport_number: "",
    passport_expire: "",
    allergy: "",
    emergency_phone: "",
    membership_rank: "",
    membership_points: 0,
    registered_by: "",
    createdBy: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    auth_user_id: "auth-user-1",
    ...overrides,
  };
}

describe("RoleChanger self role change guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersAdminMock.mockResolvedValue([]);
    listPendingUsersAdminMock.mockResolvedValue([]);
    changeUserRoleAdminMock.mockResolvedValue(null);
  });

  it("does not call API when self role change is cancelled", async () => {
    const currentUser = createUser();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <RoleChanger
        users={[currentUser]}
        setUsers={vi.fn()}
        currentUser={currentUser}
      />,
    );

    const roleSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(roleSelect, { target: { value: "manager" } });

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    expect(changeUserRoleAdminMock).not.toHaveBeenCalled();
  });

  it("shows info toast after successful self role change", async () => {
    const currentUser = createUser();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <RoleChanger
        users={[currentUser]}
        setUsers={vi.fn()}
        currentUser={currentUser}
      />,
    );

    const roleSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(roleSelect, { target: { value: "manager" } });

    await waitFor(() => {
      expect(changeUserRoleAdminMock).toHaveBeenCalledWith("user-1", "manager");
    });

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledWith(
        "Your role was updated. Refresh or sign in again if menus do not update immediately.",
      );
    });
  });
});
