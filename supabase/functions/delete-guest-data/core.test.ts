import { handleDeleteGuestDataRequest, type DeleteGuestDataAdapter } from './core';

function adapter(overrides: Partial<DeleteGuestDataAdapter> = {}) {
  return {
    deleteGuestVerdicts: jest.fn(async () => undefined),
    deleteGuestUsageEvents: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('delete-guest-data core', () => {
  it('rejects invalid guest keys without deleting anything', async () => {
    const data = adapter();
    const result = await handleDeleteGuestDataRequest({ guestKey: 'short' }, { data });

    expect(result).toMatchObject({ status: 400, body: { ok: false, code: 'invalid_guest_key' } });
    expect(data.deleteGuestVerdicts).not.toHaveBeenCalled();
    expect(data.deleteGuestUsageEvents).not.toHaveBeenCalled();
  });

  it('hashes exactly like ai-verdict and deletes verdicts before remaining usage events', async () => {
    const calls: string[] = [];
    const data = adapter({
      deleteGuestVerdicts: jest.fn(async () => {
        calls.push('verdicts');
      }),
      deleteGuestUsageEvents: jest.fn(async () => {
        calls.push('usage');
      }),
    });
    const hash = jest.fn(async () => 'hashed-guest-key');

    const result = await handleDeleteGuestDataRequest(
      { guestKey: 'guest_install_key_123456789' },
      { data, hash },
    );

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(hash).toHaveBeenCalledWith('guest-key:guest_install_key_123456789');
    expect(data.deleteGuestVerdicts).toHaveBeenCalledWith('hashed-guest-key');
    expect(data.deleteGuestUsageEvents).toHaveBeenCalledWith('hashed-guest-key');
    expect(calls).toEqual(['verdicts', 'usage']);
  });

  it('reports a deletion failure and does not continue after verdict deletion fails', async () => {
    const data = adapter({
      deleteGuestVerdicts: jest.fn(async () => {
        throw new Error('database unavailable');
      }),
    });

    const result = await handleDeleteGuestDataRequest(
      { guestKey: 'guest_install_key_123456789' },
      { data, hash: async () => 'hashed-guest-key' },
    );

    expect(result).toMatchObject({ status: 500, body: { ok: false, code: 'delete_failed' } });
    expect(data.deleteGuestUsageEvents).not.toHaveBeenCalled();
  });

  it('reports partial failure when remaining usage-event cleanup fails', async () => {
    const data = adapter({
      deleteGuestUsageEvents: jest.fn(async () => {
        throw new Error('usage cleanup unavailable');
      }),
    });

    const result = await handleDeleteGuestDataRequest(
      { guestKey: 'guest_install_key_123456789' },
      { data, hash: async () => 'hashed-guest-key' },
    );

    expect(result).toMatchObject({ status: 500, body: { ok: false, code: 'delete_failed' } });
    expect(data.deleteGuestVerdicts).toHaveBeenCalledWith('hashed-guest-key');
    expect(data.deleteGuestUsageEvents).toHaveBeenCalledWith('hashed-guest-key');
  });
});
