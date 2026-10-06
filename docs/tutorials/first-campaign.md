# Your first campaign

This tutorial takes you from an empty database to a drafted campaign you can read
in the browser. It assumes nothing but Node 24, pnpm and Docker.

Follow the steps in order. Each one produces something you can see.

## What you will build

A running API and web app, a customer base to target, a segment describing who to
target, and a campaign generated for it. Along the way you will meet the seed
script, the API's sign-in endpoint, and the campaign composer.

## Before you start

You need Docker running, because the database runs in a container.

## Step 1: Start the database

```bash
docker compose up -d postgres
```

The first start pulls a PostgreSQL image and takes a minute. Check that it is
healthy before moving on:

```bash
docker compose ps
```

You should see a `healthy` status. If you see `starting`, wait a few seconds and
run the command again.

## Step 2: Fill it with something to work with

The API refuses to guess at a customer base, so you provide one:

```bash
pnpm seed
```

This creates two accounts and 280 customers spread over several countries.

## Step 3: Start the API

```bash
pnpm dev:api
```

Watch for this line:

```
API listening on http://localhost:4000/api/v1
Reference: http://localhost:4000/api/docs
```

The reference link is worth opening now, even though you will not need it yet:
it is a full list of every endpoint, generated from the same schemas the server
validates requests against.

## Step 4: Start the web app

In a second terminal:

```bash
pnpm dev:web
```

Open <http://localhost:5173> and sign in:

```
aicha.njoya@dme.cm
campaigns
```

## Step 5: Look at the dashboard

The dashboard reads real aggregates from the database — customer counts, spend by
country — not fixtures. Notice that the customer total matches what the seed
reported. That is your first confirmation that the browser, the API and the
database are talking to each other.

## Step 6: Target an audience

Open **Segments**. Two segments are already seeded. Click one and read its
conditions: each condition narrows the audience, and the audience size is counted
by the API against the customers you seeded in step 2.

If you want to try building one, change a threshold. The audience size updates as
you type, because the API counts matches for the conditions you have not saved
yet.

## Step 7: Draft a campaign

Open **Campaigns**. Pick a segment, choose a channel and a tone, and describe
what you want to say. Then select **Generate**.

The draft appears with a title, a message and a call to action. It arrives as
`draft`, so nothing has been sent anywhere — a campaign only becomes `ready`, and
then `sent`, when a person moves it through those states.

## What you have learned

You have a running system, and you have used its main path end to end: sign in,
read aggregates, define an audience, generate a campaign.

Two things are worth noticing, because they are unusual for this kind of
application:

- **The browser never talks to the AI provider.** Generation happens in the API,
  which owns the model key and the prompt. See
  [the generative pipeline](../explanation/generative-pipeline.md).
- **Responses are validated twice** — once by the server, once by the browser —
  against one shared definition. See
  [the contract](../explanation/contracts.md).

## Where to next

- Want to add a customer and see every screen update? Read
  [add a customer](../how-to/add-a-customer.md).
- Want to know why the code is arranged this way? Read
  [architecture](../explanation/architecture.md).
- Want to call the API from your own program? Read
  [API reference](../reference/api.md).
