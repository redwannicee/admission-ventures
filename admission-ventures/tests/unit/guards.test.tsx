import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../src/app/AuthProvider", () => ({ useAuth: () => auth.value }));
vi.mock("../../src/lib/supabase/client", () => ({ supabase: { rpc } }));

import { RequireAdmin, RequireAuth } from "../../src/app/guards";

const session = { access_token: "tok", user: { id: "u1" } };
const mount = (ui: React.ReactElement, path = "/admin") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin" element={ui} />
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/dashboard" element={<p>student dashboard</p>} />
      <Route path="/auth/mfa" element={<p>mfa page</p>} />
      <Route path="/private" element={ui} />
    </Routes>
  </MemoryRouter>);

beforeEach(() => rpc.mockReset());

describe("RequireAuth", () => {
  it("sends guests to login", () => {
    auth.value = { session: null, loading: false };
    mount(<RequireAuth><p>secret</p></RequireAuth>, "/private");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
  it("lets signed-in users through", () => {
    auth.value = { session, loading: false };
    mount(<RequireAuth><p>secret</p></RequireAuth>, "/private");
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});

describe("RequireAdmin", () => {
  it("keeps students out of the admin area", async () => {
    auth.value = { session, profile: { role: "student" }, loading: false, isAdminRole: false };
    mount(<RequireAdmin><p>admin area</p></RequireAdmin>);
    expect(await screen.findByText("student dashboard")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends admins without an MFA session to the MFA page", async () => {
    auth.value = { session, profile: { role: "admin" }, loading: false, isAdminRole: true };
    rpc.mockResolvedValue({ data: false });
    mount(<RequireAdmin><p>admin area</p></RequireAdmin>);
    expect(await screen.findByText("mfa page")).toBeInTheDocument();
  });
  it("admits an admin the database approves", async () => {
    auth.value = { session, profile: { role: "admin" }, loading: false, isAdminRole: true };
    rpc.mockResolvedValue({ data: true });
    mount(<RequireAdmin><p>admin area</p></RequireAdmin>);
    expect(await screen.findByText("admin area")).toBeInTheDocument();
  });
  it("does not bounce a real admin while the profile is still loading (regression)", async () => {
    // First render: session known, profile not yet loaded. Then the profile arrives.
    auth.value = { session, profile: null, loading: false, isAdminRole: false };
    rpc.mockResolvedValue({ data: true });
    const ui = <RequireAdmin><p>admin area</p></RequireAdmin>;
    const view = mount(ui);
    expect(screen.queryByText("mfa page")).not.toBeInTheDocument();
    auth.value = { session, profile: { role: "admin" }, loading: false, isAdminRole: true };
    view.rerender(<MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/admin" element={ui} /><Route path="/auth/mfa" element={<p>mfa page</p>} /></Routes></MemoryRouter>);
    expect(await screen.findByText("admin area")).toBeInTheDocument();
    expect(screen.queryByText("mfa page")).not.toBeInTheDocument();
  });
});
