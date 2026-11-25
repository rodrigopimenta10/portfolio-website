---
title: aws-platform-terraform
order: 3
summary: A production-style AWS platform in Terraform, built as reusable modules with tests, one roadmap item at a time.
role: It is how I am learning AWS platform engineering. A scheduled Claude Code run builds the next roadmap item and writes a note explaining it. I review each change and study the note.
result: Every module is tested offline, with no AWS account. GitHub Actions then applies the live stacks to a real account through OIDC, with no stored keys, and destroys them again. More than 20 drill reports with redacted console screenshots are in the repo.
stack:
  - Terraform
  - terraform test with mock providers
  - Moto
  - tflint
  - checkov
  - GitHub Actions with OIDC
code: https://github.com/rodrigopimenta10/aws-platform-terraform
screenshot:
  src: ../../assets/screens/aws-platform-terraform.webp
  alt: The drill report of 18 November 2026 for the stack live/stacks/m1, on GitHub. Its table reads plan gate passed, apply success in 61 seconds with 39 resources, destroy success in 250 seconds, destroy verified yes.
  caption: The report the live drill of 18 November 2026 committed to the repository.
architecture:
  caption: A push to main runs the offline checks. If they pass, the drill applies the changed stacks to a real AWS account, records what it made, destroys it, and commits a report.
  diagram: aws-platform-terraform
card:
  summary: A production-style AWS platform in Terraform, built as reusable modules with tests, one roadmap item at a time.
  alt: "A drill report from aws-platform-terraform: stack applied to a real AWS account, then destroyed"
  claim: Applied to a real AWS account and destroyed again
  detail: by GitHub Actions, with no stored keys. Every module is tested offline first.
  tags:
    - Terraform
    - VPC
    - IAM/OIDC
    - EKS
    - Moto
---

## What it is

Networking, identity, containers, serverless, observability and CI/CD on AWS, written as reusable
Terraform modules with tests. Done so far: remote state, VPC, VPC endpoints, flow logs, KMS,
GitHub OIDC and IAM permissions boundaries. EKS, serverless and observability are on the roadmap.

## How it is built

A scheduled Claude Code run takes the next item from the roadmap, builds it with tests and pushes
it once every check passes. It also writes a learning note, which I study after reviewing the
change. Commits written by Claude say so in a trailer.

<!-- architecture -->

## How it is tested

Every module has unit tests with a mocked AWS provider and integration tests against Moto, a
local AWS emulator. CI also runs terraform fmt, validate, tflint and checkov. None of that touches
a real AWS account.

## Live drills

Tests prove the code. A live drill proves it works in a real account. After CI passes, a workflow
applies every changed stack through GitHub OIDC with no stored keys, saves evidence with the
account ID redacted, destroys the stack, checks that nothing is left and commits a report.

The drill runs inside limits it cannot loosen: a plan gate refuses forbidden resource types, the
role is boxed in by IAM denies and a permissions boundary, and a separate reaper workflow destroys
anything a drill leaves behind.
