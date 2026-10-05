import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CUSTOMER_PORTS } from './application/ports/customer.ports'
import {
  CreateCustomer,
  GetCustomerKpis,
  GetSpendByCountry,
  ImportCustomers,
  ListCountries,
  ListCustomers,
} from './application/use-cases/customer.use-cases'
import { TypeOrmCustomerRepository } from './infrastructure/typeorm-customer.repository'
import { CountriesController, CustomersController } from './interface/http/customers.controller'
import { CustomerOrmEntity } from '../../shared/infrastructure/persistence/customer.orm-entity'

/** Composition root for the customers module. */
@Module({
  imports: [TypeOrmModule.forFeature([CustomerOrmEntity])],
  controllers: [CustomersController, CountriesController],
  providers: [
    ListCustomers,
    CreateCustomer,
    ImportCustomers,
    GetCustomerKpis,
    ListCountries,
    GetSpendByCountry,
    { provide: CUSTOMER_PORTS.repository, useClass: TypeOrmCustomerRepository },
  ],
  exports: [CUSTOMER_PORTS.repository, ListCountries],
})
export class CustomersModule {}
