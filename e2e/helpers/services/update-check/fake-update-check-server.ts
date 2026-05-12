import express from 'express';
import {FakeServer} from '@/helpers/services/fake-server';

/**
 * Shape of the JSON response served by the real updates.ghost.org service.
 *
 * The structure mirrors the contract documented on
 * `update-check-service.js#updateCheckResponse` — Ghost iterates `messages`
 * and treats any with `type === 'alert'` as a critical security notification.
 */
export interface UpdateCheckMessage {
    id: string;
    version: string;
    content: string;
    top: boolean;
    dismissible: boolean;
    type: 'alert' | 'info' | 'warning';
    severity?: string;
    action_url?: string;
    status?: string;
}

export interface UpdateCheckResponse {
    id: number;
    version: string;
    messages: UpdateCheckMessage[];
    created_at: string;
    custom: number;
    next_check: number;
}

/**
 * The body Ghost POSTs when reporting stats to the update-check service.
 * Mirrors the fields produced by `update-check-service.js#updateCheckData`.
 */
export interface CheckinPayload {
    ghost_version?: string;
    node_version?: string;
    env?: string;
    database_type?: string;
    email_transport?: string;
    url?: string;
    blog_id?: string;
    theme?: string;
    post_count?: number;
    user_count?: number;
    blog_created_at?: number | string;
    npm_version?: string;
    [key: string]: unknown;
}

function nextCheckTimestamp(): number {
    return Math.round(Date.now() / 1000) + (24 * 3600);
}

function defaultAlertResponse(): UpdateCheckResponse {
    return {
        id: 1,
        version: 'all',
        messages: [{
            id: 'e2e-critical-alert',
            version: '*',
            content: '<p>A critical update is available. Upgrade as soon as possible.</p>',
            top: true,
            dismissible: false,
            type: 'alert',
            severity: 'critical'
        }],
        created_at: new Date().toISOString(),
        custom: 1,
        next_check: nextCheckTimestamp()
    };
}

/**
 * Intercepts Ghost's outbound request to `updates.ghost.org`.
 *
 * Wired in through the `updateCheck__url` Ghost config override, this server
 * lets tests deterministically drive the update-check flow (critical alerts,
 * release notifications, etc.) without depending on the live service.
 *
 * The response is configurable via {@link setResponse} so future tests (e.g.
 * non-alert / `critical: false` cases) can reuse the same fixture.
 */
export class FakeUpdateCheckServer extends FakeServer {
    private response: UpdateCheckResponse = defaultAlertResponse();
    private readonly _checkins: CheckinPayload[] = [];

    constructor(options: {port?: number} = {}) {
        super({port: options.port, debugNamespace: 'e2e:fake-update-check'});
    }

    /**
     * Override the response served on the next request.
     *
     * Tests typically call this in `beforeEach` to set up the scenario under
     * test (e.g. an alert with a specific `action_url`, or a non-alert
     * notification).
     */
    setResponse(response: UpdateCheckResponse): void {
        this.response = response;
    }

    /**
     * Reset the response to the default critical-alert payload.
     */
    resetResponse(): void {
        this.response = defaultAlertResponse();
    }

    /**
     * Return all check-in bodies received so far. Ghost POSTs anonymous
     * stats here; tests can assert that a check-in happened (and what it
     * contained) without coupling to email delivery timing.
     */
    getCheckins(): CheckinPayload[] {
        return [...this._checkins];
    }

    clearCheckins(): void {
        this._checkins.length = 0;
    }

    /**
     * Wait until at least `count` check-ins have been received, or throw.
     */
    async waitForCheckins(count: number = 1, timeoutMs: number = 30_000): Promise<CheckinPayload[]> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (this._checkins.length >= count) {
                return this.getCheckins();
            }
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 250);
            });
        }

        throw new Error(
            `Timeout after ${timeoutMs}ms waiting for ${count} update-check check-in(s), got ${this._checkins.length}`
        );
    }

    protected setupRoutes(): void {
        this.app.use(express.json({limit: '1mb'}));

        const handler = (req: express.Request, res: express.Response): void => {
            if (req.method === 'POST' && req.body && typeof req.body === 'object') {
                this._checkins.push(req.body as CheckinPayload);
                this.debug(`Recorded checkin (${this._checkins.length} total)`);
            } else if (req.method === 'GET') {
                this.debug('Privacy-mode GET checkin received');
                this._checkins.push({} as CheckinPayload);
            }

            res.status(200).json(this.response);
        };

        this.app.get('/', handler);
        this.app.post('/', handler);

        this.app.use((req, res) => {
            this.debug(`Unhandled route: ${req.method} ${req.originalUrl}`);
            res.status(200).json(this.response);
        });
    }
}
