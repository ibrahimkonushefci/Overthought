export interface DeleteGuestDataAdapter {
  deleteGuestVerdicts: (guestKeyHash: string) => Promise<void>;
  deleteGuestUsageEvents: (guestKeyHash: string) => Promise<void>;
}

export interface DeleteGuestDataDeps {
  data: DeleteGuestDataAdapter;
  hash?: (value: string) => Promise<string>;
}

export interface DeleteGuestDataHttpResult {
  status: number;
  body:
    | { ok: true }
    | { ok: false; code: 'invalid_guest_key' | 'delete_failed'; message: string };
}

function isValidGuestKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 16 &&
    value.trim().length <= 256 &&
    /^[A-Za-z0-9:_-]+$/.test(value.trim())
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function handleDeleteGuestDataRequest(
  payload: unknown,
  deps: DeleteGuestDataDeps,
): Promise<DeleteGuestDataHttpResult> {
  const guestKey =
    payload && typeof payload === 'object' && 'guestKey' in payload
      ? (payload as { guestKey?: unknown }).guestKey
      : null;

  if (!isValidGuestKey(guestKey)) {
    return {
      status: 400,
      body: { ok: false, code: 'invalid_guest_key', message: 'A valid guest key is required.' },
    };
  }

  const hash = deps.hash ?? sha256Hex;
  const guestKeyHash = await hash(`guest-key:${guestKey.trim()}`);

  try {
    await deps.data.deleteGuestVerdicts(guestKeyHash);
    await deps.data.deleteGuestUsageEvents(guestKeyHash);
    return { status: 200, body: { ok: true } };
  } catch {
    return {
      status: 500,
      body: { ok: false, code: 'delete_failed', message: 'Guest server data could not be deleted.' },
    };
  }
}
