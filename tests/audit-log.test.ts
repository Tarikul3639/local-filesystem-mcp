import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withAudit, type AuditEvent } from '../src/security/audit-log.js';

describe('Filesystem tool audit logging', () => {
    it('records successful operations without file contents or path secrets', async () => {
        const events: AuditEvent[] = [];
        const fileContents = 'private file contents and API key: sk-test-secret';

        const result = await withAudit(
            'read',
            '/allowed/api-key-sk-live-secret.txt',
            async (setValidatedPath) => {
                setValidatedPath('/allowed/api-key-sk-live-secret.txt');
                return { content: [{ type: 'text' as const, text: fileContents }] };
            },
            { writeEvent: async (event) => { events.push(event); } },
        );

        assert.equal(result.content[0]?.text, fileContents);
        assert.equal(events.length, 1);
        assert.equal(events[0]?.status, 'success');
        assert.match(events[0]?.path ?? '', /REDACTED/);
        assert.doesNotMatch(JSON.stringify(events), /private file contents|sk-test-secret|sk-live-secret/);
    });

    it('records operation failures without copying internal error details', async () => {
        const events: AuditEvent[] = [];

        await withAudit(
            'write',
            '/allowed/output.txt',
            async () => ({
                content: [{ type: 'text' as const, text: 'EIO: internal storage detail' }],
                isError: true,
            }),
            { writeEvent: async (event) => { events.push(event); } },
        );

        assert.equal(events[0]?.status, 'failure');
        assert.equal(events[0]?.error, 'operation_failed');
        assert.doesNotMatch(JSON.stringify(events), /internal storage detail/);
    });

    it('records permission and path validation rejections as denied', async () => {
        const events: AuditEvent[] = [];

        await withAudit(
            'delete',
            '/outside/private.txt',
            async () => ({
                content: [{ type: 'text' as const, text: 'Access denied: Path outside allowed directories' }],
                isError: true,
            }),
            { writeEvent: async (event) => { events.push(event); } },
        );

        assert.equal(events[0]?.status, 'denied');
        assert.equal(events[0]?.error, 'request_denied');
        assert.doesNotMatch(JSON.stringify(events), /outside allowed directories/);
    });

    it('keeps successful tool results successful if audit storage fails', async () => {
        const originalError = console.error;
        const errors: string[] = [];
        console.error = (...args: unknown[]) => { errors.push(args.join(' ')); };

        try {
            const result = await withAudit(
                'read',
                '/allowed/file.txt',
                async () => ({ content: [{ type: 'text' as const, text: 'completed' }] }),
                { writeEvent: async () => { throw new Error('secret audit backend detail'); } },
            );

            assert.equal(result.content[0]?.text, 'completed');
            assert.deepEqual(errors, ['[audit] Unable to write audit event.']);
            assert.doesNotMatch(errors.join(' '), /secret audit backend detail/);
        } finally {
            console.error = originalError;
        }
    });
});
