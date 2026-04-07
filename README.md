# smalruby3-editor: The Smalruby 3 Editor Monorepo

This is the development repository for **Smalruby 3**, a Ruby-based visual programming environment forked from [Scratch 3.0](https://github.com/scratchfoundation/scratch-editor).

If you'd like to use Scratch, please visit the [Scratch website](https://scratch.mit.edu/). You can build your own
Scratch project by pressing "Create" on that website or by visiting <https://scratch.mit.edu/projects/editor/>.

This is a source code repository for the packages that make up the Smalruby editor and a few additional support
packages. Use this if you'd like to learn about how the Smalruby editor works or to contribute to its development.

## What's in this repository?

The `packages` directory in this repository contains:

- `scratch-gui`: **Smalruby 3 GUI**. The React-based web interface, customized for Smalruby (e.g., Ruby mode, custom extensions). Forked from `scratch-gui`.
- `scratch-vm`: **Smalruby 3 VM**. The virtual machine that runs projects, with @ruby/prism integration for Ruby parsing. Forked from `scratch-vm`.
- `scratch-render` draws backdrops, sprites, and clones on the stage.
- `scratch-svg-renderer` processes SVG (vector) images for use with projects.

_Please add to this list as more packages are migrated to the monorepo._

The `infra` directory contains AWS CDK infrastructure projects:

- `infra/smalruby-mesh-v2`: **Mesh v2**. AWS CDK project for the serverless mesh networking service (AppSync + DynamoDB), enabling real-time communication between Smalruby instances.

Each package has its own `README.md` file with more information about that package.

## Development

### Installation

To install dependencies for all packages in the monorepo:

```bash
npm install
```

**Note**: We strictly recommend using the Docker environment for development to ensure consistency. Please refer to the [root README](../../README.md) for Docker instructions.

### Build

To build all packages:

```bash
npm run build
```

To build in development mode (faster, with source maps):

```bash
npm run build:dev
```

### Running the Development Server

To start the GUI development server (typically on http://localhost:8601):

```bash
npm start
```

### Testing

To run all tests (lint, unit, integration):

```bash
npm test
```

To run unit tests only:

```bash
npm run test:unit
```

To run integration tests only:

```bash
npm run test:integration
```

## Smalruby Specific Features

### Language Specification

Smalruby supports a subset of Ruby syntax. See the language specification for details:

- **[Language Specification](docs/smalruby-language-spec.md)** ([Japanese](docs/smalruby-language-spec.ja.md)) — Core syntax and built-in methods
- **[Extension Methods](docs/smalruby-language-spec-extensions.md)** ([Japanese](docs/smalruby-language-spec-extensions.ja.md)) — Pen, Music, Translate, micro:bit, and more
- **[Version 1 API Differences](docs/smalruby-language-spec-v1-diff.md)** ([Japanese](docs/smalruby-language-spec-v1-diff.ja.md)) — Changes from v1 to v2

### Ruby Mode
Smalruby 3 integrates [@ruby/prism](https://github.com/ruby/prism) to parse Ruby code within the browser. The `scratch-gui` package provides the Ruby code editor (using Monaco Editor) with Ruby-to-blocks conversion and blocks-to-Ruby generation.

### Google Drive Integration
Smalruby 3 supports loading and saving projects directly to Google Drive.
For setup instructions, please see [Google API Setup Guide](packages/scratch-gui/docs/google-api-setup.md).

### AWS Infrastructure (infra/)

AWS CDK infrastructure projects are managed in the `infra/` directory. Use the `infra` Docker service for CDK operations:

```bash
# Install dependencies
docker compose run --rm infra npm install

# Deploy Mesh v2 to staging
docker compose run --rm infra npx cdk deploy --context stage=stg

# Show deployment diff
docker compose run --rm infra npx cdk diff --context stage=stg
```

AWS credentials must be set via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`) before running these commands.

## Monorepo migration

### What's going on?

We're migrating the Smalruby editor packages into this monorepo, following the upstream Scratch Editor structure. This allows us to manage all packages in one place.

### Why are there only a few packages in this repo?

We're migrating packages in stages.

## Thank you!

Smalruby is based on Scratch from the Scratch Foundation.
Scratch would not be what it is today without help from the global community of Scratchers and open-source contributors. Thank you for your contributions and support. _[Scratch on!](https://scratch.mit.edu/projects/65347738/fullscreen/)_

## Donate

We provide [Scratch](https://scratch.mit.edu) free of charge, and want to keep it that way! Please consider making a
[donation](https://secure.donationpay.org/scratchfoundation/) to support our continued engineering, design, community,
and resource development efforts. Donations of any size are appreciated. Thank you!