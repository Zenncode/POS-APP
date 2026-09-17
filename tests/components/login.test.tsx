import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "~/routes/login";
import { ApiError } from "~/lib/httpClient";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  authUser: null as { id: string } | null,
  authLoading: false,
  NavigateCapture: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean }) => {
      mocks.NavigateCapture(props);
      return null;
    },
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("~/shared/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.authUser,
    loading: mocks.authLoading,
    demoMode: false,
    signIn: mocks.signIn,
    signOut: vi.fn(),
  }),
}));

describe("Login", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.signIn.mockReset();
    mocks.authUser = null;
    mocks.authLoading = false;
    mocks.NavigateCapture.mockClear();
  });

  function fillForm(email = "cashier.test@example.invalid", password = "correct-horse"): void {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), { target: { value: password } });
  }

  it("renders the wordmark, both fields, and the admin-reset note", () => {
    render(<Login />);
    expect(screen.getByRole("heading", { name: "Point of Sale" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByText(/ask an administrator to reset it/i)).toBeInTheDocument();
  });

  it("shows an inline error and blocks submit for an invalid email", () => {
    render(<Login />);
    fillForm("not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("shows an inline error and blocks submit for an empty password", () => {
    render(<Login />);
    fillForm("cashier.test@example.invalid", "");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("surfaces the ApiError message verbatim (rate-limit lockout)", async () => {
    mocks.signIn.mockRejectedValueOnce(
      new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests, please try again later"),
    );
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByText("Too many requests, please try again later")).toBeInTheDocument(),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("falls back to the generic message and hides raw error text for non-ApiError failures", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("stack trace with internals"));
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByText("Sign in failed. Check your email and password.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/stack trace with internals/)).not.toBeInTheDocument();
  });

  it("redirects to /register on success", async () => {
    mocks.signIn.mockResolvedValueOnce(undefined);
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/register", { replace: true }));
  });

  it("shows pending label and disables submit while busy", async () => {
    mocks.signIn.mockImplementationOnce(() => new Promise<void>(() => {}));
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const pending = await screen.findByRole("button", { name: /signing in/i });
    expect(pending).toBeDisabled();
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.signIn).toHaveBeenCalledWith("cashier.test@example.invalid", "correct-horse");
  });

  it("re-enables submit after a 429 failure", async () => {
    mocks.signIn.mockRejectedValueOnce(
      new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests, please try again later"),
    );
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByText("Too many requests, please try again later")).toBeInTheDocument(),
    );
    const retry = await screen.findByRole("button", { name: "Sign in" });
    expect(retry).not.toBeDisabled();
  });

  it("redirects when authed and renders nothing while loading (no flash)", () => {
    mocks.authUser = { id: "u1" };
    mocks.authLoading = false;
    const { unmount } = render(<Login />);
    expect(mocks.NavigateCapture).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/register", replace: true }),
    );
    unmount();
    mocks.NavigateCapture.mockClear();
    mocks.authUser = { id: "u1" };
    mocks.authLoading = true;
    render(<Login />);
    expect(mocks.NavigateCapture).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Point of Sale" })).not.toBeInTheDocument();
  });

  it("routes a server error to the Password field only for a valid email", async () => {
    mocks.signIn.mockRejectedValueOnce(new ApiError(401, "UNAUTHENTICATED", "Invalid credentials"));
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(screen.getByLabelText(/email/i, { selector: "input" })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText(/password/i, { selector: "input" })).toHaveAttribute("aria-invalid", "true");
  });

  it("submits only once on double submit while busy", async () => {
    mocks.signIn.mockImplementationOnce(() => new Promise<void>(() => {}));
    render(<Login />);
    fillForm();
    const button = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(button);
    const pending = await screen.findByRole("button", { name: /signing in/i });
    fireEvent.click(pending);
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it("clears a stale error on retry", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("boom"));
    mocks.signIn.mockResolvedValueOnce(undefined);
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(
        screen.getByText("Sign in failed. Check your email and password."),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/register", { replace: true }));
    expect(
      screen.queryByText("Sign in failed. Check your email and password."),
    ).not.toBeInTheDocument();
  });

  it("trims surrounding spaces before sign-in", async () => {
    mocks.signIn.mockResolvedValueOnce(undefined);
    render(<Login />);
    fillForm("  cashier.test@example.invalid  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("cashier.test@example.invalid", "correct-horse"),
    );
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/register", { replace: true }));
  });

  it("surfaces the ApiError message verbatim (offline)", async () => {
    mocks.signIn.mockRejectedValueOnce(new ApiError(0, "NETWORK_OFFLINE", "You are offline"));
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText("You are offline")).toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("masks unsafe ApiError codes with the generic message and leaks nothing", async () => {
    mocks.signIn.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "db conn failed at 10.0.0.1"));
    render(<Login />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByText("Sign in failed. Check your email and password.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/db conn/)).not.toBeInTheDocument();
  });
});

