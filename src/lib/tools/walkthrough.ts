// The three scripts on the Tools page, as walkthroughs: what each step prints and why it is there.
// The satellite, the gateway, the beam, the readings and the script names are made up for the page.
//
// A walkthrough is at step 0 before it runs and at step n once n lines have been printed. The
// reader sets the pace: one press, one step, and nothing advances by itself. Everything here is
// pure. The page (src/scripts/tools-ui.ts) owns the DOM.

export interface Step {
  /** The word the script prints at the start of the line. */
  verb: string;
  /** What the script prints for this step. */
  text: string;
  /** The step in a few words, for the reader. */
  title: string;
  /** Why the step is there. */
  why: string;
}

export interface Walkthrough {
  id: string;
  /** What the script is for: the text on its button. */
  name: string;
  command: string;
  steps: readonly Step[];
}

/** What the reader is told next to the output: where they are, and why that step exists. */
export interface Explanation {
  label: string;
  title: string;
  text: string;
}

/** A line of output at a given step: not printed yet, printed by an earlier step, or just printed. */
export type LineState = 'waiting' | 'earlier' | 'latest';

export const walkthroughs: readonly Walkthrough[] = [
  {
    id: 'health',
    name: 'Read a beam’s health',
    command: 'uv run python health-checks --satellite AURORA-2 --gateway northgate --beam 42',
    steps: [
      {
        verb: 'locate',
        text: 'beam 42 at Northgate: its IPGW and IGM found',
        title: 'Find the devices behind the beam',
        why: 'The command names a satellite, a gateway and a beam. The script works out which devices serve that beam, so nobody has to look it up at three in the morning.',
      },
      {
        verb: 'terminals',
        text: 'IPGW: 1,204 terminals online on beam 42',
        title: 'Count who is online',
        why: 'It asks the IPGW (the IP gateway, which customer terminals connect through) how many terminals are on the beam right now. That number says how many subscribers the problem can touch.',
      },
      {
        verb: 'inroutes',
        text: 'IGM: 2.1% inroute errors on beam 42',
        title: 'Measure the upload path',
        why: 'It asks the IGM (the inroute group manager, which handles upload traffic) for its error rates. Together with the terminal count, that shows where the trouble is.',
      },
      {
        verb: 'traffic',
        text: 'download CIR 2.1 Gbps · upload CIR 0.3 Gbps',
        title: 'Measure the traffic itself',
        why: 'It reads how much internet traffic the beam is carrying in each direction, download and upload. That rate is the CIR, measured in Gbps or Mbps. Terminals can be counted as online while almost nothing is flowing, so the traffic is measured too.',
      },
      {
        verb: 'decide',
        text: 'terminals, download and upload all far below baseline',
        title: 'Compare with a normal day',
        why: 'It compares the terminal count and both traffic figures with the baseline for this time of day, averaged for this day of the week, and with the same time yesterday. All of them are extremely low, so this is an outage and not a quiet hour.',
      },
      {
        verb: 'next',
        text: 'nothing changed · next: the storage check or the drift check',
        title: 'Stop, and hand over to the engineer',
        why: 'This script fixes nothing. Its job is speed: it runs the same commands an engineer would, on every device at once, where a person would run them on one device at a time. The engineer then finds the exact cause with the storage check or the drift check.',
      },
    ],
  },
  {
    id: 'storage',
    name: 'Find a storage problem',
    command: 'uv run python storage-checks --satellite AURORA-2 --gateway northgate',
    steps: [
      {
        verb: 'connect',
        text: 'logged in to every IPGW component at once (SSH)',
        title: 'Reach every component at the same time',
        why: 'An engineer would log in to one component, run a command, and move to the next. The script logs in to all of them together, using asyncio with asyncssh, because the work is almost all waiting on the network.',
      },
      {
        verb: 'check',
        text: 'storage checked on every component by listing its files (‘ls’)',
        title: 'Ask each component: can you see your files?',
        why: 'Each component keeps its files in a shared storage folder, called a mount, backed by the Ceph storage. ‘ls’ is the command that lists the files in a folder. Running it on the mount is the plainest health check there is: if the list comes back, the storage is answering.',
      },
      {
        verb: 'judge',
        text: 'answered on 22 of 24 components · 2 did not answer',
        title: 'Believe the mount, not the status page',
        why: 'A storage cluster can look healthy from a distance while its clients wait. A listing that hangs or fails on a component is the problem itself, seen from where it hurts.',
      },
      {
        verb: 'report',
        text: 'results listed per component, for the engineer',
        title: 'Show the engineer where to look',
        why: 'The script does not decide for the engineer. It shows which components answered and which did not, across every device, in the time it would take a person to check one.',
      },
      {
        verb: 'next',
        text: 'engineer: find the unhealthy storage node, then ‘mds fail’ it',
        title: 'What the engineer does with it',
        why: 'Knowing which rack lost its files, the engineer logs in to that SNC rack’s imaging server and from there to one of its three Ceph storage nodes (two active, one idle). Health commands show which node is unhealthy, and one command, ‘mds fail’ with that node’s name, moves its work to a healthy node. The Self-healing tab shows the automation that now does all of this by itself.',
      },
    ],
  },
  {
    id: 'drift',
    name: 'Find config drift',
    command: 'uv run python drift-checks --satellite AURORA-2 --gateway northgate',
    steps: [
      {
        verb: 'hash',
        text: 'SNC rack: configuration file a41f… · created 21 Nov 14:02',
        title: 'Fingerprint what the SNC rack has',
        why: 'Every SNC component reads from one shared mount, so one hash of the configuration file there says what the whole rack is running.',
      },
      {
        verb: 'hash',
        text: 'RF gateway rack: configuration file 9c07… · created 3 Nov 09:40',
        title: 'Fingerprint what the RF gateway rack has',
        why: 'The RF gateway rack has its own shared mount, which every RF gateway component reads. The same file is hashed there.',
      },
      {
        verb: 'compare',
        text: 'hashes differ · the SNC rack’s file is newer',
        title: 'Compare two fingerprints, then two dates',
        why: 'If the hashes match, the racks agree and there is nothing to do. If they differ, one rack has an update the other has not received, and the next modem failover will land on the mismatch. The file dates say which way round: here the SNC rack’s copy is newer, so the RF gateway rack is the one that is behind.',
      },
      {
        verb: 'report',
        text: 'mismatch reported, for the engineer',
        title: 'Say which rack is behind',
        why: 'Run by hand, this check only reports. The same comparison also runs unattended every ten minutes, and that version restarts the affected service when the racks disagree.',
      },
      {
        verb: 'next',
        text: 'engineer: push the newer file from the SNC rack to the RF gateway rack',
        title: 'What the engineer does with it',
        why: 'Knowing which rack has the newer file, the engineer logs in to that SNC rack’s imaging server, from there to the rack’s SCS VM, and runs the configuration push script. It copies the configuration on the SNC rack’s mount to the RF gateway rack’s mount, and the two racks agree again.',
      },
    ],
  },
];

/** What the reader sees before the first press. */
export const beforeItRuns: Explanation = {
  label: 'Before it runs',
  title: 'A few words name the problem',
  text: 'A satellite, a gateway and sometimes a beam are enough for a script to find what is wrong. Press “Run it”, then “Next step” when you have read each one.',
};

/** The nearest step this walkthrough has: 0 (not run yet) up to its number of steps. */
export function clampStep(walkthrough: Walkthrough, step: number): number {
  return Math.min(Math.max(0, Math.trunc(step)), walkthrough.steps.length);
}

/** The state of every line of output at a step, in order. */
export function lineStates(walkthrough: Walkthrough, step: number): LineState[] {
  const at = clampStep(walkthrough, step);
  return walkthrough.steps.map((_, index) => (index >= at ? 'waiting' : index === at - 1 ? 'latest' : 'earlier'));
}

/** The step after a press of the run button. After the last step it starts over at the first line. */
export function advance(walkthrough: Walkthrough, step: number): number {
  const at = clampStep(walkthrough, step);
  return at < walkthrough.steps.length ? at + 1 : 1;
}

/** Whether there is an earlier step to go back to. The state before the first press is not one. */
export function canGoBack(step: number): boolean {
  return step > 1;
}

/** The step after a press of Back. */
export function goBack(walkthrough: Walkthrough, step: number): number {
  const at = clampStep(walkthrough, step);
  return canGoBack(at) ? at - 1 : at;
}

/** What the run button says at a step. */
export function runLabel(walkthrough: Walkthrough, step: number): string {
  const at = clampStep(walkthrough, step);
  if (at === 0) return 'Run it';
  return at < walkthrough.steps.length ? 'Next step' : 'Start over';
}

/** What to tell the reader at a step. */
export function explain(walkthrough: Walkthrough, step: number): Explanation {
  const at = clampStep(walkthrough, step);
  const current = walkthrough.steps[at - 1];
  if (!current) return beforeItRuns;
  return { label: `Step ${at} of ${walkthrough.steps.length}`, title: current.title, text: current.why };
}
