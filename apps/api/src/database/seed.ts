import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'
import { envSchema, toAppConfig } from '../config/env'
import type { AppConfig } from '../config/env'
import { BcryptPasswordHasher } from '../modules/auth/infrastructure/bcrypt-password.hasher'
import { PERSISTENCE_ENTITIES } from '../shared/infrastructure/database/database.module'
import { UserOrmEntity } from '../shared/infrastructure/persistence/user.orm-entity'
import { CustomerOrmEntity } from '../shared/infrastructure/persistence/customer.orm-entity'
import { SegmentOrmEntity } from '../shared/infrastructure/persistence/segment.orm-entity'
import { SegmentConditionOrmEntity } from '../shared/infrastructure/persistence/segment-condition.orm-entity'

/**
 * Development seed.
 *
 * Creates the two workspace accounts the UI documents and a realistic customer
 * set so segments and campaigns have something to work with. Idempotent: running
 * it twice leaves the same data, so it is safe to re-run against an existing
 * database.
 */

// The seed runs outside Nest, so it loads the env files the API would.
loadEnv({ path: ['.env.local', '.env'] })

const config: AppConfig = toAppConfig(envSchema.parse(process.env))

const dataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  entities: [...PERSISTENCE_ENTITIES],
  synchronize: true,
})

interface Condition {
  readonly field: string
  readonly operator: string
  readonly value: string
}

interface SeedUser {
  readonly email: string
  readonly fullName: string
  readonly role: string
}

/** Matches the credentials in the README and the web app's mock layer. */
const USERS: readonly SeedUser[] = [
  { email: 'aicha.njoya@dme.cm', fullName: 'Aïcha Njoya', role: 'marketing_lead' },
  { email: 'serge.etoa@dme.cm', fullName: 'Serge Etoa', role: 'lifecycle_marketer' },
]

const DEMO_PASSWORD = 'campaigns'

const COUNTRIES = ['Cameroon', 'Cameroon', 'Cameroon', 'Senegal', 'Côte d’Ivoire', 'Nigeria', 'Gabon', 'Togo'] as const

/**
 * Deterministic pseudo-random so the seed produces the same audience every time
 * and segment previews are reproducible in tests.
 */
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const STATUSES = ['active', 'active', 'active', 'inactive', 'dormant'] as const

function buildCustomers(count: number) {
  const random = createRandom(20260317)
  const names = [
    'Ngono', 'Mbarga', 'Fotso', 'Nkoulou', 'Essomba', 'Owona', 'Bikoi', 'Tchoupo',
    'Kamdem', 'Ntap', 'Sadi', 'Meka', 'Bowa', 'Ekwa', 'Nyobe', 'Tamo',
    'Kamla', 'Njoya', 'Etoa', 'Fotang', 'Ngassa', 'Munde', 'Salla', 'Bikoro',
    'Eyenga', 'Kouam', 'Ndongo', 'Folefack',
  ]

  return Array.from({ length: count }, (_unused, index) => {
    const first = index % 2 === 0 ? 'Aline' : 'Blaise'
    const last = names[index % names.length] ?? 'Nkoulou'
    const spent = Math.round((random() * 900_000 + 15_000) / 100) * 100
    const transactions = Math.floor(random() * 40) + 1
    const days = Math.floor(random() * 180)

    return {
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.cm`,
      country: COUNTRIES[index % COUNTRIES.length] ?? 'Cameroon',
      status: STATUSES[index % STATUSES.length] ?? 'active',
      // The column is numeric in Postgres, which TypeORM surfaces as a string.
      totalAmountSpent: String(spent),
      totalTransactions: transactions,
      lastActivityDate: new Date(Date.now() - days * 86_400_000),
    }
  })
}

async function seed(): Promise<void> {
  await dataSource.initialize()
  console.log(`Connected to ${config.database.name} at ${config.database.host}:${config.database.port}`)

  const users = dataSource.getRepository(UserOrmEntity)
  const hasher = new BcryptPasswordHasher()
  const passwordHash = await hasher.hash(DEMO_PASSWORD)

  for (const seedUser of USERS) {
    const existing = await users.findOne({ where: { email: seedUser.email } })
    if (existing !== null) {
      console.log(`• user ${seedUser.email} already exists`)
      continue
    }
    const row = new UserOrmEntity()
    row.email = seedUser.email
    row.fullName = seedUser.fullName
    row.role = seedUser.role
    row.passwordHash = passwordHash
    row.isActive = true
    await users.save(row)
    console.log(`+ user ${seedUser.email}`)
  }

  const customers = dataSource.getRepository(CustomerOrmEntity)
  const customerCount = await customers.count()
  if (customerCount > 0) {
    console.log(`• ${customerCount} customers already present`)
  } else {
    const rows = buildCustomers(280)
    await customers.save(
      rows.map((row) => {
        const entity = new CustomerOrmEntity()
        entity.name = row.name
        entity.email = row.email
        entity.country = row.country
        entity.status = row.status
        entity.totalAmountSpent = row.totalAmountSpent
        entity.totalTransactions = row.totalTransactions
        entity.lastActivityDate = row.lastActivityDate
        return entity
      }),
    )
    console.log(`+ ${rows.length} customers`)
  }

  const segments = dataSource.getRepository(SegmentOrmEntity)
  if ((await segments.count()) === 0) {
    // Conditions are attached to their parent so the cascade inserts them with the
    // segment; saving them separately would leave the segment with no clauses.
    const definitions: readonly { name: string; matchCount: number; conditions: readonly Condition[] }[] = [
      {
        name: 'High value, recently active',
        matchCount: 46,
        conditions: [
          { field: 'totalAmountSpent', operator: 'gt', value: '250000' },
          { field: 'totalTransactions', operator: 'gt', value: '8' },
          { field: 'lastActivityDays', operator: 'lt', value: '45' },
        ],
      },
      {
        name: 'Dormant 90 days',
        matchCount: 71,
        conditions: [{ field: 'lastActivityDays', operator: 'gt', value: '90' }],
      },
    ]

    for (const definition of definitions) {
      const segment = new SegmentOrmEntity()
      segment.name = definition.name
      segment.matchCount = definition.matchCount
      segment.conditions = definition.conditions.map((condition) => {
        const child = new SegmentConditionOrmEntity()
        child.field = condition.field
        child.operator = condition.operator
        child.value = condition.value
        return child
      })
      await segments.save(segment)
    }

    console.log(`+ ${definitions.length} segments`)
  } else {
    console.log('• segments already present')
  }

  await dataSource.destroy()
  console.log('Seed complete. Sign in with aicha.njoya@dme.cm / campaigns')
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})