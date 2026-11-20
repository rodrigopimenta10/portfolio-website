---
kind: work
title: Config Integrity Self-Heal
order: 5
resumeId: config-integrity-self-heal
---

## The problem, in general terms

A long-running service reads its configuration when it starts. If the files on a machine later
stop matching what they should be, nothing fails loudly: the difference sits there until something
downstream looks wrong. Here that was a modem failover, which landed on the drifted
configuration and took its share of subscribers offline. With many machines at several sites, finding that by hand is slow, and
the fix is the same every time.

## The ideas behind it

Each of these is one of the resume lines above, said plainly.

- **It compares on a cycle.** Every ten minutes it reads each gateway's configuration over SFTP
  and compares it with what it should be. Drift is found by looking, not by waiting for a symptom.
- **It fixes the thing that is wrong.** When it finds drift it restarts the affected service.
- **Many slow conversations at once, without many processes.** The work is almost all waiting on
  the network, so it runs on asyncio with a semaphore that caps how many connections are open at a
  time. That replaced a version built on blocking calls, without reaching for process pools.
- **It measures whether it helped.** Drift is counted in episodes, and 89% of them close inside
  one ten-minute cycle.

## What I took from building it

- For work that waits on the network, concurrency is a number you choose, not a pool of processes
  you feed.
- A fix that runs by itself should come with a measured time to close, or nobody can tell whether
  it is helping.
- The dull remediation is the right one to automate first: it is the one people stop doing
  carefully.
