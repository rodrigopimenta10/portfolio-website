---
kind: personal
title: aws-platform-terraform
order: 2
summary: A production-style AWS platform in Terraform, built as reusable modules with tests, one roadmap item at a time.
role: It is how I am learning AWS platform engineering. A scheduled Claude Code run builds the next roadmap item and writes a note explaining it; I review each change and study the note.
stack:
  - Terraform
  - terraform test with mock providers
  - Moto
  - tflint
  - checkov
  - GitHub Actions with OIDC
result: Every module is tested offline, with no AWS account. GitHub Actions then applies the live stacks to a real account through OIDC, with no stored keys, and destroys them again. More than 20 drill reports with redacted console screenshots are in the repo.
code: https://github.com/rodrigopimenta10/aws-platform-terraform
statusId: aws-platform
screenshot:
  src: ../../assets/screens/aws-platform-terraform.webp
  alt: The drill report of 18 November 2026 for the stack live/stacks/m1, on GitHub. Its table reads plan gate passed, apply success in 61 seconds with 39 resources, destroy success in 250 seconds, destroy verified yes.
  caption: The report the live drill of 18 November 2026 committed to the repository, as GitHub shows it. Taken with headless Chrome in a window 1000 by 625, at 2.88 times the pixel density.
diagram:
  name: aws-platform-terraform
  caption: A push to main runs the offline checks. If they pass, the drill applies the changed stacks to a real AWS account, records what it made, destroys it, and commits a report.
  sourceHref: https://github.com/rodrigopimenta10/aws-platform-terraform/blob/main/.github/workflows/live-drill.yml
  sourceLabel: .github/workflows/live-drill.yml
facts:
  - Built a roadmap item at a time by a scheduled Claude Code run that I review
  - Tested offline with mock providers and Moto
  - Real apply-and-destroy drills from GitHub Actions, no stored keys
  - Unit tests also pass under OpenTofu
sources:
  - claim: A production-style AWS platform in Terraform; a daily Claude Code run builds the next roadmap item, and I review it and study the note it writes.
    where: GitHub profile README and the repository README, "How this repo is built".
    href: https://github.com/rodrigopimenta10/aws-platform-terraform#how-this-repo-is-built
  - claim: Every module is tested offline; GitHub Actions applies the live stacks through OIDC with no stored keys and destroys them again.
    where: GitHub profile README; the repository's live-drill workflow.
    href: https://github.com/rodrigopimenta10/aws-platform-terraform/blob/main/.github/workflows/live-drill.yml
  - claim: More than 20 drill reports with redacted console screenshots.
    where: Counted in the repository's docs/live/ on 18 November 2026 (23 reports).
    href: https://github.com/rodrigopimenta10/aws-platform-terraform/tree/main/docs/live
  - claim: The unit tests also pass under OpenTofu.
    where: Commit ffdaa8f of 18 November 2026, which records all twelve runs of the flow-logs module passing under both tools.
    href: https://github.com/rodrigopimenta10/aws-platform-terraform/commit/ffdaa8f1fcd433b11d01f89262d417f1cd349904
  - claim: Done so far, remote state, VPC, VPC endpoints, flow logs, KMS, GitHub OIDC and IAM permissions boundaries.
    where: GitHub profile README; the modules/ directory of the repository.
    href: https://github.com/rodrigopimenta10/aws-platform-terraform/tree/main/modules
---

## What it is

Networking, identity, containers, serverless, observability and CI/CD on AWS, written as reusable
Terraform modules with tests. Done so far: remote state, VPC, VPC endpoints, flow logs, KMS,
GitHub OIDC and IAM permissions boundaries. EKS, serverless and observability are on the roadmap.

## How it is built

I am building it with Claude Code as a structured way to learn AWS platform engineering. A
scheduled run takes the next item from the roadmap, builds it with tests and pushes it once every
check passes. It also writes a learning note: what was built, why, the trade-offs, an exercise and
interview-style questions. I review what it built and study the note. Commits written by Claude
say so in a trailer.

## How it is tested

Every module has `terraform test` files of two kinds: unit tests with a mocked AWS provider and
no network, and integration tests that really create and destroy resources against Moto, a local
AWS emulator. CI also runs `terraform fmt`, `validate`, `tflint` and `checkov`. None of that
touches a real AWS account. The unit tests also pass under OpenTofu.

## Live drills

Tests prove the code; a live drill proves it works in a real account. After CI passes on a push
to `main`, a workflow applies every stack whose files changed since the last successful drill. It
assumes its AWS role through GitHub OIDC, so no AWS keys are stored anywhere. It saves read-only
evidence and console screenshots with the account ID redacted, destroys the stack, checks that
nothing is left, and commits a report.

The drill runs inside limits it cannot loosen: a plan gate refuses forbidden resource types, the
role is boxed in by IAM denies and a permissions boundary, a budget action cuts it off at the
spend limit, and a separate reaper workflow destroys anything a drill leaves behind.

The row for this project on the home page is the latest of those drills, read from GitHub's
public API.
