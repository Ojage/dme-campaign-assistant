import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { classify, toShellAssignments } from './change-detect.mjs'

const none = { API: false, WEB: false, SCHEMA: false, ALL: false }

describe('change-detect', () => {
  it('rebuilds the API and runs the schema step for an api-only change', () => {
    assert.deepEqual(classify(['apps/api/src/modules/campaigns/campaigns.module.ts']), {
      API: true,
      WEB: false,
      SCHEMA: true,
      ALL: false,
    })
  })

  it('treats entity metadata as schema work', () => {
    assert.deepEqual(classify(['apps/api/src/shared/infrastructure/persistence/session.orm-entity.ts']), {
      API: true,
      WEB: false,
      SCHEMA: true,
      ALL: false,
    })
  })

  it('rebuilds the web app for a web-only change', () => {
    assert.deepEqual(classify(['apps/web/src/pages/CampaignsPage.tsx']), {
      API: false,
      WEB: true,
      SCHEMA: false,
      ALL: false,
    })
  })

  it('rebuilds the web app when its nginx config moves', () => {
    assert.deepEqual(classify(['apps/web/nginx.conf']), {
      API: false,
      WEB: true,
      SCHEMA: false,
      ALL: false,
    })
  })

  it('rebuilds both apps for a contracts change', () => {
    assert.deepEqual(classify(['packages/contracts/src/http/client.ts']), {
      API: true,
      WEB: true,
      SCHEMA: false,
      ALL: false,
    })
  })

  it('rebuilds everything when the lockfile moves', () => {
    assert.deepEqual(classify(['pnpm-lock.yaml']), {
      API: true,
      WEB: true,
      SCHEMA: true,
      ALL: true,
    })
  })

  it('rebuilds everything for a workspace manifest change', () => {
    assert.deepEqual(classify(['package.json']), {
      API: true,
      WEB: true,
      SCHEMA: true,
      ALL: true,
    })
  })

  it('rebuilds nothing for docs, CI, scripts, infra or data paths', () => {
    assert.deepEqual(
      classify([
        'docs/reference/deployment.mdx',
        '.github/workflows/deploy-production.yml',
        'scripts/ci-deploy.sh',
        'infra/compose.prod.yml',
        'data/pg/0001',
        'README.md',
      ]),
      none,
    )
  })

  it('rebuilds nothing for an empty change set', () => {
    assert.deepEqual(classify(['  ', '', null, undefined]), none)
  })

  it('rebuilds everything for a path it does not recognise', () => {
    assert.deepEqual(classify(['packages/new-package/package.json']), {
      API: true,
      WEB: true,
      SCHEMA: true,
      ALL: true,
    })
  })

  it('rebuilds everything when an unknown path accompanies a known one', () => {
    assert.deepEqual(classify(['apps/web/src/main.tsx', 'vendor-tools.md']), {
      API: true,
      WEB: true,
      SCHEMA: true,
      ALL: true,
    })
  })

  it('combines api and web changes in one plan', () => {
    assert.deepEqual(
      classify(['apps/api/src/main.ts', 'apps/web/src/main.tsx', 'docs/reference/configuration.mdx']),
      { API: true, WEB: true, SCHEMA: true, ALL: false },
    )
  })

  it('emits eval-able shell assignments in a stable order', () => {
    assert.deepEqual(toShellAssignments(['apps/api/src/main.ts']), [
      'API=true',
      'WEB=false',
      'SCHEMA=true',
      'ALL=false',
    ])
  })
})