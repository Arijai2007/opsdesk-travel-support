import {
  receiveReplyText,
  replyAddress,
  replyJob,
  replySender,
} from './resend-mail-reply';

const config = {
  domain: 'reply.example.com',
  secret: '12'.repeat(32),
  apiKey: 'fixture-receiving-key',
};
const job = 'cl0123456789abcdefghijkl';
const providerId = '56761188-7520-42d8-8898-ff6fc54ce618';

describe('Resend customer reply capability', () => {
  afterEach(() => jest.restoreAllMocks());

  it('binds a private address to one issued job and one receiving domain', () => {
    const address = replyAddress(config, job);
    const differentJob = 'cl0987654321abcdefghijkl';
    expect(replyJob(config, [address])).toBe(job);
    expect(replyJob(config, [address.replace(job, differentJob)])).toBeNull();
    expect(
      replyJob(config, [address.replace(config.domain, 'other.example.com')]),
    ).toBeNull();
    expect(
      replyJob({ ...config, secret: '34'.repeat(32) }, [address]),
    ).toBeNull();
    expect(replyJob(config, [address, address])).toBeNull();
    expect(replyJob(config, ['r+' + job + '@' + config.domain])).toBeNull();
  });

  it('accepts a single mailbox and rejects ambiguous or multiline senders', () => {
    expect(replySender('Traveler <customer@example.com>')).toBe(
      'customer@example.com',
    );
    expect(replySender('first@example.com, second@example.com')).toBeNull();
    expect(replySender('customer@example.com\r\n')).toBeNull();
  });

  it('reads only bounded plaintext from the expected provider email', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      Response.json({
        id: providerId,
        text: '  Customer reply  ',
        html: '<script>ignore</script>',
        attachments: [{ filename: 'ignore.pdf' }],
      }),
    );
    await expect(receiveReplyText(config, providerId)).resolves.toBe(
      'Customer reply',
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.resend.com/emails/receiving/' + providerId,
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: providerId, html: '<p>HTML only</p>' }),
    );
    await expect(receiveReplyText(config, providerId)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: 'wrong-id', text: 'wrong email' }),
    );
    await expect(receiveReplyText(config, providerId)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: providerId, text: 'a'.repeat(10_001) }),
    );
    await expect(receiveReplyText(config, providerId)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(
      Response.json({
        id: providerId,
        text: 'small',
        html: 'x'.repeat(300_000),
      }),
    );
    await expect(receiveReplyText(config, providerId)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(receiveReplyText(config, providerId)).rejects.toMatchObject({
      status: 503,
    });
  });
});
