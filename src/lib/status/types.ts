// The shape of GET /api/status, as the status service (status/src/portfolio_status/models.py) writes it.

export type State = 'up' | 'degraded' | 'down' | 'unknown';

export interface LastKnown {
  state: State;
  fact: string;
  checked_at: string;
}

export interface SystemStatus {
  id: string;
  name: string;
  url: string;
  state: State;
  checked_at: string;
  fact?: string;
  since?: string;
  since_label?: string;
  reason?: string;
  latency_ms?: number;
  last_known?: LastKnown;
}

export interface StatusResponse {
  generated_at: string;
  recorded: boolean;
  systems: SystemStatus[];
}

/**
 * The rows the panel shows before any answer arrives, in the order the service returns them. The
 * service also reports on this site itself. The panel leaves that out: a visitor who can read the
 * panel already knows the site is up.
 */
export const SYSTEMS = [
  { id: 'sightline', name: 'Sightline', url: 'https://lunarsightline.com' },
  { id: 'orbital-watch', name: 'Orbital Watch', url: 'https://orbital.rodrigopimenta.com' },
  {
    id: 'aws-platform',
    name: 'AWS platform',
    url: 'https://github.com/rodrigopimenta10/aws-platform-terraform/actions/workflows/live-drill.yml',
  },
] as const;
