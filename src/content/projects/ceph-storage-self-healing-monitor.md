---
kind: work
title: Ceph Storage Self-Healing Monitor
order: 4
resumeId: ceph-storage-self-healing-monitor
---

## The problem, in general terms

A Ceph file system keeps its file names and directories in the care of a metadata server. When
that server struggles, every client waits, and the cluster can still look healthy enough from a
distance. The fix is well known: hand the work to a standby. But someone has to notice, decide
the standby is fit to take it, make the move and check that it worked, at any hour.

## The ideas behind it

Each of these is one of the resume lines above, said plainly.

- **It looks on a fixed cycle, not when someone is paged.** Every three minutes it reads the state
  of every cluster again.
- **It checks where the work is going before it moves it.** A failover onto a standby with no room
  turns one problem into two. The monitor assesses the standby first and reaches one of four
  verdicts, and only some of them allow the move.
- **It does not take the command's word for it.** After a failover it reads the cluster's own log
  to see what actually happened, because the same node taking the work straight back can look
  like a success and is not one.
- **It writes down what it does.** Events are appended to a history that is never rewritten, with
  a dashboard beside it.

## What I took from building it

- Automation that acts on its own needs a way to say no, and "no" has to be an outcome it
  reports, not an error.
- "It ran" and "it worked" are different facts and need different evidence.
- The number worth quoting is the outage it removed, not how often it acted: about an hour and a
  half of manual recovery became one three-minute cycle.

The second idea is one I can show. The simulation below uses made-up clusters and none of this
system's code, names or numbers.
