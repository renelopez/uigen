import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();

vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();

vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

afterEach(cleanup);

test("returns signIn, signUp, and isLoading", () => {
  const { result } = renderHook(() => useAuth());
  expect(typeof result.current.signIn).toBe("function");
  expect(typeof result.current.signUp).toBe("function");
  expect(result.current.isLoading).toBe(false);
});

test("isLoading is true during signIn and false after", async () => {
  let resolveSignIn!: (v: unknown) => void;
  mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));
  mockGetProjects.mockResolvedValue([]);

  const { result } = renderHook(() => useAuth());

  act(() => { result.current.signIn("a@b.com", "pass"); });
  expect(result.current.isLoading).toBe(true);

  await act(async () => { resolveSignIn({ success: false }); });
  expect(result.current.isLoading).toBe(false);
});

test("isLoading is true during signUp and false after", async () => {
  let resolveSignUp!: (v: unknown) => void;
  mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

  const { result } = renderHook(() => useAuth());

  act(() => { result.current.signUp("a@b.com", "pass"); });
  expect(result.current.isLoading).toBe(true);

  await act(async () => { resolveSignUp({ success: false }); });
  expect(result.current.isLoading).toBe(false);
});

test("signIn returns result from action", async () => {
  mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());
  let returnValue: unknown;

  await act(async () => {
    returnValue = await result.current.signIn("a@b.com", "wrong");
  });

  expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
});

test("signUp returns result from action", async () => {
  mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());
  let returnValue: unknown;

  await act(async () => {
    returnValue = await result.current.signUp("a@b.com", "pass");
  });

  expect(returnValue).toEqual({ success: false, error: "Email already registered" });
});

test("signIn does not navigate when action fails", async () => {
  mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("a@b.com", "wrong"); });

  expect(mockPush).not.toHaveBeenCalled();
});

test("signUp does not navigate when action fails", async () => {
  mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signUp("a@b.com", "pass"); });

  expect(mockPush).not.toHaveBeenCalled();
});

test("after successful signIn with no anon work and no projects, creates project and navigates", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "brand-new" });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("a@b.com", "pass"); });

  expect(mockCreateProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
  expect(mockPush).toHaveBeenCalledWith("/brand-new");
});

test("after successful signIn with existing projects, navigates to most recent project", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([{ id: "project-1" }, { id: "project-2" }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("a@b.com", "pass"); });

  expect(mockCreateProject).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/project-1");
});

test("after successful signIn with anon work, creates project from anon data and navigates", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  const anonMessages = [{ role: "user", content: "make a button" }];
  const anonFsData = { "/App.jsx": { content: "export default () => <button />" } };
  mockGetAnonWorkData.mockReturnValue({ messages: anonMessages, fileSystemData: anonFsData });
  mockCreateProject.mockResolvedValue({ id: "anon-project" });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("a@b.com", "pass"); });

  expect(mockCreateProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: anonMessages, data: anonFsData })
  );
  expect(mockClearAnonWork).toHaveBeenCalled();
  expect(mockGetProjects).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/anon-project");
});

test("anon work with empty messages array is treated as no anon work", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("a@b.com", "pass"); });

  expect(mockCreateProject).not.toHaveBeenCalled();
  expect(mockClearAnonWork).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/existing-project");
});

test("after successful signUp, same post-signin flow runs", async () => {
  mockSignUp.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-signup-project" });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signUp("new@user.com", "pass"); });

  expect(mockCreateProject).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/new-signup-project");
});

test("signIn passes email and password to action", async () => {
  mockSignIn.mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signIn("test@example.com", "mypassword"); });

  expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "mypassword");
});

test("signUp passes email and password to action", async () => {
  mockSignUp.mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());

  await act(async () => { await result.current.signUp("new@example.com", "securepass"); });

  expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "securepass");
});
