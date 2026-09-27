/**
 * Guest-authenticated room API helper with one-shot 401 recovery.
 * On 401 (invalid/expired guest JWT): signOut → anonymous signIn → retry once.
 * A second failure surfaces the error; never loops.
 */

export type GuestCredentials = { accessToken: string; guestId: string };

export type GuestRoomAuth = {
  ensure: () => Promise<GuestCredentials | null>;
  recover: () => Promise<GuestCredentials | null>;
};

export type GuestRequestResult = {
  status: number;
  error?: string;
  data?: unknown;
};

export type GuestRequestOk = {
  data: unknown;
  guestId: string;
  accessToken: string;
};

/**
 * Run a guest-authenticated room request. If the first attempt returns 401,
 * recover the guest session once and retry the same request exactly once.
 */
export async function requestWithGuestRetry(
  request: (accessToken: string) => Promise<GuestRequestResult>,
  auth: GuestRoomAuth,
  options?: { connectError?: string; failureFallback?: string },
): Promise<GuestRequestOk> {
  const guest = await auth.ensure();
  if (!guest) {
    throw new Error(options?.connectError ?? 'Connect Supabase before creating or joining a room.');
  }

  let credentials = guest;
  let result = await request(credentials.accessToken);

  if (result.status === 401) {
    const recovered = await auth.recover();
    if (!recovered) {
      throw new Error(result.error ?? 'The guest session is invalid or expired.');
    }
    credentials = recovered;
    result = await request(credentials.accessToken);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.error ?? options?.failureFallback ?? 'Room request failed.');
  }

  return {
    data: result.data,
    guestId: credentials.guestId,
    accessToken: credentials.accessToken,
  };
}

/** Parse a fetch Response into the shape requestWithGuestRetry expects. */
export async function readGuestRequestResult(response: Response): Promise<GuestRequestResult> {
  const payload = await response.json().catch(() => ({}));
  const error = typeof payload === 'object' && payload && 'error' in payload && typeof (payload as { error: unknown }).error === 'string'
    ? (payload as { error: string }).error
    : undefined;
  return { status: response.status, error, data: payload };
}
