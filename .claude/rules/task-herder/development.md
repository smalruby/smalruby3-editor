---
paths:
  - "packages/task-herder/**/*.js"
  - "packages/task-herder/package.json"
---

# task-herder Development

Asynchronous task queue with throttling and concurrency control using Token Bucket algorithm.

**CRITICAL**: All npm commands MUST be run inside Docker containers using the `app` service.

## Package Commands

All commands are run from `/app/packages/task-herder` inside the container.

### Installation

```bash
docker compose run --rm app bash -c "cd /app/packages/task-herder && npm install"
```

### Build

```bash
docker compose run --rm app bash -c "cd /app/packages/task-herder && npm run build"
```

### Testing

```bash
# All tests
docker compose run --rm app bash -c "cd /app/packages/task-herder && npm test"
```

## Usage

Task Herder provides a queue for managing asynchronous tasks with:
- **Burst limiting**: Maximum tokens in bucket
- **Rate limiting**: Tokens per second (sustained rate)
- **Concurrency control**: Max simultaneous tasks
- **Task cost**: Configurable token cost per task

```javascript
import TaskQueue from 'task-herder'

const queue = new TaskQueue({
  burstLimit: 10,      // Max tokens
  sustainRate: 5,      // Tokens per second
  concurrency: 3,      // Max concurrent tasks
})

// Queue a task
await queue.do(
  () => fetch('https://example.com/data'),
  { cost: 2 }  // Optional task cost
)
```

## Key Features

- **Token Bucket Algorithm**: Controls task execution rate
- **FIFO Queue**: Tasks run in order added
- **Concurrency Limit**: Prevents resource exhaustion
- **Task Cancellation**: Via AbortSignal or manual cancel
- **Cost-based**: Different tasks can have different costs

## Development Notes

- Pure JavaScript utility package
- No dependencies on other Scratch packages
- Used by other packages for rate-limited operations (e.g., network requests)
