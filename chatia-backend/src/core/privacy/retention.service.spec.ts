import { NotFoundException } from '@nestjs/common';
import { RetentionService } from '@/core/privacy/retention.service.js';

const DAY = 24 * 3600 * 1000;
const NOW = new Date('2026-10-15T03:00:00Z');

function build() {
  const repo = {
    deleteSessionsOlderThan: jest.fn().mockResolvedValue(0),
    deleteMessagesOlderThan: jest.fn().mockResolvedValue(0),
    findContact: jest.fn(),
    eraseContact: jest.fn(),
  };
  const cache = { tryLock: jest.fn().mockResolvedValue(true) };
  return {
    svc: new RetentionService(repo as never, cache as never),
    repo,
    cache,
  };
}

describe('RetentionService', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  describe('purgeExpired', () => {
    it('borra sesiones anteriores al plazo (90 días por defecto) y no toca mensajes (0 = apagado)', async () => {
      const { svc, repo } = build();
      repo.deleteSessionsOlderThan.mockResolvedValue(2);

      const report = await svc.purgeExpired(NOW);

      expect(report).toEqual({ sessionsDeleted: 2, messagesDeleted: 0 });
      const [cutoff, batch] = repo.deleteSessionsOlderThan.mock.calls[0] as [
        Date,
        number,
      ];
      expect(cutoff.getTime()).toBe(NOW.getTime() - 90 * DAY);
      expect(batch).toBe(1000);
      expect(repo.deleteMessagesOlderThan).not.toHaveBeenCalled();
    });

    it('borra mensajes solo si MESSAGE_RETENTION_DAYS > 0', async () => {
      process.env['MESSAGE_RETENTION_DAYS'] = '30';
      const { svc, repo } = build();
      repo.deleteMessagesOlderThan.mockResolvedValue(1);
      expect((await svc.purgeExpired(NOW)).messagesDeleted).toBe(1);
      const [cutoff] = repo.deleteMessagesOlderThan.mock.calls[0] as [Date];
      expect(cutoff.getTime()).toBe(NOW.getTime() - 30 * DAY);
    });

    it('SESSION_RETENTION_DAYS=0 apaga el borrado de sesiones', async () => {
      process.env['SESSION_RETENTION_DAYS'] = '0';
      const { svc, repo } = build();
      await svc.purgeExpired(NOW);
      expect(repo.deleteSessionsOlderThan).not.toHaveBeenCalled();
    });

    it('un valor inválido de días cae al valor por defecto', async () => {
      process.env['SESSION_RETENTION_DAYS'] = 'abc';
      const { svc, repo } = build();
      await svc.purgeExpired(NOW);
      const [cutoff] = repo.deleteSessionsOlderThan.mock.calls[0] as [Date];
      expect(cutoff.getTime()).toBe(NOW.getTime() - 90 * DAY);
    });
  });

  describe('scheduledPurge', () => {
    it('no corre si otra réplica tiene el lock', async () => {
      const { svc, repo, cache } = build();
      cache.tryLock.mockResolvedValue(false);
      await svc.scheduledPurge();
      expect(cache.tryLock).toHaveBeenCalledWith('retention-purge', 6 * 3600);
      expect(repo.deleteSessionsOlderThan).not.toHaveBeenCalled();
    });

    it('corre si obtiene el lock, y RETENTION_ENABLED=false lo apaga', async () => {
      const { svc, repo } = build();
      await svc.scheduledPurge();
      expect(repo.deleteSessionsOlderThan).toHaveBeenCalled();

      repo.deleteSessionsOlderThan.mockClear();
      process.env['RETENTION_ENABLED'] = 'false';
      await svc.scheduledPurge();
      expect(repo.deleteSessionsOlderThan).not.toHaveBeenCalled();
    });

    it('un error en la purga no tumba el cron', async () => {
      const { svc, repo } = build();
      repo.deleteSessionsOlderThan.mockRejectedValue(new Error('db'));
      await expect(svc.scheduledPurge()).resolves.toBeUndefined();
    });

    it('sin CacheService (Redis apagado) igual corre', async () => {
      const { repo } = build();
      const svc = new RetentionService(repo as never);
      await svc.scheduledPurge();
      expect(repo.deleteSessionsOlderThan).toHaveBeenCalled();
    });
  });

  describe('eraseContact', () => {
    it('404 si el contacto es de otra organización', async () => {
      const { svc, repo } = build();
      repo.findContact.mockResolvedValue(null);
      await expect(svc.eraseContact('org', 'k1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findContact).toHaveBeenCalledWith('org', 'k1');
      expect(repo.eraseContact).not.toHaveBeenCalled();
    });

    it('borra todo lo del contacto y devuelve el reporte', async () => {
      const { svc, repo } = build();
      const contact = { id: 'k1', externalId: 'ext' };
      repo.findContact.mockResolvedValue(contact);
      repo.eraseContact.mockResolvedValue({
        conversationsDeleted: 2,
        messagesDeleted: 9,
        sessionsDeleted: 2,
      });

      const report = await svc.eraseContact('org', 'k1');

      expect(report).toEqual({
        contactId: 'k1',
        conversationsDeleted: 2,
        messagesDeleted: 9,
        sessionsDeleted: 2,
      });
      expect(repo.eraseContact).toHaveBeenCalledWith('org', contact);
    });
  });
});
