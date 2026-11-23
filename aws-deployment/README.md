# AWS deployment

The Trip AWS backend uses two CloudFormation stacks. The infrastructure stack owns the API and data resources. The Lambda stack deploys the handlers and attaches routes to the API.

- [Getting started](GETTING_STARTED.md) covers prerequisites, deployment, updates, and smoke checks.
- [Architecture](ARCHITECTURE.md) maps the stacks, handlers, and data flow.
- [Change history](CHANGELOG.md) records infrastructure and application changes by date and Git revision.
- [Bug log](BUGS.md) tracks gaps found in the AWS source and fixes from earlier revisions.

Start with the [project guide](../documentation/GETTING_STARTED.md) to run the app locally with FastAPI.
